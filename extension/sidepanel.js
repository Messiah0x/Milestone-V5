// ===== Static asset lookups (icons only — all quest/campaign/reward data now
// comes from the API; nothing reward-bearing is computed client-side) =========
const BRAND_ICONS = {
  superteam: "icons/Superteam.png",
  metamask: "icons/MetaMask.png",
  phantom: "icons/Phantom.png",
  backpack: "icons/Backpack.png",
};

const CRATE_ICONS = {
  metamask: "icons/Token crate Metamask.png",
  phantom: "icons/Token crate Phantom.png",
  backpack: "icons/Token crate Backpack.png",
};

function brandIcon(slug) {
  return BRAND_ICONS[slug] || "icons/logo.png";
}
function crateIcon(slug) {
  return CRATE_ICONS[slug] || brandIcon(slug);
}

// ===== Utils =================================================================
function $(id) { return document.getElementById(id); }

function openNewTab(url) {
  try {
    if (chrome?.tabs?.create) { chrome.tabs.create({ url }); return; }
  } catch {}
  window.open(url, "_blank", "noopener,noreferrer");
}

// ===== Toasts ================================================================
function ensureToastWrap() {
  let el = document.querySelector(".toast-wrap");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast-wrap";
    document.body.appendChild(el);
  }
  return el;
}
function showToast(msg, kind = "ok", ms = 2600) {
  const wrap = ensureToastWrap();
  const t = document.createElement("div");
  t.className = `toast toast--${kind}`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.transition = "opacity .18s ease, transform .18s ease";
    t.style.opacity = "0";
    t.style.transform = "translateY(6px)";
    setTimeout(() => t.remove(), 220);
  }, ms);
}

function reportError(err) {
  console.error(err);
  showToast(err?.message || "Something went wrong.", "error", 3200);
}

// ===== App state ==============================================================
let CAMPAIGNS = []; // [{id, name, brand:{id,name,slug,logoUrl}}]
let CURRENT_CAMPAIGN_ID = null;
let CURRENT_CRATE_BRAND = null; // {id, slug, name}

// ===== Connect Wallet gate ===================================================
function initConnectGate() {
  $("connect-evm")?.addEventListener("click", () => attemptConnect("EVM"));
  $("connect-solana")?.addEventListener("click", () => attemptConnect("SOLANA"));
}

async function attemptConnect(chain) {
  const errorEl = $("connect-error");
  errorEl?.classList.add("hidden");
  try {
    await Auth.connect(chain);
    await bootApp();
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || "Could not connect wallet.";
      errorEl.classList.remove("hidden");
    }
  }
}

function showGate() {
  $("connect-gate")?.classList.remove("hidden");
  $("app-shell")?.classList.add("hidden");
}
function showApp() {
  $("connect-gate")?.classList.add("hidden");
  $("app-shell")?.classList.remove("hidden");
}

// ===== Rank / profile ========================================================
async function renderRank() {
  const me = await Api.me();

  document.querySelectorAll("[data-username-target]").forEach((el) => {
    el.textContent = me.username || "";
  });

  const tierEl = document.querySelector(".rank-row__tier");
  const xpEl = document.querySelector(".rank-row__xp");
  const pctEl = document.querySelector(".progress__pct");
  const barEl = document.querySelector(".progress__bar");
  const iconEl = document.querySelector(".rank-icon");

  if (tierEl) tierEl.textContent = me.rank.tier;
  if (xpEl) xpEl.textContent = me.rank.xpForNextTier ? `${me.rank.xp} / ${me.rank.xpForNextTier} XP` : `${me.rank.xp} XP (max)`;
  if (pctEl) pctEl.textContent = `${me.rank.pct}%`;
  if (barEl) barEl.style.width = `${me.rank.pct}%`;
  // Only a Platinum rank icon asset ships today; reuse it as the generic rank
  // glyph until per-tier art (bronze/silver/gold/diamond) is designed.
  if (iconEl) iconEl.src = "icons/Platinum.png";

  return me;
}

function renderAvatar() {
  const img = $("profile-avatar");
  if (!img) return;
  img.src = chrome?.runtime?.getURL ? chrome.runtime.getURL("icons/Pfp.png") : "icons/Pfp.png";
}

