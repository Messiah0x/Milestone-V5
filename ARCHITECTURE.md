# Milestone — Architecture

Milestone is a web3 marketing platform: brands run "campaigns" made of quests
(follow, join community, engage), users complete quests from a Chrome
extension side panel, earn XP/rank, and open "token crates" for on-chain
project token rewards. This doc covers the system as of the finish-the-line
build — what existed before (a static, client-only Chrome extension) and what
was added (a real backend, database, wallet auth, quest verification, crate
economy, billing, and an admin surface).

## 1. System architecture

```
                         ┌─────────────────────────┐
                         │   Chrome Extension       │
                         │  (side panel, MV3)       │
                         │  - wallet connect        │
                         │  - quests / crates UI    │
                         └────────────┬─────────────┘
                                      │ HTTPS (Bearer JWT)
                                      ▼
                         ┌─────────────────────────┐
                         │   Express API            │
                         │  (Vercel serverless)     │
                         │  - auth (SIWE/SIWS)      │
                         │  - quests/campaigns      │
                         │  - crates/ledger         │
                         │  - billing (Stripe)      │
                         │  - admin dashboard (SSR) │
                         └───┬───────────┬─────────┘
                             │           │
                 ┌───────────┘           └───────────┐
                 ▼                                   ▼
     ┌─────────────────────┐             ┌─────────────────────────┐
     │ PostgreSQL (Neon)    │             │ External services        │
     │ via Prisma           │             │ - Discord REST API        │
     └─────────────────────┘             │ - Telegram Bot API         │
                                          │ - Stripe                  │
                                          └─────────────────────────┘
```

**Why this shape:**
- The extension never trusts itself for anything reward-bearing (XP, crates,
  token balances). It is a thin client; the API is the sole source of truth.
- The API is a standard Express app, but the entry point (`backend/api/index.ts`)
  wraps it as a single Vercel serverless function so it deploys without
  a persistent server to manage, and scales horizontally by default.
- Quest verification is behind a `Verifier` interface
  (`backend/src/lib/verifiers`) so each quest type can be auto-verified
  (Discord/Telegram, no bot gateway required — REST + webhooks only, which
  is serverless-compatible), or routed to manual admin review (X/Twitter,
  since the official API requires a paid tier).
- Reward issuance (crate opens, XP, token ledger) is server-authoritative:
  RNG runs in Node's `crypto` module server-side, and balance mutations are
  atomic conditional updates inside a Prisma transaction — the client only
  ever receives the *result*.

## 2. File structure

```
/extension/                     Chrome extension (MV3), client only
  manifest.json
  popup.html / popup.js
  sidepanel.html / sidepanel.js
  service_worker.js
  styles.css
  src/
    api.js                      fetch wrapper, attaches Bearer JWT, base URL
    wallet.js                   injected-page bridge: window.ethereum / window.solana
    auth.js                     SIWE/SIWS client flow + token storage (chrome.storage.local)
  icons/

/backend/                       Express + TypeScript + Prisma
  api/index.ts                  Vercel serverless entry (wraps Express app)
  src/
    server.ts                   local dev listener (`npm run dev`)
    app.ts                      Express app assembly (routes, middleware)
    env.ts                      typed env loading + validation
    lib/
      prisma.ts                 Prisma client singleton
      jwt.ts                    sign/verify session JWTs
      siwe.ts / siws.ts         Sign-In With Ethereum / Solana verification
      rank.ts                   pure XP -> rank tier function
      rewards.ts                crate RNG + weighted tiers
      discord.ts                Discord OAuth + REST membership checks
      telegram.ts               Telegram Login Widget verify + Bot API calls
      stripe.ts                 Stripe client + checkout/webhook helpers
      verifiers/                pluggable per-quest-type verification
    middleware/
      auth.ts                   requires end-user Bearer JWT -> req.user
      adminAuth.ts               requires admin session cookie -> req.admin
      errorHandler.ts
      asyncHandler.ts
    routes/
      auth.routes.ts            /api/auth/*
      link.routes.ts            /api/link/discord/*, /api/link/telegram/*
      users.routes.ts           /api/users/me*
      brands.routes.ts          /api/brands*
      campaigns.routes.ts       /api/campaigns*
      quests.routes.ts          /api/quests*
      crates.routes.ts          /api/crates*
      billing.routes.ts         /api/billing/*
      webhooks.routes.ts        /api/webhooks/stripe, /api/webhooks/telegram
      admin.routes.ts           /admin/* (session-rendered dashboard + JSON API)
    views/                      server-rendered admin dashboard (EJS, no SPA needed)
  prisma/
    schema.prisma
    seed.ts
  vercel.json
  .env.example

ARCHITECTURE.md
```

