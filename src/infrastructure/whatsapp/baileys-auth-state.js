const {
  initAuthCreds,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");

async function createPostgresAuthState({ senderId, authRepository, logger }) {
  let creds = await authRepository.getCredsBySenderId(senderId);

  if (!creds) {
    creds = initAuthCreds();
    await authRepository.upsertCreds(senderId, creds);
  }

  const rawKeyStore = {
    async get(type, ids) {
      const data = await authRepository.getKeys(senderId, type, ids);
      return data;
    },

    async set(data) {
      await authRepository.setKeys(senderId, data);
    },

    async clear() {
      await authRepository.deleteAuthBySenderId(senderId);
    },
  };

  return {
    state: {
      creds,
      keys: makeCacheableSignalKeyStore(rawKeyStore, logger),
    },
    saveCreds: async () => {
      await authRepository.upsertCreds(senderId, creds);
    },
  };
}

module.exports = createPostgresAuthState;