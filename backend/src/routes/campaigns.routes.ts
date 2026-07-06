import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { optionalAuth } from "../middleware/auth";

export const campaignsRouter = Router();

// Trending strip: active campaigns ordered by trendingRank (nulls last), then recency.
campaignsRouter.get(
  "/trending",
  asyncHandler(async (_req, res) => {
    const campaigns = await prisma.campaign.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ trendingRank: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      include: { brand: { select: { name: true, slug: true, logoUrl: true } } },
    });

    res.json({
      items: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        brand: c.brand,
      })),
    });
  }),
);

campaignsRouter.get(
  "/:id/quests",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
        quests: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const completions = req.user
      ? await prisma.questCompletion.findMany({
          where: { userId: req.user.id, questId: { in: campaign.quests.map((q) => q.id) } },
        })
      : [];
    const completionByQuest = new Map(completions.map((c) => [c.questId, c]));

    res.json({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      brand: campaign.brand,
      quests: campaign.quests.map((q) => ({
        id: q.id,
        type: q.type,
        title: q.title,
        description: q.description,
        targetUrl: q.targetUrl,
        xpReward: q.xpReward,
        verificationMode: q.verificationMode,
        status: completionByQuest.get(q.id)?.status ?? null,
      })),
    });
  }),
);