## 3. Database schema

PostgreSQL via Prisma. Full schema lives in `backend/prisma/schema.prisma`;
summary of the model:

| Model | Purpose |
|---|---|
| `User` | End user identity. `username`, `xp`, `plan` (BASIC/VERIFIED). Token balance and rank are *derived*, never stored directly. |
| `Wallet` | Linked wallet per user. `chain` (EVM/SOLANA), `address` (unique per chain), `isPrimary`. |
| `AuthNonce` | One-time SIWE/SIWS challenge nonces, short-lived. |
| `DiscordLink` / `TelegramLink` | Links a `User` to their Discord/Telegram identity (from OAuth / Login Widget), 1:1. |
| `Brand` | A company running campaigns (MetaMask, Phantom, Backpack, Superteam, ...). Holds `discordGuildId`, `telegramChatId`, `xHandle` used by verifiers. |
| `Campaign` | A brand's quest campaign. `status` (DRAFT/ACTIVE/ENDED), `trendingRank` (nullable, powers the Trending strip). |
| `Quest` | One task inside a campaign. `type` (FOLLOW_X, JOIN_DISCORD, JOIN_TELEGRAM, DISCORD_MESSAGE_COUNT, TELEGRAM_MESSAGE_COUNT, DAILY_CHECKIN, VISIT_LINK, CUSTOM), `verificationMode` (AUTO/MANUAL), `xpReward`, `config` (JSON, e.g. required message count). |
| `QuestCompletion` | One user's status on one quest. `status` (PENDING/VERIFIED/REJECTED), unique per (quest, user). |
| `TelegramMessageCount` | Per-(chat,user) running message tally, incremented by the Telegram webhook — backs `TELEGRAM_MESSAGE_COUNT` quests. |
| `CrateBalance` | Per-(user,brand) openable crate count. Mutated only via atomic conditional decrement. |
| `CrateOpenLedger` | Append-only log of every crate opened: tier rolled, token amount, timestamp. This *is* the reward inventory shown in the UI. |
| `TokenLedgerEntry` | Append-only ledger of every token balance change (crate open, admin adjustment). Balance = `SUM(amount)`. Never update-in-place — always append, so it's auditable. |
| `Subscription` | Stripe subscription state backing the `VERIFIED` plan. |
| `AdminUser` | Internal/brand-manager login for the admin dashboard. `role` (SUPERADMIN/BRAND_MANAGER), optional `brandId` scoping. |

Design choice: **balances are derived from ledgers, not stored as mutable
counters** (except `CrateBalance`, which is an inventory count, not a token
amount). This means a bug or an attempted client-side tamper can't silently
corrupt a user's token total — it's always recomputable from history.

## 4. API endpoints

All end-user endpoints are under `/api`, require `Authorization: Bearer <jwt>`
unless noted, and return JSON. Admin endpoints are under `/admin`.

