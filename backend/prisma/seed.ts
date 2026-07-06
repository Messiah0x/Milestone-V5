import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

interface QuestSeed {
  type:
    | "FOLLOW_X"
    | "VISIT_LINK"
    | "JOIN_DISCORD"
    | "JOIN_TELEGRAM"
    | "DISCORD_MESSAGE_COUNT"
    | "TELEGRAM_MESSAGE_COUNT"
    | "DAILY_CHECKIN"
    | "CUSTOM";
  title: string;
  targetUrl?: string;
  xpReward: number;
  verificationMode: "AUTO" | "MANUAL";
  config?: Record<string, unknown>;
}

function questSet(opts: { xHandle: string; website: string; community: "discord" | "telegram" }): QuestSeed[] {
  const communityQuest: QuestSeed =
    opts.community === "discord"
      ? { type: "JOIN_DISCORD", title: "Join the Discord", xpReward: 20, verificationMode: "AUTO" }
      : { type: "JOIN_TELEGRAM", title: "Join the Telegram", xpReward: 20, verificationMode: "AUTO" };

  const messageQuest: QuestSeed =
    opts.community === "discord"
      ? { type: "DISCORD_MESSAGE_COUNT", title: "Send 10 messages in general chat", xpReward: 25, verificationMode: "MANUAL" }
      : {
          type: "TELEGRAM_MESSAGE_COUNT",
          title: "Send 10 messages in Telegram general chat",
          xpReward: 25,
          verificationMode: "AUTO",
          config: { requiredCount: 10 },
        };

  return [
    { type: "VISIT_LINK", title: "Follow on Milestone", xpReward: 10, verificationMode: "AUTO" },
    { type: "FOLLOW_X", title: "Follow on X", targetUrl: opts.xHandle, xpReward: 15, verificationMode: "MANUAL" },
    { type: "VISIT_LINK", title: "Visit the website", targetUrl: opts.website, xpReward: 10, verificationMode: "AUTO" },
    communityQuest,
    { type: "CUSTOM", title: "Interaction with announcement", xpReward: 15, verificationMode: "MANUAL" },
    messageQuest,
    { type: "DAILY_CHECKIN", title: "Daily check in", xpReward: 5, verificationMode: "AUTO" },
  ];
}

const BRANDS = [
  {
    name: "Superteam",
    slug: "superteam",
    trendingRank: 0,
    websiteUrl: "https://superteam.ca/",
    telegramChatId: "",
    quests: questSet({ xHandle: "https://x.com/SuperteamCAN", website: "https://superteam.ca/", community: "telegram" }),
  },
  {
    name: "MetaMask",
    slug: "metamask",
    trendingRank: 1,
    websiteUrl: "https://metamask.io",
    discordGuildId: "",
    quests: questSet({ xHandle: "https://x.com/MetaMask", website: "https://metamask.io", community: "discord" }),
  },
  {
    name: "Phantom",
    slug: "phantom",
    trendingRank: 2,
    websiteUrl: "https://phantom.app",
    discordGuildId: "",
    quests: questSet({ xHandle: "https://x.com/phantom", website: "https://phantom.app", community: "discord" }),
  },
  {
    name: "Backpack",
    slug: "backpack",
    trendingRank: 3,
    websiteUrl: "https://backpack.app",
    discordGuildId: "",
    quests: questSet({ xHandle: "https://x.com/Backpack", website: "https://backpack.app", community: "discord" }),
  },
];

async function main() {
  for (const b of BRANDS) {
    const brand = await prisma.brand.upsert({
      where: { slug: b.slug },
      create: {
        name: b.name,
        slug: b.slug,
        websiteUrl: b.websiteUrl,
        discordGuildId: (b as { discordGuildId?: string }).discordGuildId || null,
        telegramChatId: (b as { telegramChatId?: string }).telegramChatId || null,
      },
      update: {},
    });

    const campaign =
      (await prisma.campaign.findFirst({ where: { brandId: brand.id } })) ??
      (await prisma.campaign.create({
        data: { brandId: brand.id, name: `${b.name} Genesis Campaign`, status: "ACTIVE", trendingRank: b.trendingRank },
      }));

    const questCount = await prisma.quest.count({ where: { campaignId: campaign.id } });
    if (questCount === 0) {
      await prisma.quest.createMany({
        data: b.quests.map((q, i) => ({
          campaignId: campaign.id,
          type: q.type,
          title: q.title,
          targetUrl: q.targetUrl ?? null,
          xpReward: q.xpReward,
          verificationMode: q.verificationMode,
          config: (q.config ?? {}) as Prisma.InputJsonValue,
          sortOrder: i,
        })),
      });
    }

    console.log(`Seeded brand: ${b.name}`);
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@milestone.app";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "change-me-before-seeding";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, passwordHash, role: "SUPERADMIN" },
    update: {},
  });

  console.log(`Seeded superadmin: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
