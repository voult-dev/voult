const mockUsers = new Map();

function mockFindUser(query = {}) {
  for (const user of mockUsers.values()) {
    const idMatch = !query._id || String(user._id) === String(query._id);
    const appMatch = !query.app || String(user.app) === String(query.app);
    if (idMatch && appMatch) {
      return user;
    }
  }
  return null;
}

function mockCreateUser(overrides = {}) {
  const user = {
    _id: overrides._id || '507f1f77bcf86cd799439011',
    app: overrides.app || '507f1f77bcf86cd799439012',
    email: 'mfa-user@example.com',
    username: 'mfauser',
    tokenVersion: 0,
    mfaEnabled: false,
    mfaBackupCodes: [],
    mfaPendingBackupCodes: [],
    failedMfaAttempts: 0,
    mfaLockUntil: null,
    verifyPassword: jest.fn().mockResolvedValue(true),
    save: jest.fn().mockImplementation(async function save() {
      mockUsers.set(String(this._id), this);
      return this;
    }),
    ...overrides
  };

  mockUsers.set(String(user._id), user);
  return user;
}

function resetMockUsers() {
  mockUsers.clear();
}

module.exports = {
  mockUsers,
  mockFindUser,
  mockCreateUser,
  resetMockUsers
};