**Auth (wallet-based, no passwords for end users)**
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/nonce` | `{address, chain}` -> `{nonce, message}` to sign |
| POST | `/api/auth/verify` | `{address, chain, signature}` -> verifies SIWE/SIWS, upserts user+wallet, returns `{token, user}` |
| GET | `/api/auth/me` | current user profile, xp, rank, plan |

**Account linking (for quest verification)**
| Method | Path | Description |
|---|---|---|
| GET | `/api/link/discord/start` | redirects to Discord OAuth2 consent |
| GET | `/api/link/discord/callback` | stores Discord user id on the account |
| GET | `/link/telegram` | static page hosting the Telegram Login Widget |
| POST | `/api/link/telegram/callback` | verifies Telegram Widget HMAC, stores Telegram user id |

**Users**
| Method | Path | Description |
|---|---|---|
| PATCH | `/api/users/me` | `{username}` |
| GET | `/api/users/me/balance` | current token balance (derived: `SUM(TokenLedgerEntry.amount)`) |
| GET | `/api/users/me/inventory` | paginated crate-open history |

**Brands / Campaigns / Quests (public read, auth for completion state)**
| Method | Path | Description |
|---|---|---|
| GET | `/api/brands` | list brands |
| GET | `/api/campaigns/trending` | active campaigns ordered by `trendingRank` |
| GET | `/api/campaigns/:id/quests` | quests + (if authed) the caller's completion status per quest |
| POST | `/api/quests/:id/complete` | attempt to complete a quest — runs the quest-type verifier; AUTO verifiers resolve immediately, MANUAL verifiers create a PENDING review row |

**Crates**
| Method | Path | Description |
|---|---|---|
| GET | `/api/crates/balance` | per-brand openable crate counts |
| POST | `/api/crates/:brandId/open` | atomically opens one crate: RNG roll, ledger writes, returns `{tier, amount}` |

**Billing**
| Method | Path | Description |
|---|---|---|
| POST | `/api/billing/checkout` | creates a Stripe Checkout session for the Verified plan |
| POST | `/api/webhooks/stripe` | Stripe webhook — syncs `Subscription` + `User.plan` |

**Verification webhooks**
| Method | Path | Description |
|---|---|---|
| POST | `/api/webhooks/telegram` | Telegram bot updates; increments `TelegramMessageCount`, detects joins |

**Admin (session cookie auth, role-gated)**
| Method | Path | Description |
|---|---|---|
| POST | `/admin/login` | email/password -> httpOnly session cookie |
| GET | `/admin` | dashboard: brands, campaigns, pending reviews |
| POST | `/admin/brands` | create/update a brand |
| POST | `/admin/campaigns` | create/update a campaign |
| POST | `/admin/quests` | create/update a quest |
| GET | `/admin/completions?status=PENDING` | manual review queue (X/Twitter quests) |
| POST | `/admin/completions/:id/approve` \| `/reject` | resolve a manual review |
| POST | `/admin/crates/grant` | grant crates to a user for a brand |

## 5. UI architecture

**Chrome extension (end users)** — unchanged visual shell, new data layer:
- `sidepanel.js` no longer owns any state; it renders whatever `api.js`
  returns and posts actions (complete quest, open crate) back through it.
- A "Connect Wallet" gate replaces the old placeholder avatar flow: the side
  panel asks the active tab's injected provider (`window.ethereum` /
  `window.solana` / `window.backpack`) for an address via a small content
  script bridge, requests a nonce, signs it, and exchanges the signature for
  a JWT stored in `chrome.storage.local`.
- Quest detail views render live `Quest`/`QuestCompletion` data instead of
  the hardcoded `phantomQuests`/`superteamQuests` arrays.
- Token Crates modal calls `/api/crates/balance` and
  `/api/crates/:brandId/open` instead of rolling rewards in the browser.

**Admin dashboard (brands/internal)** — deliberately server-rendered
(Express + EJS), not a SPA: brand managers create campaigns/quests and clear
the manual review queue. No client framework needed for CRUD forms and a
table — keeps the "finish line" scope realistic instead of shipping a second
frontend app.

## 6. What's intentionally deferred

- `DISCORD_MESSAGE_COUNT` verification needs a persistent Discord gateway
  connection (Discord has no "N messages sent" REST endpoint or webhook).
  The quest type and DB model exist; wiring a long-running worker is future
  work once the platform has a non-serverless always-on host.
- Real X/Twitter automated verification is out of scope for MVP (paid API
  tier); it's routed to manual admin review instead, behind the same
  `Verifier` interface, so it can be swapped to automatic later without
  touching quest data.
- On-chain token distribution (actually paying out crate rewards from a
  treasury wallet/contract) is out of scope — the ledger is the accounting
  system a payout job would read from later.
