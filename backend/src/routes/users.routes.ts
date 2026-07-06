import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/errorHandler";

export const usersRouter = Router();

usersRouter.use(requireAuth);

const usernameSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,24}$/, "3-24 letters, numbers, or underscores"),
});

usersRouter.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const { username } = usernameSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== req.user!.id) {
      throw new HttpError(409, "Username already taken");
    }

    const user = await prisma.user.update({ where: { id: req.user!.id }, data: { username } });
    res.json({ id: user.id, username: user.username });
  }),
);

usersRouter.get(
  "/me/balance",
  asyncHandler(async (req, res) => {
    const agg = await prisma.tokenLedgerEntry.aggregate({
      where: { userId: req.user!.id },
      _sum: { amount: true },
    });
    res.json({ balance: agg._sum.amount ?? 0 });
  }),
);

usersRouter.get(
  "/me/inventory",
  asyncHandler(async (req, res) => {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const take = 25;

    const entries = await prisma.crateOpenLedger.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { brand: { select: { name: true, slug: true } } },
    });

    const hasMore = entries.length > take;
    const page = entries.slice(0, take);

    res.json({
      items: page.map((e) => ({
        id: e.id,
        brand: e.brand.name,
        brandSlug: e.brand.slug,
        tier: e.tier,
        amount: e.amount,
        createdAt: e.createdAt,
      })),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    });
  }),
);