// ===== Trending banner =======================================================
function renderTrending() {
  const list = $("trending-list");
  const clone = $("trending-clone");
  const track = $("trending-track");
  if (!list || !clone || !track) return;

  track.style.minHeight = "28px";

  const html = CAMPAIGNS.map(
    (c) => `
    <li>
      <a class="trend" href="#" data-open="${c.id}" style="padding:6px 10px;gap:6px;font-size:12px;line-height:1;">
        <img class="trend__icon" src="${brandIcon(c.brand.slug)}" alt="" style="width:14px;height:14px;object-fit:contain;border-radius:4px;" />
        <span class="trend__text">${c.brand.name}</span>
        <span class="trend__tag" style="font-size:10px;padding:1px 6px;">Trending</span>
      </a>
    </li>`,
  ).join("");

  list.innerHTML = html;
  clone.innerHTML = html;

  const startMarquee = () => {
    const distance = list.scrollWidth || 0;
    if (!distance) {
      track.style.animation = "none";
      return;
    }
    const pxPerSec = 35;
    const duration = Math.max(12, Math.round(distance / pxPerSec));
    track.style.setProperty("--scroll-px", distance + "px");
    track.style.setProperty("--trending-duration", `${duration}s`);
    track.style.animation = "none";
    void track.offsetHeight;
    track.style.animation = "";
  };

  startMarquee();
  requestAnimationFrame(startMarquee);
  window.addEventListener("resize", startMarquee, { passive: true });

  track.addEventListener("click", (e) => {
    const a = e.target.closest("a.trend[data-open]");
    if (!a) return;
    e.preventDefault();
    openDetail(a.getAttribute("data-open"));
  });
}

// ===== Chips + Recommended cards =============================================
function renderChipRow() {
  const row = $("rec-chips");
  if (!row) return;

  row.innerHTML = CAMPAIGNS.map(
    (c) => `
    <button class="chip" data-chip="${c.id}" type="button">
      <img class="chip__icon" src="${brandIcon(c.brand.slug)}" alt="" />
      ${c.brand.name}
    </button>`,
  ).join("");

  row.addEventListener("click", (e) => {
    const t = e.target.closest(".chip");
    if (!t) return;
    const id = t.getAttribute("data-chip");
    row.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
    t.classList.add("is-active");
    highlightCard(id);
  });
}

async function renderCards() {
  const wrap = $("rec-cards");
  if (!wrap) return;
  wrap.innerHTML = `<p class="muted">Loading campaigns…</p>`;

  const withCounts = await Promise.all(
    CAMPAIGNS.map(async (c) => {
      try {
        const quests = await Api.getCampaignQuests(c.id);
        const total = quests.quests.length;
        const completed = quests.quests.filter((q) => q.status === "VERIFIED").length;
        return { ...c, completed, total };
      } catch {
        return { ...c, completed: 0, total: 0 };
      }
    }),
  );

  wrap.innerHTML = "";
  withCounts.forEach((c) => {
    const pct = c.total ? Math.round((c.completed / c.total) * 100) : 0;
    const card = document.createElement("article");
    card.className = "rec-card";
    card.dataset.campaignId = c.id;
    card.innerHTML = `
      <div class="rec-card__header">
        <div class="rec-card__title-row">
          <img class="rec-card__icon" src="${brandIcon(c.brand.slug)}" alt="${c.brand.name} icon" />
          <div class="rec-card__title">${c.brand.name}</div>
        </div>
        <div class="rec-card__meta">${c.completed}/${c.total} completed</div>
      </div>
      <div class="rec-card__progress">
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
          <div class="progress__bar" style="width:${pct}%"></div>
        </div>
        <div class="progress__pct">${pct}%</div>
      </div>
      <button class="btn btn--secondary rec-card__cta" data-open-detail="${c.id}" type="button">View quests</button>
    `;
    wrap.appendChild(card);
    card.querySelector("[data-open-detail]")?.addEventListener("click", () => openDetail(c.id));
  });
}

function highlightCard(campaignId) {
  document.querySelectorAll(".rec-card").forEach((c) => {
    c.classList.toggle("rec-card--highlight", c.dataset.campaignId === campaignId);
  });
}

// ===== Quest detail view ======================================================
async function openDetail(campaignId) {
  CURRENT_CAMPAIGN_ID = campaignId;
  const list = $("rec-list-view");
  const detail = $("rec-detail-view");
  if (!list || !detail) return;

  detail.innerHTML = `<p class="muted">Loading quests…</p>`;
  list.classList.add("hidden");
  detail.classList.remove("hidden");

  await renderQuestDetail(campaignId);
  sizeRecommendedScrollArea();
}

