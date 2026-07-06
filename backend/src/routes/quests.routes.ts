import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { runVerifier } from "../lib/verifiers";

export const questsRouter = Router();

questsRouter.post(
  "/:id/complete",
  requireAuth,
  asyncHandler(async (req, res) => {
    const quest = await prisma.quest.findUnique({
      where: { id: req.params.id },
      include: { campaign: { include: { brand: true } } },
    });
    if (!quest) return res.status(404).json({ error: "Quest not found" });

    const userId = req.user!.id;

    const existing = await prisma.questCompletion.findUnique({
      where: { questId_userId: { questId: quest.id, userId } },
    });
    if (existing?.status === "VERIFIED") {
      return res.json({ status: "VERIFIED", alreadyCompleted: true });
    }

    const outcome = await runVerifier(userId, quest, quest.campaign.brand);
    const nowVerified = outcome.status === "VERIFIED";

    await prisma.questCompletion.upsert({
      where: { questId_userId: { questId: quest.id, userId } },
      create: {
        questId: quest.id,
        userId,
        status: outcome.status,
        verifiedAt: nowVerified ? new Date() : null,
        evidence: outcome.reason ? { reason: outcome.reason } : undefined,
      },
      update: {
        status: outcome.status,
        verifiedAt: nowVerified ? new Date() : null,
        evidence: outcome.reason ? { reason: outcome.reason } : undefined,
      },
    });

    // existing.status can never be VERIFIED here — that case returned early above.
    if (nowVerified) {
      await prisma.user.update({ where: { id: userId }, data: { xp: { increment: quest.xpReward } } });
    }

    res.json({ status: outcome.status, reason: outcome.reason ?? null });
  }),
);
