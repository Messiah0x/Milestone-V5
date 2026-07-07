# Deploying Milestone

The backend is already deployed to Vercel (project `milestone-v5`, linked to
this GitHub repo — every push to this branch redeploys it automatically).
What's left is configuration, since none of it can be done headlessly:

## 1. Environment variables (Vercel dashboard → milestone-v5 → Settings → Environment Variables)

Required for the API to function at all:

| Key | Value |
|---|---|
| `DATABASE_URL` | From Storage tab → Create Database → Postgres, after connecting it to this project |
| `JWT_SECRET` | `11d4a06852aa766754ed94271766fb23c5a554996219c2aa6ff94af493a77a87` |
| `ADMIN_SESSION_SECRET` | `224f41e08c2c9f069463f7f3c65415d37924c7f9e780054c18abe8960af9c1b7` |
| `API_BASE_URL` | The deployment's own URL, e.g. `https://milestone-v5-git-claude-web3-marketi-c9447a-messiah0xs-projects.vercel.app` (no trailing slash) |
| `SEED_ADMIN_EMAIL` | Whatever email you want to log into `/admin` with |
| `SEED_ADMIN_PASSWORD` | A real password — change this from the repo default before seeding |

(The two secrets above were freshly generated for this deployment — don't reuse them anywhere else.)

Optional — each feature degrades gracefully without its keys (see ARCHITECTURE.md §6):

| Key | Needed for |
|---|---|
| `CORS_ORIGINS` | Defaults to allowing all origins if unset, so the extension works immediately. Set to `chrome-extension://<your-extension-id>` (see below) once you're ready to lock it down. |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_BOT_TOKEN` | Discord account linking + `JOIN_DISCORD` quest verification |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` / `TELEGRAM_WEBHOOK_SECRET` | Telegram account linking + `JOIN_TELEGRAM`/message-count quests |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_VERIFIED_PRICE_ID` | The "Verified" plan checkout flow |

After adding `DATABASE_URL`, redeploy (any new push, or use the dashboard's "Redeploy" button) so the running function picks up the new env vars.

## 2. Run migrations + seed data against the new database

Once `DATABASE_URL` is set, run this from your machine (or send me the connection string and I'll run it):

```bash
cd backend
DATABASE_URL="<paste the same value>" npx prisma migrate deploy
DATABASE_URL="<paste the same value>" SEED_ADMIN_EMAIL="you@example.com" SEED_ADMIN_PASSWORD="..." npx tsx prisma/seed.ts
```

This creates the schema and seeds the four launch brands (Superteam, MetaMask, Phantom, Backpack) with their quest sets, plus your admin login.

## 3. Load the Chrome extension

1. `chrome://extensions` → enable Developer Mode → "Load unpacked" → select the `extension/` folder.
2. Copy the extension's ID from that page.
3. Add `chrome-extension://<that-id>` to `CORS_ORIGINS` in Vercel and redeploy.
4. Open the side panel, connect a wallet (MetaMask, or Phantom/Backpack on a page where one is installed), and it talks to the live API.

## 4. Going to production

This branch deploys as a **preview** (its own stable alias). Once the PR merges to `main`, Vercel promotes the build to the production alias (`milestone-v5.vercel.app`) — update `extension/src/config.js`'s `API_BASE_URL` to that at the same time.