async function renderQuestDetail(campaignId) {
  const detail = $("rec-detail-view");
  if (!detail) return;

  let data;
  try {
    data = await Api.getCampaignQuests(campaignId);
  } catch (err) {
    detail.innerHTML = `<p class="error">Failed to load quests.</p>`;
    reportError(err);
    return;
  }

  const total = data.quests.length;
  const completed = data.quests.filter((q) => q.status === "VERIFIED").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  const items = data.quests
    .map((q) => {
      const statusLabel =
        q.status === "VERIFIED" ? "Completed" : q.status === "PENDING" ? "Pending review" : q.status === "REJECTED" ? "Not yet — try again" : "Not started";
      const stateClass = q.status === "VERIFIED" ? "quest--done" : "quest--todo";

      let action = "";
      if (q.status !== "VERIFIED") {
        if (q.targetUrl) {
          action = `<button class="quest__action" data-visit="${q.id}" data-href="${q.targetUrl}" type="button">Open</button>`;
        } else {
          action = `<button class="quest__action" data-complete="${q.id}" type="button">${q.status === "PENDING" ? "Check again" : "Complete"}</button>`;
        }
      }

      return `
      <li class="quest ${stateClass}">
        <span class="quest__check" aria-hidden="true"></span>
        <span class="quest__title">${q.title} <span class="quest__status">+${q.xpReward} XP</span></span>
        <span class="quest__status">${statusLabel}</span>
        ${action}
      </li>`;
    })
    .join("");

  detail.innerHTML = `
    <div class="detail__header">
      <button class="btn btn--ghost btn--sm" id="detail-back" type="button">← Back</button>
      <div class="detail__title">${data.brand.name} <span class="detail__meta">${completed}/${total} · ${pct}%</span></div>
    </div>
    <ul class="quest-list">${items}</ul>
  `;

  $("detail-back")?.addEventListener("click", showList);

  detail.querySelectorAll("[data-visit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      openNewTab(btn.getAttribute("data-href"));
      // Visit-link quests auto-verify server-side on completion; call it once opened.
      await completeQuest(btn.getAttribute("data-visit"), campaignId);
    });
  });
  detail.querySelectorAll("[data-complete]").forEach((btn) => {
    btn.addEventListener("click", () => completeQuest(btn.getAttribute("data-complete"), campaignId));
  });
}

async function completeQuest(questId, campaignId) {
  try {
    const outcome = await Api.completeQuest(questId);
    if (outcome.status === "VERIFIED") showToast("Quest complete!", "ok");
    else if (outcome.status === "PENDING") showToast("Submitted for review.", "warn");
    else showToast(outcome.reason || "Not verified yet.", "warn");

    await renderQuestDetail(campaignId);
    await renderRank();
    await renderCards();
  } catch (err) {
    reportError(err);
  }
}

function showList() {
  const list = $("rec-list-view");
  const detail = $("rec-detail-view");
  if (!list || !detail) return;
  detail.innerHTML = "";
  detail.classList.add("hidden");
  list.classList.remove("hidden");
  sizeRecommendedScrollArea();
}

// ===== Token crates ==========================================================
async function showCratesModal(show = true) {
  const modal = $("crates-modal");
  if (!modal) return;
  modal.classList.toggle("hidden", !show);
  if (show) {
    $("crates-select-view")?.classList.remove("hidden");
    $("crates-open-view")?.classList.add("hidden");
    await renderCrateGrid();
  }
}

async function renderCrateGrid() {
  const grid = $("crates-grid");
  if (!grid) return;
  grid.innerHTML = `<p class="muted">Loading…</p>`;

  const [brands, balance] = await Promise.all([Api.getBrands(), Api.getCrateBalance()]);
  const countBySlug = new Map(balance.items.map((b) => [b.brandSlug, b.count]));

  grid.innerHTML = "";
  brands.items.forEach((b) => {
    const count = countBySlug.get(b.slug) || 0;
    const btn = document.createElement("button");
    btn.className = "crate-card";
    btn.innerHTML = `
      <img class="crate-card__img" src="${crateIcon(b.slug)}" alt="${b.name} crate" />
      <div class="crate-card__name">${b.name}</div>
      <div class="crate-card__count">x${count}</div>
    `;
    btn.addEventListener("click", () => openCompanyCrates(b));
    grid.appendChild(btn);
  });
}

async function openCompanyCrates(brand) {
  CURRENT_CRATE_BRAND = brand;

  $("crates-company-title").textContent = brand.name;
  $("crates-select-view")?.classList.add("hidden");
  $("crates-open-view")?.classList.remove("hidden");
  $("crates-result")?.classList.add("hidden");
  $("crates-reward").textContent = "";

  await refreshCrateCount();
  await renderInventory();
}

