const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { constantTimeCompare } = require('../utils/constantTimeComparison');

const MFA_SETUP_TTL_MS = 10 * 60 * 1000;
const MAX_FAILED_MFA_ATTEMPTS = 5;
const MFA_LOCK_TIME_MS = 15 * 60 * 1000;

class MFAService {
  static generateSecret(userEmail, appName = 'Voult') {
    const label = userEmail || 'user';
    return speakeasy.generateSecret({
      name: `${appName} (${label})`,
      issuer: appName,
      length: 32
    });
  }

  static async generateQRCode(secret) {
    return QRCode.toDataURL(secret.otpauth_url);
  }

  static verifyToken(secret, token) {
    if (!secret || !token) {
      return false;
    }

    const normalizedToken = String(token).replace(/\s/g, '');
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: normalizedToken,
      window: 2
    });
  }

  static generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i += 1) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  static normalizeBackupCode(code) {
    return String(code || '').trim().toUpperCase();
  }

  static hashBackupCode(code) {
    return crypto
      .createHash('sha256')
      .update(this.normalizeBackupCode(code))
      .digest('hex');
  }

  static hashBackupCodes(codes) {
    return codes.map((code) => this.hashBackupCode(code));
  }

  static verifyBackupCode(code, hashedCodes = []) {
    const hashedInput = this.hashBackupCode(code);
    return hashedCodes.some((storedHash) => constantTimeCompare(storedHash, hashedInput));
  }

  static consumeBackupCode(code, hashedCodes = []) {
    const hashedInput = this.hashBackupCode(code);
    const index = hashedCodes.findIndex((storedHash) => constantTimeCompare(storedHash, hashedInput));

    if (index === -1) {
      return { valid: false, remainingCodes: hashedCodes };
    }

    const remainingCodes = [...hashedCodes];
    remainingCodes.splice(index, 1);
    return { valid: true, remainingCodes };
  }

  static getSetupExpiry() {
    return new Date(Date.now() + MFA_SETUP_TTL_MS);
  }

  static isSetupExpired(expiresAt) {
    return !expiresAt || expiresAt.getTime() <= Date.now();
  }

  static async recordFailedMfaAttempt(user) {
    user.failedMfaAttempts = (user.failedMfaAttempts || 0) + 1;

    if (user.failedMfaAttempts >= MAX_FAILED_MFA_ATTEMPTS) {
      user.mfaLockUntil = new Date(Date.now() + MFA_LOCK_TIME_MS);
    }

    await user.save();
  }

  static async resetFailedMfaAttempts(user) {
    user.failedMfaAttempts = 0;
    user.mfaLockUntil = null;
    await user.save();
  }

  static isMfaLocked(user) {
    return Boolean(user.mfaLockUntil && user.mfaLockUntil > Date.now());
  }
}

module.exports = MFAService;
