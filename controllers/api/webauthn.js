const WebAuthnService = require('../../services/webAuthnService');
const AuditService = require('../../services/auditService');
const { completeEndUserLogin } = require('../../services/authLoginService');
const { ApiError } = require('../../utils/apiError');

module.exports.getCompatibility = async (req, res) => {
  const config = WebAuthnService.getConfig(req.appClient?.name);
  res.status(200).json({
    ...WebAuthnService.getBrowserCompatibility(),
    rpID: config.rpID,
    origin: config.origin
  });
};

module.exports.registrationOptions = async (req, res) => {
  const user = req.endUser;
  const app = req.appClient;

  if (!user.isEmailVerified && user.email) {
    throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before registering a passkey');
  }

  const { options, deviceName } = await WebAuthnService.createRegistrationOptions(
    user,
    app,
    req.body.deviceName
  );

  res.status(200).json({
    message: 'Complete passkey registration in your browser',
    options,
    deviceName
  });
};

module.exports.registrationVerify = async (req, res) => {
  const user = req.endUser;
  const app = req.appClient;
  const { credential, deviceName } = req.body;

  const record = await WebAuthnService.verifyRegistration(user, app, credential, deviceName);

  await AuditService.log('WEBAUTHN_REGISTERED', user._id, app._id, req, {
    details: {
      credentialId: record._id,
      deviceName: record.deviceName,
      credentialDeviceType: record.credentialDeviceType
    }
  });

  res.status(201).json({
    message: 'Passkey registered successfully',
    credential: {
      id: record._id,
      deviceName: record.deviceName,
      credentialDeviceType: record.credentialDeviceType,
      credentialBackedUp: record.credentialBackedUp,
      createdAt: record.createdAt
    }
  });
};

module.exports.authenticationOptions = async (req, res) => {
  const app = req.appClient;
  const { email } = req.body;

  const options = await WebAuthnService.createAuthenticationOptions(app, email);

  res.status(200).json({
    message: 'Complete passkey authentication in your browser',
    options
  });
};

module.exports.authenticationVerify = async (req, res) => {
  const app = req.appClient;
  const { credential } = req.body;

  try {
    const user = await WebAuthnService.verifyAuthentication(app, credential);

    if (user.mfaEnabled) {
      await AuditService.log('LOGIN_SUCCESS', user._id, app._id, req, {
        details: { method: 'webauthn', mfaSkipped: true },
        status: 'SUCCESS'
      });
    }

    return completeEndUserLogin(req, res, user, app, {
      method: 'webauthn',
      email: user.email,
      username: user.username
    });
  } catch (err) {
    await AuditService.log('WEBAUTHN_LOGIN_FAILURE', null, app._id, req, {
      details: { reason: err.code || err.message },
      status: 'FAILURE',
      riskLevel: 'MEDIUM'
    });
    throw err;
  }
};

module.exports.listCredentials = async (req, res) => {
  const credentials = await WebAuthnService.listCredentials(req.endUser._id, req.appClient._id);

  res.status(200).json({
    credentials: credentials.map((cred) => ({
      id: cred._id,
      deviceName: cred.deviceName,
      credentialDeviceType: cred.credentialDeviceType,
      credentialBackedUp: cred.credentialBackedUp,
      transports: cred.transports,
      lastUsedAt: cred.lastUsedAt,
      createdAt: cred.createdAt
    }))
  });
};

module.exports.updateCredential = async (req, res) => {
  const { deviceName } = req.body;
  const credential = await WebAuthnService.renameCredential(
    req.params.id,
    req.endUser._id,
    req.appClient._id,
    deviceName
  );

  res.status(200).json({
    message: 'Passkey updated successfully',
    credential: {
      id: credential._id,
      deviceName: credential.deviceName
    }
  });
};

module.exports.deleteCredential = async (req, res) => {
  const credential = await WebAuthnService.deleteCredential(
    req.params.id,
    req.endUser._id,
    req.appClient._id
  );

  await AuditService.log('WEBAUTHN_CREDENTIAL_REMOVED', req.endUser._id, req.appClient._id, req, {
    details: { credentialId: credential._id, deviceName: credential.deviceName },
    riskLevel: 'MEDIUM'
  });

  res.status(200).json({
    message: 'Passkey removed successfully'
  });
};