async function refreshCrateCount() {
  if (!CURRENT_CRATE_BRAND) return;
  const balance = await Api.getCrateBalance();
  const entry = balance.items.find((b) => b.brandId === CURRENT_CRATE_BRAND.id);
  const count = entry?.count || 0;
  $("crates-company-count").textContent = String(count);
  $("crates-count-inline").textContent = String(count);
}

async function openOneCrate() {
  if (!CURRENT_CRATE_BRAND) return;

  const crate = $("crates-crate");
  crate?.classList.add("is-opening");
  setTimeout(() => crate?.classList.remove("is-opening"), 700);

  try {
    const reward = await Api.openCrate(CURRENT_CRATE_BRAND.id);
    await refreshCrateCount();
    await renderCrateGrid().catch(() => {}); // best-effort refresh of the grid counts underneath

    const result = $("crates-result");
    const out = $("crates-reward");
    if (out) {
      out.innerHTML = `
        <div class="reward__title"><strong>${reward.tier}</strong> — +${reward.amount} tokens</div>
        <div class="reward__meta">Saved to inventory</div>
      `;
    }
    result?.classList.remove("hidden");
    showToast(`+${reward.amount} tokens · ${reward.tier}`, "ok");
    await renderInventory();
  } catch (err) {
    reportError(err);
  }
}

