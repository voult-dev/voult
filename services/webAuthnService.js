const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');

const WebAuthnCredential = require('../models/webAuthnCredential');
const WebAuthnChallenge = require('../models/webAuthnChallenge');
const { SafeQueryBuilder } = require('../middleware/queryValidation');
const { ApiError } = require('../utils/apiError');

const credentialBuilder = new SafeQueryBuilder(WebAuthnCredential);
const challengeBuilder = new SafeQueryBuilder(WebAuthnChallenge);

const SUPPORTED_ALGORITHMS = [-8, -7, -257];

function getWebAuthnConfig(appName) {
  const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').trim();
  let hostname = 'localhost';

  try {
    hostname = new URL(baseUrl).hostname;
  } catch {
    hostname = 'localhost';
  }

  return {
    rpName: process.env.WEBAUTHN_RP_NAME || appName || 'Voult',
    rpID: process.env.WEBAUTHN_RP_ID || hostname,
    origin: (process.env.WEBAUTHN_ORIGIN || baseUrl).replace(/\/$/, '')
  };
}

function userIdToBuffer(userId) {
  return Buffer.from(String(userId));
}

class WebAuthnService {
  static getConfig(appName) {
    return getWebAuthnConfig(appName);
  }

  static async listCredentials(endUserId, appId) {
    return credentialBuilder.find({
      endUser: endUserId,
      app: appId
    }).select('-publicKey -webauthnUserId').sort({ createdAt: -1 });
  }

  static async getCredentialById(credentialId, endUserId, appId) {
    return credentialBuilder.findOne({
      _id: credentialId,
      endUser: endUserId,
      app: appId
    }).select('+publicKey');
  }

  static async getCredentialByWebAuthnId(webAuthnCredentialId, appId) {
    return credentialBuilder.findOne({
      credentialId: webAuthnCredentialId,
      app: appId
    }).select('+publicKey +webauthnUserId');
  }

  static async createRegistrationOptions(user, app, deviceName) {
    const { rpName, rpID } = getWebAuthnConfig(app.name);
    const existing = await credentialBuilder.find({
      endUser: user._id,
      app: app._id
    }).select('credentialId transports');

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email || user.username || String(user._id),
      userDisplayName: user.fullName || user.email || user.username || 'User',
      userID: userIdToBuffer(user._id),
      attestationType: 'none',
      excludeCredentials: existing.map((cred) => ({
        id: cred.credentialId,
        transports: cred.transports
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform'
      },
      supportedAlgorithmIDs: SUPPORTED_ALGORITHMS
    });

    await WebAuthnChallenge.createChallenge({
      challenge: options.challenge,
      type: 'registration',
      app: app._id,
      endUser: user._id,
      email: user.email
    });

    return { options, deviceName: deviceName || 'Passkey' };
  }

