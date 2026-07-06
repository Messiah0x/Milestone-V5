import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/errorHandler";
import { rollCrate } from "../lib/rewards";

export const cratesRouter = Router();

cratesRouter.use(requireAuth);

cratesRouter.get(
  "/balance",
  asyncHandler(async (req, res) => {
    const balances = await prisma.crateBalance.findMany({
      where: { userId: req.user!.id, count: { gt: 0 } },
      include: { brand: { select: { name: true, slug: true, logoUrl: true } } },
    });

    res.json({
      items: balances.map((b) => ({
        brandId: b.brandId,
        brand: b.brand.name,
        brandSlug: b.brand.slug,
        logoUrl: b.brand.logoUrl,
        count: b.count,
      })),
    });
  }),
);

cratesRouter.post(
  "/:brandId/open",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { brandId } = req.params;

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return res.status(404).json({ error: "Brand not found" });

    // Server-authoritative, race-safe: this UPDATE only affects a row if it
    // still has count > 0, so two concurrent opens can't both succeed against
    // a balance of 1. If zero rows were touched, the user had no crates left.
    const decremented = await prisma.crateBalance.updateMany({
      where: { userId, brandId, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });

    if (decremented.count === 0) {
      throw new HttpError(409, "No crates available to open");
    }

    const reward = rollCrate(req.user!.plan === "VERIFIED");

    const [ledgerEntry] = await prisma.$transaction([
      prisma.crateOpenLedger.create({
        data: { userId, brandId, tier: reward.tier, amount: reward.amount },
      }),
      prisma.tokenLedgerEntry.create({
        data: { userId, amount: reward.amount, reason: "CRATE_OPEN" },
      }),
    ]);

    res.json({
      tier: ledgerEntry.tier,
      amount: ledgerEntry.amount,
      brand: brand.name,
      openedAt: ledgerEntry.createdAt,
    });
  }),
);
