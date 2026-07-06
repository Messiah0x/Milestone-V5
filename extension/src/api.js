// ===== Milestone API client ===================================================
// Thin fetch wrapper: attaches the stored session JWT, talks to the real
// backend. The side panel never computes rewards/XP itself anymore — it only
// renders whatever the server returns.

const AUTH_STORAGE_KEY = "milestoneAuth:v1";

async function getStoredAuth() {
  const data = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  return data[AUTH_STORAGE_KEY] || null;
}

async function setStoredAuth(auth) {
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: auth });
}

async function clearStoredAuth() {
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
}

async function apiFetch(path, options = {}) {
  const auth = await getStoredAuth();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    await clearStoredAuth();
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = body?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

const Api = {
  // Auth
  getStoredAuth,
  setStoredAuth,
  clearStoredAuth,
  nonce: (address, chain) => apiFetch("/api/auth/nonce", { method: "POST", body: JSON.stringify({ address, chain }) }),
  verify: (payload) => apiFetch("/api/auth/verify", { method: "POST", body: JSON.stringify(payload) }),
  me: () => apiFetch("/api/auth/me"),

  // Users
  setUsername: (username) => apiFetch("/api/users/me", { method: "PATCH", body: JSON.stringify({ username }) }),
  getBalance: () => apiFetch("/api/users/me/balance"),
  getInventory: (cursor) => apiFetch(`/api/users/me/inventory${cursor ? `?cursor=${cursor}` : ""}`),

  // Brands / campaigns / quests
  getBrands: () => apiFetch("/api/brands"),
  getTrendingCampaigns: () => apiFetch("/api/campaigns/trending"),
  getCampaignQuests: (campaignId) => apiFetch(`/api/campaigns/${campaignId}/quests`),
  completeQuest: (questId) => apiFetch(`/api/quests/${questId}/complete`, { method: "POST" }),

  // Crates
  getCrateBalance: () => apiFetch("/api/crates/balance"),
  openCrate: (brandId) => apiFetch(`/api/crates/${brandId}/open`, { method: "POST" }),

  // Billing
  createCheckoutSession: () => apiFetch("/api/billing/checkout", { method: "POST" }),

  // Account linking (opened in a full tab, not fetch-able cross-origin)
  discordLinkUrl: (token) => `${API_BASE_URL}/api/link/discord/start?token=${encodeURIComponent(token)}`,
  telegramLinkUrl: (token) => `${API_BASE_URL}/link/telegram?token=${encodeURIComponent(token)}`,
};
