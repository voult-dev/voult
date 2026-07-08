const EndUser = require('../../models/endUser');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const { ApiError } = require('../../utils/apiError');
const MFAService = require('../../services/mfaService');
const AuditService = require('../../services/auditService');
const { completeEndUserLogin } = require('../../services/authLoginService');
const { verifyMfaPendingToken } = require('../../utils/jwt');

const endUserBuilder = new SafeQueryBuilder(EndUser);

async function getMfaUser(userId, appId) {
  return endUserBuilder.findOne({
    _id: userId,
    app: appId,
    deletedAt: null
  }).select('+mfaSecret +mfaBackupCodes +mfaPendingSecret +mfaPendingBackupCodes +passwordHash');
}

module.exports.setupMfa = async (req, res) => {
  const user = req.endUser;
  const app = req.appClient;

  if (user.mfaEnabled) {
    throw new ApiError(400, 'MFA_ALREADY_ENABLED', 'MFA is already enabled for this account');
  }

  const secret = MFAService.generateSecret(user.email || user.username, app.name);
  const qrCode = await MFAService.generateQRCode(secret);
  const { plaintextCodes: backupCodes, hashedCodes } = MFAService.createBackupCodeSet();

  user.mfaPendingSecret = secret.base32;
  user.mfaPendingBackupCodes = hashedCodes;
  user.mfaPendingExpires = MFAService.getSetupExpiry();
  await user.save();

  await AuditService.log('BACKUP_CODES_GENERATED', user._id, app._id, req, {
    details: { stage: 'MFA_SETUP', count: backupCodes.length }
  });

  await AuditService.log('MFA_ENABLED', user._id, app._id, req, {
    details: { stage: 'SETUP_STARTED' },
    status: 'PENDING'
  });

  res.status(200).json({
    message: 'Scan the QR code with your authenticator app, then confirm with a 6-digit code',
    qrCode,
    secret: secret.base32,
    backupCodes
  });
};

module.exports.enableMfa = async (req, res) => {
  const { token } = req.body;
  const user = await getMfaUser(req.endUser._id, req.appClient._id);

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (user.mfaEnabled) {
    throw new ApiError(400, 'MFA_ALREADY_ENABLED', 'MFA is already enabled for this account');
  }

  if (!user.mfaPendingSecret || MFAService.isSetupExpired(user.mfaPendingExpires)) {
    throw new ApiError(400, 'MFA_SETUP_EXPIRED', 'MFA setup session expired. Start setup again.');
  }

  if (!MFAService.verifyToken(user.mfaPendingSecret, token)) {
    await AuditService.log('MFA_VERIFY_FAILURE', user._id, req.appClient._id, req, {
      details: { stage: 'ENROLLMENT' },
      status: 'FAILURE',
      riskLevel: 'MEDIUM'
    });
    throw new ApiError(400, 'INVALID_MFA_TOKEN', 'Invalid MFA token. Try again.');
  }

  user.mfaEnabled = true;
  user.mfaSecret = user.mfaPendingSecret;
  user.mfaBackupCodes = user.mfaPendingBackupCodes;
  user.mfaEnabledAt = new Date();
  user.mfaPendingSecret = undefined;
  user.mfaPendingBackupCodes = [];
  user.mfaPendingExpires = undefined;
  user.failedMfaAttempts = 0;
  user.mfaLockUntil = null;
  user.tokenVersion += 1;

  await user.save();

  await AuditService.log('MFA_ENABLED', user._id, req.appClient._id, req, {
    details: { stage: 'ENABLED', backupCodesCount: user.mfaBackupCodes.length }
  });

  res.status(200).json({
    message: 'MFA enabled successfully',
    mfaEnabled: true
  });
};

