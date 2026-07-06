import { Router } from "express";
import { prisma } from "../lib/prisma";
import { env } from "../env";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/errorHandler";
import { verifySession } from "../lib/jwt";
import { buildDiscordAuthorizeUrl, exchangeDiscordCode, fetchDiscordIdentity } from "../lib/discord";
import { verifyTelegramLoginPayload } from "../lib/telegram";

export const linkRouter = Router();

// The extension can't receive an OAuth redirect directly, so account linking
// happens in a normal browser tab. The user's existing session JWT is passed
// through as the OAuth `state` (Discord) / a query token (Telegram widget
// page) and round-tripped back to us over HTTPS to identify who's linking.

linkRouter.get(
  "/discord/start",
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    try {
      verifySession(token);
    } catch {
      throw new HttpError(401, "Invalid or expired session token");
    }
    res.redirect(buildDiscordAuthorizeUrl(token));
  }),
);

linkRouter.get(
  "/discord/callback",
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state) throw new HttpError(400, "Missing code or state");

    let userId: string;
    try {
      userId = verifySession(state).sub;
    } catch {
      throw new HttpError(401, "Invalid or expired session token");
    }

    const tokenResponse = await exchangeDiscordCode(code);
    const identity = await fetchDiscordIdentity(tokenResponse.access_token);

    await prisma.discordLink.upsert({
      where: { userId },
      create: {
        userId,
        discordUserId: identity.id,
        discordUsername: identity.username,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
      },
      update: {
        discordUserId: identity.id,
        discordUsername: identity.username,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
      },
    });

    res.send(linkSuccessPage("Discord"));
  }),
);

linkRouter.get(
  "/telegram",
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    res.type("html").send(`<!doctype html>
<html>
<head><meta charset="utf-8" /><title>Link Telegram — Milestone</title></head>
<body style="font-family:system-ui;background:#0a0b12;color:#fff;display:grid;place-items:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <h2>Link your Telegram account</h2>
    <script async src="https://telegram.org/js/telegram-widget.js?22"
      data-telegram-login="${env.TELEGRAM_BOT_USERNAME}"
      data-size="large"
      data-auth-url="${env.API_BASE_URL}/api/link/telegram/callback?token=${encodeURIComponent(token)}"
      data-request-access="write"></script>
  </div>
</body>
</html>`);
  }),
);

linkRouter.get(
  "/telegram/callback",
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    let userId: string;
    try {
      userId = verifySession(token).sub;
    } catch {
      throw new HttpError(401, "Invalid or expired session token");
    }

    const { token: _t, ...widgetData } = req.query as Record<string, string>;
    if (!verifyTelegramLoginPayload(widgetData)) {
      throw new HttpError(401, "Telegram signature verification failed");
    }

    await prisma.telegramLink.upsert({
      where: { userId },
      create: { userId, telegramUserId: widgetData.id, telegramUsername: widgetData.username ?? null },
      update: { telegramUserId: widgetData.id, telegramUsername: widgetData.username ?? null },
    });

    res.send(linkSuccessPage("Telegram"));
  }),
);

function linkSuccessPage(provider: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><title>Linked — Milestone</title></head>
<body style="font-family:system-ui;background:#0a0b12;color:#fff;display:grid;place-items:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <h2>${provider} linked ✓</h2>
    <p style="color:#9aa0b3;">You can close this tab and return to the Milestone side panel.</p>
  </div>
</body>
</html>`;
}
