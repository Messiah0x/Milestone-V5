import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAdmin, requireSuperadmin, brandScope } from "../middleware/adminAuth";
import { signAdminSession } from "../lib/jwt";

export const adminRouter = Router();

const AUTO_TYPES = new Set(["VISIT_LINK", "JOIN_DISCORD", "JOIN_TELEGRAM", "TELEGRAM_MESSAGE_COUNT", "DAILY_CHECKIN"]);

adminRouter.get("/login", (_req, res) => {
  res.render("login", { error: null });
});

adminRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const admin = email ? await prisma.adminUser.findUnique({ where: { email } }) : null;
    const valid = admin ? await bcrypt.compare(password ?? "", admin.passwordHash) : false;

    if (!admin || !valid) {
      return res.status(401).render("login", { error: "Invalid email or password" });
    }

    const token = signAdminSession({ sub: admin.id, role: admin.role, brandId: admin.brandId });
    res.cookie("admin_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 12 * 60 * 60 * 1000,
    });
    res.redirect("/admin");
  }),
);

adminRouter.post("/logout", (_req, res) => {
  res.clearCookie("admin_session");
  res.redirect("/admin/login");
});

adminRouter.use(requireAdmin);

adminRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const isSuperadmin = req.admin!.role === "SUPERADMIN";
    const scopedBrandId = req.admin!.brandId ?? "__none__";

    const brands = await prisma.brand.findMany({
      where: isSuperadmin ? {} : { id: scopedBrandId },
      orderBy: { name: "asc" },
    });

    const campaigns = await prisma.campaign.findMany({
      where: isSuperadmin ? {} : { brandId: scopedBrandId },
      include: { brand: true, _count: { select: { quests: true } } },
      orderBy: { createdAt: "desc" },
    });

    const pending = await prisma.questCompletion.findMany({
      where: {
        status: "PENDING",
        ...(isSuperadmin ? {} : { quest: { campaign: { brandId: scopedBrandId } } }),
      },
      include: { quest: { include: { campaign: { include: { brand: true } } } }, user: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    res.render("dashboard", { admin: req.admin, brands, campaigns, pending });
  }),
);

adminRouter.post(
  "/brands",
  requireSuperadmin,
  asyncHandler(async (req, res) => {
    const { name, slug, logoUrl, discordGuildId, telegramChatId, xHandle } = req.body;
    await prisma.brand.create({
      data: {
        name,
        slug,
        logoUrl: logoUrl || null,
        discordGuildId: discordGuildId || null,
        telegramChatId: telegramChatId || null,
        xHandle: xHandle || null,
      },
    });
    res.redirect("/admin");
  }),
);

adminRouter.post(
  "/campaigns",
  asyncHandler(async (req, res) => {
    const { brandId, name, status, trendingRank } = req.body;
    if (!brandScope(req, brandId)) return res.status(403).send("Forbidden");

    await prisma.campaign.create({
      data: {
        brandId,
        name,
        status: status || "DRAFT",
        trendingRank: trendingRank ? Number(trendingRank) : null,
      },
    });
    res.redirect("/admin");
  }),
);

adminRouter.get(
  "/campaigns/:id",
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: { brand: true, quests: { orderBy: { sortOrder: "asc" } } },
    });
    if (!campaign) return res.status(404).send("Campaign not found");
    if (!brandScope(req, campaign.brandId)) return res.status(403).send("Forbidden");

    res.render("campaign", { admin: req.admin, campaign });
  }),
);

adminRouter.post(
  "/campaigns/:id/quests",
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) return res.status(404).send("Campaign not found");
    if (!brandScope(req, campaign.brandId)) return res.status(403).send("Forbidden");

    const { title, description, type, targetUrl, xpReward, requiredCount } = req.body;

    await prisma.quest.create({
      data: {
        campaignId: campaign.id,
        title,
        description: description || null,
        type,
        targetUrl: targetUrl || null,
        xpReward: Number(xpReward) || 10,
        verificationMode: AUTO_TYPES.has(type) ? "AUTO" : "MANUAL",
        config: requiredCount ? { requiredCount: Number(requiredCount) } : {},
      },
    });
    res.redirect(`/admin/campaigns/${campaign.id}`);
  }),
);

async function resolveCompletion(req: import("express").Request, id: string) {
  const completion = await prisma.questCompletion.findUnique({
    where: { id },
    include: { quest: { include: { campaign: true } } },
  });
  if (!completion) return null;
  if (!brandScope(req, completion.quest.campaign.brandId)) return null;
  return completion;
}

adminRouter.post(
  "/completions/:id/approve",
  asyncHandler(async (req, res) => {
    const completion = await resolveCompletion(req, req.params.id);
    if (!completion) return res.status(404).send("Not found");

    await prisma.$transaction([
      prisma.questCompletion.update({
        where: { id: completion.id },
        data: { status: "VERIFIED", verifiedAt: new Date(), reviewedBy: req.admin!.sub, reviewedAt: new Date() },
      }),
      ...(completion.status !== "VERIFIED"
        ? [prisma.user.update({ where: { id: completion.userId }, data: { xp: { increment: completion.quest.xpReward } } })]
        : []),
    ]);

    res.redirect("/admin");
  }),
);

adminRouter.post(
  "/completions/:id/reject",
  asyncHandler(async (req, res) => {
    const completion = await resolveCompletion(req, req.params.id);
    if (!completion) return res.status(404).send("Not found");

    await prisma.questCompletion.update({
      where: { id: completion.id },
      data: { status: "REJECTED", reviewedBy: req.admin!.sub, reviewedAt: new Date() },
    });

    res.redirect("/admin");
  }),
);

adminRouter.post(
  "/crates/grant",
  asyncHandler(async (req, res) => {
    const { userId, brandId, count } = req.body;
    if (!brandScope(req, brandId)) return res.status(403).send("Forbidden");

    const amount = Math.max(1, Number(count) || 1);
    await prisma.crateBalance.upsert({
      where: { userId_brandId: { userId, brandId } },
      create: { userId, brandId, count: amount },
      update: { count: { increment: amount } },
    });

    res.redirect("/admin");
  }),
);
