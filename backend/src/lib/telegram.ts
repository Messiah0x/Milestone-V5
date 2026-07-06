import crypto from "node:crypto";
import { env } from "../env";

const telegramApi = () => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

// Verifies a Telegram Login Widget payload per Telegram's documented HMAC scheme:
// https://core.telegram.org/widgets/login#checking-authorization
export function verifyTelegramLoginPayload(data: Record<string, string>): boolean {
  const { hash, ...rest } = data;
  if (!hash) return false;

  const checkString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(env.TELEGRAM_BOT_TOKEN).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

  return hmac === hash;
}

export async function isTelegramChatMember(chatId: string, telegramUserId: string): Promise<boolean> {
  const res = await fetch(`${telegramApi()}/getChatMember?chat_id=${chatId}&user_id=${telegramUserId}`);
  const body = (await res.json()) as { ok: boolean; result?: { status: string } };
  if (!body.ok || !body.result) return false;
  return !["left", "kicked"].includes(body.result.status);
}

export async function registerTelegramWebhook(): Promise<void> {
  const url = `${env.API_BASE_URL}/api/webhooks/telegram`;
  await fetch(`${telegramApi()}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, secret_token: env.TELEGRAM_WEBHOOK_SECRET }),
  });
}