module.exports.verifyMfaLogin = async (req, res) => {
  const { mfaPendingToken, mfaToken } = req.body;
  const app = req.appClient;

  if (!mfaPendingToken || !mfaToken) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'mfaPendingToken and mfaToken are required');
  }

  let decoded;
  try {
    decoded = verifyMfaPendingToken(mfaPendingToken, app);
  } catch {
    throw new ApiError(401, 'INVALID_MFA_SESSION', 'MFA session expired. Please log in again.');
  }

  const user = await getMfaUser(decoded.sub, app._id);

  if (!user || !user.mfaEnabled) {
    throw new ApiError(400, 'MFA_NOT_ENABLED', 'MFA is not enabled for this account');
  }

  if (user.tokenVersion !== decoded.tokenVersion) {
    throw new ApiError(401, 'INVALID_MFA_SESSION', 'MFA session expired. Please log in again.');
  }

  if (MFAService.isMfaLocked(user)) {
    throw new ApiError(423, 'ACCOUNT_LOCKED', 'Too many failed MFA attempts. Try again later.');
  }

  const isTotpValid = MFAService.verifyToken(user.mfaSecret, mfaToken);
  let usedBackupCode = false;

  if (!isTotpValid) {
    const backupResult = MFAService.consumeBackupCode(mfaToken, user.mfaBackupCodes);

    if (!backupResult.valid) {
      await MFAService.recordFailedMfaAttempt(user);
      await AuditService.log('MFA_VERIFY_FAILURE', user._id, app._id, req, {
        details: { method: 'login' },
        status: 'FAILURE',
        riskLevel: 'MEDIUM'
      });
      throw new ApiError(401, 'INVALID_MFA_TOKEN', 'Invalid MFA token');
    }

    user.mfaBackupCodes = backupResult.remainingCodes;
    usedBackupCode = true;

    await user.save();

    await AuditService.log('BACKUP_CODE_USED', user._id, app._id, req, {
      details: {
        stage: 'LOGIN',
        backupCodesRemaining: backupResult.remainingCodes.length
      },
      riskLevel: 'MEDIUM'
    });
  }

  await MFAService.resetFailedMfaAttempts(user);

  return completeEndUserLogin(req, res, user, app, {
    method: 'mfa',
    mfaMethod: usedBackupCode ? 'backup_code' : 'totp',
    email: user.email,
    username: user.username
  });
};

module.exports.disableMfa = async (req, res) => {
  const { password, mfaToken } = req.body;
  const user = await getMfaUser(req.endUser._id, req.appClient._id);

  if (!user?.mfaEnabled) {
    throw new ApiError(400, 'MFA_NOT_ENABLED', 'MFA is not enabled for this account');
  }

  if (!password || !mfaToken) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'password and mfaToken are required');
  }

  const passwordValid = await user.verifyPassword(password);
  const totpValid = MFAService.verifyToken(user.mfaSecret, mfaToken);
  const backupValid = MFAService.verifyBackupCode(mfaToken, user.mfaBackupCodes);

  if (!passwordValid || (!totpValid && !backupValid)) {
    await AuditService.log('MFA_VERIFY_FAILURE', user._id, req.appClient._id, req, {
      details: { stage: 'DISABLE' },
      status: 'FAILURE',
      riskLevel: 'HIGH'
    });
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid password or MFA token');
  }

  user.mfaEnabled = false;
  user.mfaSecret = undefined;
  user.mfaBackupCodes = [];
  user.mfaEnabledAt = undefined;
  user.mfaPendingSecret = undefined;
  user.mfaPendingBackupCodes = [];
  user.mfaPendingExpires = undefined;
  user.failedMfaAttempts = 0;
  user.mfaLockUntil = null;
  user.tokenVersion += 1;

  await user.save();

  await AuditService.log('MFA_DISABLED', user._id, req.appClient._id, req);

  res.status(200).json({
    message: 'MFA disabled successfully',
    mfaEnabled: false
  });
};

module.exports.regenerateBackupCodes = async (req, res) => {
  const { mfaToken } = req.body;
  const user = await getMfaUser(req.endUser._id, req.appClient._id);

  if (!user?.mfaEnabled) {
    throw new ApiError(400, 'MFA_NOT_ENABLED', 'MFA is not enabled for this account');
  }

  if (!mfaToken || !MFAService.verifyToken(user.mfaSecret, mfaToken)) {
    await AuditService.log('MFA_VERIFY_FAILURE', user._id, req.appClient._id, req, {
      details: { stage: 'REGENERATE_BACKUP_CODES' },
      status: 'FAILURE',
      riskLevel: 'HIGH'
    });
    throw new ApiError(401, 'INVALID_MFA_TOKEN', 'Invalid MFA token');
  }

  const { plaintextCodes: backupCodes, hashedCodes } = MFAService.createBackupCodeSet();
  user.mfaBackupCodes = hashedCodes;
  user.tokenVersion += 1;
  await user.save();

  await AuditService.log('BACKUP_CODES_REGENERATED', user._id, req.appClient._id, req, {
    details: { count: backupCodes.length },
    riskLevel: 'HIGH'
  });

  res.status(200).json({
    message: 'Backup codes regenerated successfully',
    backupCodes
  });
};

module.exports.getMfaStatus = async (req, res) => {
  const user = await endUserBuilder.findById(req.endUser._id).select('+mfaBackupCodes');

  res.status(200).json({
    mfaEnabled: Boolean(user.mfaEnabled),
    mfaEnabledAt: user.mfaEnabledAt || null,
    backupCodesRemaining: user.mfaEnabled ? (user.mfaBackupCodes?.length || 0) : 0
  });
};
