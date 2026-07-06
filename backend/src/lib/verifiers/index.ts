import type { Brand, Quest } from "@prisma/client";
import { prisma } from "../prisma";
import { isDiscordGuildMember } from "../discord";
import { isTelegramChatMember } from "../telegram";

export interface VerifyOutcome {
  status: "VERIFIED" | "REJECTED" | "PENDING";
  reason?: string;
}

/**
 * Pluggable per-quest-type verification. AUTO types resolve immediately
 * against a real external signal (Discord/Telegram REST APIs, our own
 * webhook-fed message counts). Anything without a free/real-time signal
 * (X/Twitter, Discord message counts without a live gateway bot) resolves
 * to PENDING and lands in the admin manual-review queue.
 */
export async function runVerifier(userId: string, quest: Quest, brand: Brand): Promise<VerifyOutcome> {
  switch (quest.type) {
    case "VISIT_LINK":
    case "DAILY_CHECKIN":
      return { status: "VERIFIED" };

    case "JOIN_DISCORD": {
      if (!brand.discordGuildId) return { status: "PENDING", reason: "Brand has no Discord guild configured" };
      const link = await prisma.discordLink.findUnique({ where: { userId } });
      if (!link) return { status: "REJECTED", reason: "Link your Discord account first" };
      const isMember = await isDiscordGuildMember(brand.discordGuildId, link.discordUserId);
      return isMember
        ? { status: "VERIFIED" }
        : { status: "REJECTED", reason: "Not a member of the Discord server yet" };
    }

    case "JOIN_TELEGRAM": {
      if (!brand.telegramChatId) return { status: "PENDING", reason: "Brand has no Telegram chat configured" };
      const link = await prisma.telegramLink.findUnique({ where: { userId } });
      if (!link) return { status: "REJECTED", reason: "Link your Telegram account first" };
      const isMember = await isTelegramChatMember(brand.telegramChatId, link.telegramUserId);
      return isMember
        ? { status: "VERIFIED" }
        : { status: "REJECTED", reason: "Not a member of the Telegram chat yet" };
    }

    case "TELEGRAM_MESSAGE_COUNT": {
      if (!brand.telegramChatId) return { status: "PENDING", reason: "Brand has no Telegram chat configured" };
      const link = await prisma.telegramLink.findUnique({ where: { userId } });
      if (!link) return { status: "REJECTED", reason: "Link your Telegram account first" };

      const config = quest.config as Record<string, unknown>;
      const required = typeof config.requiredCount === "number" ? config.requiredCount : 10;

      const row = await prisma.telegramMessageCount.findUnique({
        where: { chatId_userId: { chatId: brand.telegramChatId, userId: link.telegramUserId } },
      });
      const count = row?.count ?? 0;
      return count >= required
        ? { status: "VERIFIED" }
        : { status: "REJECTED", reason: `${count}/${required} messages sent` };
    }

    // FOLLOW_X: X/Twitter's API requires a paid tier to check follow/like/retweet
    // status, so this is routed to manual admin review instead of faked.
    // DISCORD_MESSAGE_COUNT: Discord has no REST endpoint for historical message
    // counts — it requires a persistent gateway bot, which is out of scope for
    // a serverless deployment. Also routed to manual review until a worker exists.
    case "FOLLOW_X":
    case "DISCORD_MESSAGE_COUNT":
    case "CUSTOM":
    default:
      return { status: "PENDING" };
  }
}