async function renderInventory() {
  const body = $("crates-body");
  if (!body) return;

  let wrap = $("inventory-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "inventory-wrap";
    wrap.style.marginTop = "8px";
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin:8px 0;">
        <div style="font-weight:800;">Recent Rewards</div>
      </div>
      <ul id="inventory-list" style="list-style:none;padding:0;margin:0;display:grid;gap:6px;"></ul>
    `;
    body.appendChild(wrap);
  }

  const listEl = $("inventory-list");
  const inv = await Api.getInventory();

  if (!inv.items.length) {
    listEl.innerHTML = `<li style="opacity:.75;font-size:13px;">No rewards yet. Open a crate!</li>`;
    return;
  }

  listEl.innerHTML = inv.items
    .map((e) => {
      const time = new Date(e.createdAt).toLocaleString();
      const tagStyle = `display:inline-block;padding:2px 8px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.06);font-size:11px;margin-left:8px;`;
      return `
        <li class="inv-item" style="padding:8px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:rgba(255,255,255,.04);display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;">
          <div>
            <div style="font-weight:700;">${e.brand} <span style="${tagStyle}">${e.tier}</span></div>
            <div style="font-size:12px;opacity:.75;">${time}</div>
          </div>
          <div style="font-weight:800;">+${e.amount}</div>
        </li>`;
    })
    .join("");
}

// ===== Sticky & Scroll sizing helpers (layout-only, unchanged from original) =
function updateStickyOffsets() {
  const topbar = document.querySelector(".topbar");
  const rank = document.querySelector('.card[aria-labelledby="rank-title"]');
  const trending = document.querySelector(".card.card--trending");

  const topbarH = topbar ? topbar.offsetHeight : 0;
  if (topbarH) document.documentElement.style.setProperty("--topbar-h", `${topbarH}px`);

  const rankH = rank ? rank.offsetHeight : 0;
  const stickyBase = topbarH + rankH + 8;
  document.documentElement.style.setProperty("--dock-trending-top", `${stickyBase}px`);

  const trendingH = trending ? trending.offsetHeight + 8 : 148;
  const recTop = stickyBase + trendingH;
  document.documentElement.style.setProperty("--dock-rec-top", `${recTop}px`);
}

function watchTrendingSticky() {
  const el = document.querySelector(".card.card--trending");
  if (!el) return;
  const obs = new IntersectionObserver(
    ([entry]) => {
      const stickyTop = parseFloat(getComputedStyle(el).top) || 0;
      const isAtTop = el.getBoundingClientRect().top <= stickyTop + 0.5;
      el.classList.toggle("is-stuck", entry.intersectionRatio < 1 && isAtTop);
    },
    { threshold: [1] },
  );
  obs.observe(el);
}

function sizeRecommendedScrollArea() {
  const cards = $("rec-cards");
  const detail = $("rec-detail-view");
  if (!cards || !detail) return;

  const rect = cards.getBoundingClientRect();
  const SAFE_PAD = 12;
  const available = Math.max(120, window.innerHeight - rect.top - SAFE_PAD);

  document.documentElement.style.setProperty("--rec-scroll-h", available + "px");
  cards.style.height = available + "px";
  detail.style.height = available + "px";
}

function attachScrollSizing() {
  const scroller = document.querySelector("main.content") || window;
  scroller.addEventListener("scroll", sizeRecommendedScrollArea, { passive: true });
}

// ===== Profile & Upgrade modals ==============================================
function usernameIsValid(name) {
  return /^[a-zA-Z0-9_]{3,24}$/.test(name);
}

async function openProfileModal() {
  const modal = $("profile-modal");
  if (!modal) return;
  const input = $("username-input");
  try {
    const me = await Api.me();
    if (input) input.value = me.username || "";
  } catch (err) {
    reportError(err);
  }
  modal.classList.remove("hidden");
}
function closeProfileModal() {
  $("profile-modal")?.classList.add("hidden");
}
async function confirmProfile() {
  const input = $("username-input");
  const hint = $("username-hint");
  const name = (input?.value || "").trim();
  if (!usernameIsValid(name)) {
    if (hint) {
      hint.textContent = "Invalid username. Use 3–24 letters, numbers, or underscores.";
      hint.style.color = "#f87171";
    }
    return;
  }
  try {
    await Api.setUsername(name);
    if (hint) { hint.textContent = "Saved!"; hint.style.color = ""; }
    closeProfileModal();
    showToast("Username saved.", "ok");
    await renderRank();
  } catch (err) {
    if (hint) {
      hint.textContent = err.message;
      hint.style.color = "#f87171";
    }
  }
}

async function linkDiscord() {
  const token = await Auth.getToken();
  if (!token) return;
  openNewTab(Api.discordLinkUrl(token));
}
async function linkTelegram() {
  const token = await Auth.getToken();
  if (!token) return;
  openNewTab(Api.telegramLinkUrl(token));
}

function openUpgradeModal() { $("upgrade-modal")?.classList.remove("hidden"); }
function closeUpgradeModal() { $("upgrade-modal")?.classList.add("hidden"); }

async function selectPlan(plan) {
  if (plan === "basic") {
    closeUpgradeModal();
    showToast("Basic is the default plan.", "ok");
    return;
  }
  try {
    const { url } = await Api.createCheckoutSession();
    closeUpgradeModal();
    if (url) openNewTab(url);
    else showToast("Billing isn't configured yet.", "warn");
  } catch (err) {
    reportError(err);
  }
}

// ===== Boot ===================================================================
async function bootApp() {
  showApp();

  const trending = await Api.getTrendingCampaigns();
  CAMPAIGNS = trending.items;

  await renderRank();
  renderAvatar();
  renderChipRow();
  renderTrending();
  await renderCards();

  requestAnimationFrame(() => {
    updateStickyOffsets();
    sizeRecommendedScrollArea();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  updateStickyOffsets();
  watchTrendingSticky();
  window.addEventListener("resize", updateStickyOffsets);
  window.addEventListener("load", updateStickyOffsets);
  window.addEventListener("resize", sizeRecommendedScrollArea);
  window.addEventListener("load", sizeRecommendedScrollArea);
  attachScrollSizing();

  initConnectGate();

  const session = await Auth.getSession().catch(() => null);
  if (session) {
    await bootApp().catch(reportError);
  } else {
    showGate();
  }

  // Token Crates modal
  $("open-crates")?.addEventListener("click", () => showCratesModal(true));
  $("crates-close")?.addEventListener("click", () => showCratesModal(false));
  $("crates-x")?.addEventListener("click", () => showCratesModal(false));
  $("crates-back")?.addEventListener("click", () => {
    $("crates-open-view")?.classList.add("hidden");
    $("crates-select-view")?.classList.remove("hidden");
    $("crates-result")?.classList.add("hidden");
  });
  $("crates-open")?.addEventListener("click", openOneCrate);
  $("crates-open-another")?.addEventListener("click", openOneCrate);

  $("view-all")?.addEventListener("click", async () => {
    const url = chrome.runtime.getURL("sidepanel.html");
    await chrome.tabs.create({ url });
  });

  $("profile-close")?.addEventListener("click", closeProfileModal);
  $("profile-cancel")?.addEventListener("click", closeProfileModal);
  $("profile-confirm")?.addEventListener("click", confirmProfile);
  $("profile-button")?.addEventListener("click", openProfileModal);
  $("link-discord")?.addEventListener("click", linkDiscord);
  $("link-telegram")?.addEventListener("click", linkTelegram);

  $("upgrade-btn")?.addEventListener("click", openUpgradeModal);
  $("upgrade-close")?.addEventListener("click", closeUpgradeModal);
  $("upgrade-cancel")?.addEventListener("click", closeUpgradeModal);
  $("select-basic")?.addEventListener("click", () => selectPlan("basic"));
  $("select-verified")?.addEventListener("click", () => selectPlan("verified"));
});
