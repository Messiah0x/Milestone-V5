// ===== User profile (placeholder) ============================================
const USER = {
  avatar: "icons/Pfp.png",
  profileUrl: "https://example.com/me",
};

// Populate username under avatar on load
(() => {
  const u = loadUser?.() || {};
  document.querySelectorAll("[data-username-target]").forEach(el => {
    el.textContent = u.username || "";
  });
})();

// ===== Data ==================================================================
const chipItems = [
  { id: "Superteam", name: "Superteam" },
  { id: "Metamask", name: "MetaMask" },
  { id: "Phantom",  name: "Phantom"  },
  { id: "Backpack", name: "Backpack" },
];

const cardItems = [
  { id: "superteam", name: "Superteam", questsCompleted: 4, questsTotal: 7 },
  { id: "metamask", name: "MetaMask", questsCompleted: 3, questsTotal: 7 },
  { id: "phantom",  name: "Phantom",  questsCompleted: 6, questsTotal: 7 },
  { id: "backpack", name: "Backpack", questsCompleted: 2, questsTotal: 7 },
];

const phantomQuests = [
  { id: "q1", title: "Follow on Milestone", done: true },
  { id: "q2", title: "Follow on X", done: false, action: { type: "link", href: "https://x.com/phantom" } },
  { id: "q3", title: "Visit the Phantom website", done: true, action: { type: "link", href: "https://phantom.app" } },
  { id: "q4", title: "Join the Discord", done: true, action: { type: "link", href: "https://discord.gg/phantom" } },
  { id: "q5", title: "Interaction with Discord announcement", done: true },
  { id: "q6", title: "Send 10 messages in general chat", done: true },
  { id: "q7", title: "Daily check in", done: false },
];
// ===== Superteam quests (Telegram instead of Discord) =======================
const superteamQuests = [
  { id: "st1", title: "Follow on Milestone", done: true },
  { id: "st2", title: "Follow on X", done: false, action: { type: "link", href: "https://x.com/SuperteamCAN" } },
  { id: "st3", title: "Visit the Superteam website", done: true, action: { type: "link", href: "https://superteam.ca/" } },
  { id: "st4", title: "Join the Telegram", done: true, action: { type: "link", href: "https://t.me/+OiHA8PF5ccRkMWM0" } },
  { id: "st5", title: "Interaction with Telegram announcement", done: true },
  { id: "st6", title: "Send 10 messages in Telegram general chat", done: false },
  { id: "st7", title: "Daily check in", done: false },
];

const COMPANY_META = [
  { key: "superteam", name: "Superteam", img: "icons/Token crate Superteam.png" },
  { key: "metamask", name: "MetaMask", img: "icons/Token crate Metamask.png" },
  { key: "phantom",  name: "Phantom",  img: "icons/Token crate Phantom.png"  },
  { key: "backpack", name: "Backpack", img: "icons/Token crate Backpack.png" },
];

// ===== Brand Icons for Recommended cards =====================================
const BRAND_ICONS = {
  Superteam: "icons/Superteam.png",
  MetaMask: "icons/MetaMask.png",
  Phantom:  "icons/Phantom.png",
  Backpack: "icons/Backpack.png",
};

// ===== Trending Now data =====================================================
const TRENDING = [
  { label: "Superteam", tag: "Trending", icon: "icons/Superteam.png", openId: "superteam" }, // NEW (goes first)
  { label: "MetaMask",  tag: "Trending", icon: "icons/MetaMask.png",  openId: "metamask" },
  { label: "Phantom",   tag: "Trending", icon: "icons/Phantom.png",   openId: "phantom"  },
  { label: "Backpack",  tag: "Trending", icon: "icons/Backpack.png",  openId: "backpack" },
];


// ===== Utils =================================================================
function $(id) { return document.getElementById(id); }