  static async verifyRegistration(user, app, response, deviceName) {
    const { origin, rpID } = getWebAuthnConfig(app.name);

    const storedChallenge = await challengeBuilder.findOne({
      type: 'registration',
      app: app._id,
      endUser: user._id
    }).sort({ createdAt: -1 });

    if (!storedChallenge || storedChallenge.expiresAt <= new Date()) {
      throw new ApiError(400, 'WEBAUTHN_CHALLENGE_EXPIRED', 'Registration challenge expired. Start again.');
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: storedChallenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        supportedAlgorithmIDs: SUPPORTED_ALGORITHMS
      });
    } catch (err) {
      throw new ApiError(400, 'WEBAUTHN_REGISTRATION_FAILED', err.message || 'Registration verification failed');
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new ApiError(400, 'WEBAUTHN_REGISTRATION_FAILED', 'Passkey registration could not be verified');
    }

    const { credential, aaguid, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    const duplicate = await credentialBuilder.findOne({ credentialId: credential.id });
    if (duplicate) {
      throw new ApiError(409, 'WEBAUTHN_CREDENTIAL_EXISTS', 'This passkey is already registered');
    }

    const record = await WebAuthnCredential.create({
      endUser: user._id,
      app: app._id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports || [],
      deviceName: deviceName || 'Passkey',
      aaguid,
      credentialDeviceType,
      credentialBackedUp,
      webauthnUserId: userIdToBuffer(user._id).toString('base64url')
    });

    await challengeBuilder.deleteMany({
      type: 'registration',
      app: app._id,
      endUser: user._id
    });

    return record;
  }

  static async createAuthenticationOptions(app, email) {
    const { rpID } = getWebAuthnConfig(app.name);
    let allowCredentials = [];
    let endUserId = null;
    let normalizedEmail = null;

    if (email) {
      const EndUser = require('../models/endUser');
      const endUserBuilder = new SafeQueryBuilder(EndUser);
      normalizedEmail = String(email).trim().toLowerCase();

      const user = await endUserBuilder.findOne({
        app: app._id,
        email: normalizedEmail,
        deletedAt: null,
        isActive: true
      });

      if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'No account found for this email');
      }

      endUserId = user._id;
      const credentials = await credentialBuilder.find({
        endUser: user._id,
        app: app._id
      }).select('credentialId transports');

      if (!credentials.length) {
        throw new ApiError(400, 'WEBAUTHN_NOT_REGISTERED', 'No passkeys registered for this account');
      }

      allowCredentials = credentials.map((cred) => ({
        id: cred.credentialId,
        transports: cred.transports
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred'
    });

    await WebAuthnChallenge.createChallenge({
      challenge: options.challenge,
      type: 'authentication',
      app: app._id,
      endUser: endUserId,
      email: normalizedEmail
    });

    return options;
  }

  static async verifyAuthentication(app, response) {
    const { origin, rpID } = getWebAuthnConfig(app.name);

    const latestChallenge = await challengeBuilder.findOne({
      type: 'authentication',
      app: app._id
    }).sort({ createdAt: -1 });

    if (!latestChallenge || latestChallenge.expiresAt <= new Date()) {
      throw new ApiError(400, 'WEBAUTHN_CHALLENGE_EXPIRED', 'Authentication challenge expired. Start again.');
    }

    const credential = await credentialBuilder.findOne({
      credentialId: response.id,
      app: app._id
    }).select('+publicKey +webauthnUserId');

    if (!credential) {
      throw new ApiError(401, 'WEBAUTHN_CREDENTIAL_UNKNOWN', 'Unknown passkey');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: latestChallenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credential.credentialId,
          publicKey: credential.publicKey,
          counter: credential.counter,
          transports: credential.transports
        }
      });
    } catch (err) {
      throw new ApiError(401, 'WEBAUTHN_AUTHENTICATION_FAILED', err.message || 'Passkey verification failed');
    }

    if (!verification.verified) {
      throw new ApiError(401, 'WEBAUTHN_AUTHENTICATION_FAILED', 'Passkey verification failed');
    }

    const { newCounter } = verification.authenticationInfo;
    credential.counter = newCounter;
    credential.lastUsedAt = new Date();
    await credential.save();

    await challengeBuilder.deleteMany({
      type: 'authentication',
      app: app._id,
      endUser: credential.endUser
    });

    const EndUser = require('../models/endUser');
    const endUserBuilder = new SafeQueryBuilder(EndUser);
    const user = await endUserBuilder.findById(credential.endUser);

    if (!user || !user.isActive) {
      throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
    }

    return user;
  }

  static async renameCredential(credentialId, endUserId, appId, deviceName) {
    const credential = await credentialBuilder.findOne({
      _id: credentialId,
      endUser: endUserId,
      app: appId
    });

    if (!credential) {
      throw new ApiError(404, 'WEBAUTHN_CREDENTIAL_NOT_FOUND', 'Passkey not found');
    }

    credential.deviceName = deviceName;
    await credential.save();
    return credential;
  }

  static async deleteCredential(credentialId, endUserId, appId) {
    const credential = await credentialBuilder.findOne({
      _id: credentialId,
      endUser: endUserId,
      app: appId
    });

    if (!credential) {
      throw new ApiError(404, 'WEBAUTHN_CREDENTIAL_NOT_FOUND', 'Passkey not found');
    }

    await credential.deleteOne();
    return credential;
  }

  static getBrowserCompatibility() {
    return {
      chrome: { minVersion: 67, passkeys: true, platform: 'desktop, android' },
      firefox: { minVersion: 60, passkeys: true, platform: 'desktop' },
      safari: { minVersion: 13, passkeys: true, platform: 'macOS, iOS' },
      edge: { minVersion: 18, passkeys: true, platform: 'desktop' },
      algorithms: SUPPORTED_ALGORITHMS.map((alg) => ({
        id: alg,
        name: alg === -7 ? 'ES256' : alg === -257 ? 'RS256' : 'EdDSA'
      })),
      notes: [
        'Requires HTTPS in production (localhost exempt for development)',
        'rpID must match the site hostname (see WEBAUTHN_RP_ID)',
        'Use @simplewebauthn/browser on the client for cross-browser support'
      ]
    };
  }
}

module.exports = WebAuthnService;
