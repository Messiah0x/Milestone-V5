import { env } from "../env";

const DISCORD_API = "https://discord.com/api/v10";

export function buildDiscordAuthorizeUrl(state: string): string {
  const redirectUri = `${env.API_BASE_URL}/api/link/discord/callback`;
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDiscordCode(
  code: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const redirectUri = `${env.API_BASE_URL}/api/link/discord/callback`;
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Discord token exchange failed: ${res.status}`);
  return (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
}

export async function fetchDiscordIdentity(accessToken: string): Promise<{ id: string; username: string }> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord identity fetch failed: ${res.status}`);
  return (await res.json()) as { id: string; username: string };
}

// Requires the bot to already be a member of the guild (Server Members Intent enabled).
export async function isDiscordGuildMember(guildId: string, discordUserId: string): Promise<boolean> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Discord guild member check failed: ${res.status}`);
  return true;
}