function openNewTab(url) {
  try {
    if (chrome?.tabs?.create) { chrome.tabs.create({ url }); return; }
  } catch {}
  window.open(url, "_blank", "noopener,noreferrer");
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

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
function showToast(msg, kind = "ok", ms = 2200) {
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

// ===== Trending banner renderer =============================================
// ===== Trending banner renderer (robust + compact) ==========================
function renderTrending() {
  const list  = $("trending-list");
  const clone = $("trending-clone");
  const track = $("trending-track");
  if (!list || !clone || !track) return;

  // Ensure the strip always has some height (prevents “invisible” row)
  track.style.minHeight = "28px";

  // Build compact pills; icon is optional
  const html = (Array.isArray(TRENDING) ? TRENDING : []).map(item => `
    <li>
      <a class="trend" href="#" ${item.openId ? `data-open="${item.openId}"` : ""} style="padding:6px 10px;gap:6px;font-size:12px;line-height:1;">
        ${item.icon ? `<img class="trend__icon" src="${item.icon}" alt="" style="width:14px;height:14px;object-fit:contain;border-radius:4px;" />` : ""}
        <span class="trend__text">${item.label ?? ""}</span>
        ${item.tag ? `<span class="trend__tag" style="font-size:10px;padding:1px 6px;">${item.tag}</span>` : ""}
      </a>
    </li>
  `).join("");

  list.innerHTML = html;
  clone.innerHTML = html;

  const startMarquee = () => {
    // Distance to scroll = width of the first list
    const distance = list.scrollWidth || 0;

    // If nothing rendered, show a safe static fallback
    if (!distance) {
      const fallback = ["MetaMask","Phantom","Backpack"].map(n => `
        <li><span class="trend" style="padding:6px 10px;font-size:12px;line-height:1;">${n}</span></li>
      `).join("");
      list.innerHTML = fallback;
      clone.innerHTML = "";
      track.style.animation = "none";
      return;
    }

    // Speed ~35 px/sec → duration = distance / speed
    const pxPerSec = 35;
    const duration = Math.max(12, Math.round(distance / pxPerSec));

    // Feed CSS variables (works with your existing CSS)
    track.style.setProperty("--scroll-px", distance + "px");
    track.style.setProperty("--trending-duration", `${duration}s`);

    // Restart the animation to pick up new vars
    track.style.animation = "none";
    void track.offsetHeight;       // reflow
    track.style.animation = "";    // resume
  };

  startMarquee();
  requestAnimationFrame(startMarquee);
  window.addEventListener("resize", startMarquee, { passive: true });

  // Clicking a brand pill opens its detail view (metamask/phantom/backpack)
  track.addEventListener("click", (e) => {
    const a = e.target.closest("a.trend[data-open]");
    if (!a) return;
    e.preventDefault();
    const id = a.getAttribute("data-open");
    if (id) openDetail(id);
  });
}


// ===== Crates ================================================================
const DEFAULT_CRATE_COUNTS = { metamask: 1, phantom: 3, backpack: 2 };
let CURRENT_COMPANY = null;

// ===== V4 Inventory (persistent) =============================================
const LS_INV = "milestoneInventory:v4";
function getInventory() {
  try { return JSON.parse(localStorage.getItem(LS_INV)) || []; }
  catch { return []; }
}
function setInventory(list) { localStorage.setItem(LS_INV, JSON.stringify(list.slice(0, 100))); }
function addToInventory(entry) {
  const list = getInventory();
  list.unshift(entry);
  setInventory(list);
  renderInventory();
}

// Render inventory list inside crates modal (under result)
function ensureInventoryContainer() {
  const body = $("crates-body");
  if (!body) return null;

  let wrap = $("inventory-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "inventory-wrap";
    wrap.style.marginTop = "8px";
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin:8px 0;">
        <div style="font-weight:800;">Recent Rewards</div>
        <button id="inv-clear" class="btn btn--ghost btn--sm" type="button">Clear</button>
      </div>
      <ul id="inventory-list" style="list-style:none;padding:0;margin:0;display:grid;gap:6px;"></ul>
    `;
    body.appendChild(wrap);

    $("inv-clear")?.addEventListener("click", () => {
      setInventory([]);
      renderInventory();
      showToast("Inventory cleared.", "warn");
    });
  }
  return wrap;
}

function renderInventory() {
  const wrap = ensureInventoryContainer();
  const listEl = $("inventory-list");
  if (!wrap || !listEl) return;

  const list = getInventory();
  if (!list.length) {
    listEl.innerHTML = `<li style="opacity:.75;font-size:13px;">No rewards yet. Open a crate!</li>`;
    return;
  }

  listEl.innerHTML = list.map(e => {
    const time = new Date(e.ts || Date.now()).toLocaleString();
    const tagStyle = `display:inline-block;padding:2px 8px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.06);font-size:11px;margin-left:8px;`;
    return `
      <li class="inv-item" style="padding:8px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:rgba(255,255,255,.04);display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;">
        <div>
          <div style="font-weight:700;">${e.company} <span style="${tagStyle}">${e.tier}</span></div>
          <div style="font-size:12px;opacity:.75;">${time}</div>
        </div>
        <div style="font-weight:800;">+${e.amount}</div>
      </li>
    `;
  }).join("");
}

// ===== Chips with brand icons ===============================================
function renderChipRow() {
  const row = $("rec-chips");
  if (!row) return;

  row.innerHTML = chipItems.map(({ id, name }) => {
    const icon = BRAND_ICONS[name] || "";
    return `
      <button class="chip" data-chip="${id}" type="button">
        ${icon ? `<img class="chip__icon" src="${icon}" alt="" />` : ""}
        ${name}
      </button>`;
  }).join("");

  row.addEventListener("click", (e) => {
    const t = e.target.closest(".chip");
    if (!t) return;
    const key = t.getAttribute("data-chip");
    row.querySelectorAll(".chip").forEach(c => c.classList.remove("is-active"));
    t.classList.add("is-active");
    highlightCard(key);
  });
}

function renderCards() {
  const wrap = $("rec-cards");
  if (!wrap) return;
  wrap.innerHTML = "";

  cardItems.forEach((data) => {
    const pct = Math.round((data.questsCompleted / data.questsTotal) * 100);
    const card = document.createElement("article");
    card.className = "rec-card";

    card.innerHTML = `
      <div class="rec-card__header">
        <div class="rec-card__title-row">
          ${BRAND_ICONS[data.name] ? `<img class="rec-card__icon" src="${BRAND_ICONS[data.name]}" alt="${data.name} icon" />` : ""}
          <div class="rec-card__title">${data.name}</div>
        </div>
        <div class="rec-card__meta">${data.questsCompleted}/${data.questsTotal} completed</div>
      </div>

      <div class="rec-card__progress">
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
          <div class="progress__bar" style="width:${pct}%"></div>
        </div>
        <div class="progress__pct">${pct}%</div>
      </div>

      <button class="btn btn--secondary rec-card__cta" data-open-detail="${data.id}" type="button">View quests</button>
    `;
    wrap.appendChild(card);

    card.querySelector("[data-open-detail]")?.addEventListener("click", () => openDetail(data.id));
  });
}

function highlightCard(key) {
  const cards = document.querySelectorAll(".rec-card");
  cards.forEach((c) => {
    const title = c.querySelector(".rec-card__title")?.textContent?.toLowerCase() || "";
    const match = title.includes((key || "").toLowerCase());
    c.classList.toggle("rec-card--highlight", !!match);
  });
}

// ===== Detail view ===========================================================
function openDetail(id) {
  if (id === "phantom") return openPhantomDetail();
  if (id === "superteam") return openSuperteamDetail();

  const html = `
    <div class="detail__header">
      <button class="btn btn--ghost btn--sm" id="detail-back" type="button">← Back</button>
      <div class="detail__title">${id}</div>
    </div>
    <div class="detail__body">
      <p>Quests for <strong>${id}</strong> coming soon.</p>
    </div>
  `;

  const list = $("rec-list-view");
  const detail = $("rec-detail-view");
  if (!list || !detail) return;
  detail.innerHTML = html;
  list.classList.add("hidden");
  detail.classList.remove("hidden");

  $("detail-back")?.addEventListener("click", showList);
  sizeRecommendedScrollArea();
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

// ===== Phantom detail ========================================================
function openPhantomDetail() {
  const completed = phantomQuests.filter((q) => q.done).length;
  const total = phantomQuests.length;
  const pct = Math.round((completed / total) * 100);

  const items = phantomQuests.map((q) => {
    const actionable = q.action?.type === "link" && q.action.href;
    const title = actionable
      ? `<button class="quest__action" data-href="${q.action.href}" type="button">${q.title}</button>`
      : `<span class="quest__title">${q.title}</span>`;

    return `
      <li class="quest ${q.done ? "quest--done" : "quest--todo"}">
        <span class="quest__check" aria-hidden="true"></span>
        ${title}
        <span class="quest__status">${q.done ? "Completed" : "Pending"}</span>
      </li>
    `;
  }).join("");

  const html = `
    <div class="detail__header">
      <button class="btn btn--ghost btn--sm" id="phantom-back" type="button">← Back</button>
      <div class="detail__title">Phantom <span class="detail__meta">${completed}/${total} · ${pct}%</span></div>
    </div>
    <ul class="quest-list">${items}</ul>
  `;

  const list = $("rec-list-view");
  const detail = $("rec-detail-view");
  if (!list || !detail) return;
  detail.innerHTML = html;
  list.classList.add("hidden");
  detail.classList.remove("hidden");

  $("phantom-back")?.addEventListener("click", showList);
  sizeRecommendedScrollArea();
}

function openSuperteamDetail() {
  const completed = superteamQuests.filter(q => q.done).length;
  const total = superteamQuests.length;
  const pct = Math.round((completed / total) * 100);

  const items = superteamQuests.map(q => {
    const actionable = q.action?.type === "link" && q.action.href;
    const title = actionable
      ? `<button class="quest__action" data-href="${q.action.href}" type="button">${q.title}</button>`
      : `<span class="quest__title">${q.title}</span>`;
    return `
      <li class="quest ${q.done ? "quest--done" : "quest--todo"}">
        <span class="quest__check" aria-hidden="true"></span>
        ${title}
        <span class="quest__status">${q.done ? "Completed" : "Pending"}</span>
      </li>
    `;
  }).join("");

  const html = `
    <div class="detail__header">
      <button class="btn btn--ghost btn--sm" id="superteam-back" type="button">← Back</button>
      <div class="detail__title">Superteam <span class="detail__meta">${completed}/${total} · ${pct}%</span></div>
    </div>
    <ul class="quest-list">${items}</ul>
  `;

  const list = $("rec-list-view");
  const detail = $("rec-detail-view");
  if (!list || !detail) return;
  detail.innerHTML = html;
  list.classList.add("hidden");
  detail.classList.remove("hidden");

  $("superteam-back")?.addEventListener("click", showList);
  sizeRecommendedScrollArea();
}

// ===== Token crates ==========================================================
function getCrateCounts() {
  try {
    const key = "crateCounts";
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(key, JSON.stringify(DEFAULT_CRATE_COUNTS));
    return { ...DEFAULT_CRATE_COUNTS };
  } catch {
    return { ...DEFAULT_CRATE_COUNTS };
  }
}
function setCrateCounts(counts) { localStorage.setItem("crateCounts", JSON.stringify(counts)); }

function showCratesModal(show = true) {
  const modal = $("crates-modal");
  if (!modal) return;
  modal.classList.toggle("hidden", !show);
  if (show) {
    $("crates-select-view")?.classList.remove("hidden");
    $("crates-open-view")?.classList.add("hidden");
    renderCrateGrid();
    renderInventory();
  }
}

function renderCrateGrid() {
  const grid = $("crates-grid");
  if (!grid) return;
  const counts = getCrateCounts();

  grid.innerHTML = "";
  COMPANY_META.forEach(({ key, name, img }) => {
    const btn = document.createElement("button");
    btn.className = "crate-card";
    btn.innerHTML = `
      <img class="crate-card__img" src="${img}" alt="${name} crate" />
      <div class="crate-card__name">${name}</div>
      <div class="crate-card__count">x${counts[key] ?? 0}</div>
    `;
    btn.addEventListener("click", () => openCompanyCrates(key));
    grid.appendChild(btn);
  });
}

function openCompanyCrates(key) {
  CURRENT_COMPANY = key;
  const meta = COMPANY_META.find((c) => c.key === key);
  if (!meta) return;

  $("crates-company-title").textContent = meta.name;
  const count = getCrateCounts()[key] ?? 0;
  $("crates-company-count").textContent = String(count);
  $("crates-count-inline").textContent = String(count);

  $("crates-select-view")?.classList.add("hidden");
  $("crates-open-view")?.classList.remove("hidden");

  $("crates-result")?.classList.add("hidden");
  $("crates-reward").textContent = "";

  renderInventory();
}

function rollReward() {
  // Normal 47.5%, Rare 47%, Unique 5%, Mythic 0.5%
  const r = Math.random() * 100;
  let tier = "Normal";
  if (r < 47.5) tier = "Normal";
  else if (r < 47.5 + 47) tier = "Rare";
  else if (r < 47.5 + 47 + 5) tier = "Unique";
  else tier = "Mythic";

  const base = { Normal: 10, Rare: 25, Unique: 100, Mythic: 500 }[tier] || 10;

  // Apply Verified boost if selected
  const user = loadUser();
  const boost = user?.plan === "verified" ? 1.2 : 1;
  const amount = Math.round(base * boost);

  return { tier, amount };
}

function openOneCrate() {
  if (!CURRENT_COMPANY) return;
  const counts = getCrateCounts();
  if ((counts[CURRENT_COMPANY] ?? 0) <= 0) { showToast("No crates available.", "warn"); return; }

  const available = clamp((counts[CURRENT_COMPANY] ?? 0) - 1, 0, 999);

  // Animate the crate
  const crate = $("crates-crate");
  crate?.classList.add("is-opening");
  setTimeout(() => crate?.classList.remove("is-opening"), 700);

  counts[CURRENT_COMPANY] = available;
  setCrateCounts(counts);

  $("crates-company-count").textContent = String(available);
  $("crates-count-inline").textContent = String(available);
  renderCrateGrid();

  const reward = rollReward();
  const meta = COMPANY_META.find((c) => c.key === CURRENT_COMPANY);

  // Log reward to inventory only (no balance)
  addToInventory({
    company: meta?.name || CURRENT_COMPANY,
    tier: reward.tier,
    amount: reward.amount,
    ts: Date.now(),
  });

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
}

// ===== Sticky & Scroll sizing helpers =======================================
function updateStickyOffsets() {
  const topbar = document.querySelector(".topbar");
  const rank   = document.querySelector('.card[aria-labelledby="rank-title"]');
  const trending = document.querySelector(".card.card--trending");

  const topbarH = topbar ? topbar.offsetHeight : 0;
  if (topbarH) document.documentElement.style.setProperty("--topbar-h", `${topbarH}px`);

  const rankH   = rank ? rank.offsetHeight : 0;
  const stickyBase = topbarH + rankH + 8; // where Trending starts
  document.documentElement.style.setProperty("--dock-trending-top", `${stickyBase}px`);

  const trendingH = trending ? trending.offsetHeight + 8 : 148; // its own height + gap
  const recTop = stickyBase + trendingH;
  document.documentElement.style.setProperty("--dock-rec-top", `${recTop}px`);
}

function watchTrendingSticky() {
  const el = document.querySelector(".card.card--trending");
  if (!el) return;
  const obs = new IntersectionObserver(([entry]) => {
    const stickyTop = parseFloat(getComputedStyle(el).top) || 0;
    const isAtTop = el.getBoundingClientRect().top <= stickyTop + 0.5;
    el.classList.toggle("is-stuck", entry.intersectionRatio < 1 && isAtTop);
  }, { threshold: [1] });
  obs.observe(el);
}

function sizeRecommendedScrollArea() {
  const cards  = $("rec-cards");
  const detail = $("rec-detail-view");
  if (!cards || !detail) return;

  // When the Recommended card itself is sticky, compute available viewport height
  const rect = cards.getBoundingClientRect();
  const SAFE_PAD = 12;
  const available = Math.max(120, window.innerHeight - rect.top - SAFE_PAD);

  document.documentElement.style.setProperty("--rec-scroll-h", available + "px");
  cards.style.height  = available + "px";
  detail.style.height = available + "px";
}

function attachScrollSizing() {
  const scroller = document.querySelector("main.content") || window;
  scroller.addEventListener("scroll", sizeRecommendedScrollArea, { passive: true });
}

// ===== Init ==================================================================
document.addEventListener("DOMContentLoaded", () => {
  // Positioning & sticky polish
  updateStickyOffsets();
  watchTrendingSticky();
  window.addEventListener("resize", updateStickyOffsets);
  window.addEventListener("load", updateStickyOffsets);

  // Core UI
  renderAvatar();
  renderChipRow();
  renderCards();

  // 👉 Make Trending render (this was missing)
  renderTrending();

  // Recompute offsets now that Trending has real height
  requestAnimationFrame(() => {
    updateStickyOffsets();
    sizeRecommendedScrollArea();
  });

  // Size the inner scroll area under Recommended
  sizeRecommendedScrollArea();
  window.addEventListener("resize", sizeRecommendedScrollArea);
  window.addEventListener("load", sizeRecommendedScrollArea);
  attachScrollSizing();

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

  // “View all” — open panel as its own tab
  $("view-all")?.addEventListener("click", async () => {
    const url = chrome.runtime.getURL("sidepanel.html");
    await chrome.tabs.create({ url });
    sizeRecommendedScrollArea();
  });

  // Delegated clicks for quest actions in detail view
  $("rec-detail-view")?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.classList.contains("quest__action")) {
      const href = t.getAttribute("data-href");
      if (href) openNewTab(href);
    }
  });

  // Profile + Upgrade modals
  $("profile-close")?.addEventListener("click", closeProfileModal);
  $("profile-cancel")?.addEventListener("click", closeProfileModal);
  $("profile-confirm")?.addEventListener("click", confirmProfile);

  $("upgrade-btn")?.addEventListener("click", openUpgradeModal);
  $("upgrade-close")?.addEventListener("click", closeUpgradeModal);
  $("upgrade-cancel")?.addEventListener("click", closeUpgradeModal);
  $("select-basic")?.addEventListener("click", () => selectPlan("basic"));
  $("select-verified")?.addEventListener("click", () => selectPlan("verified"));

  $("profile-button")?.addEventListener("click", openProfileModal);
});

// =============== V3 Profile & Upgrade additions ====================
const LS_KEY_USER = "milestoneUser:v3";
function loadUser() { try { return JSON.parse(localStorage.getItem(LS_KEY_USER)) || {}; } catch { return {}; } }
function saveUser(u) { localStorage.setItem(LS_KEY_USER, JSON.stringify(u)); }

function usernameIsValid(name) { return /^[a-zA-Z0-9_]{3,24}$/.test(name); }

function renderAvatar() {
  const img = $("profile-avatar");
  if (!img) return;
  const fallback = chrome?.runtime?.getURL ? chrome.runtime.getURL(USER.avatar) : USER.avatar;
  img.src = img.src || fallback;
  img.addEventListener("error", () => { img.src = fallback; });
  $("profile-button")?.addEventListener("click", openProfileModal);
}

function openProfileModal() {
  const modal = $("profile-modal");
  if (!modal) return;
  const input = $("username-input");
  const user = loadUser();
  if (input) input.value = user.username || "";
  modal.classList.remove("hidden");
}
function closeProfileModal() {
  const modal = $("profile-modal");
  if (modal) modal.classList.add("hidden");
}
function confirmProfile() {
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
  const u = loadUser();
  u.username = name;
  saveUser(u);
  if (hint) { hint.textContent = "Saved!"; hint.style.color = ""; }
  closeProfileModal();
  showToast("Username saved.", "ok");
}

// Upgrade modal controls (replaces page-bottom section)
function openUpgradeModal() { $("upgrade-modal")?.classList.remove("hidden"); }
function closeUpgradeModal() { $("upgrade-modal")?.classList.add("hidden"); }

function selectPlan(plan) {
  const u = loadUser();
  u.plan = plan; // "basic" | "verified"
  saveUser(u);
  closeUpgradeModal();
  showToast(plan === "verified" ? "Verified plan activated — +20% rewards." : "Basic plan selected.", "ok");
}
