// ===== Auth orchestration ======================================================
// Ties the wallet bridge and API client together into a single connect/session
// flow. The side panel should never touch chrome.storage or the wallet
// injection directly — everything goes through Auth.

const Auth = {
  async connect(chain) {
    const address = chain === "EVM" ? await Wallet.connectEvm() : await Wallet.connectSolana();
    const { message } = await Api.nonce(address, chain);
    const signature = chain === "EVM" ? await Wallet.signWithEvm(message) : await Wallet.signWithSolana(message);
    const { token, user } = await Api.verify({ address, chain, signature, message });
    await Api.setStoredAuth({ token, address, chain });
    return user;
  },

  // Returns the current user profile if a stored session is still valid, else null.
  async getSession() {
    const auth = await Api.getStoredAuth();
    if (!auth?.token) return null;
    try {
      return await Api.me();
    } catch {
      await Api.clearStoredAuth();
      return null;
    }
  },

  async getToken() {
    const auth = await Api.getStoredAuth();
    return auth?.token || null;
  },

  async logout() {
    await Api.clearStoredAuth();
  },
};
