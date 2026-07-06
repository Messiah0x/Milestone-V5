import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../env";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";
import { signSession } from "../lib/jwt";
import { generateNonce, buildSiweMessage, verifySiwe } from "../lib/siwe";
import { generateSolanaNonce, buildSiwsMessage, verifySiws } from "../lib/siws";
import { rankForXp } from "../lib/rank";

export const authRouter = Router();

const NONCE_TTL_MS = 10 * 60 * 1000;

const nonceSchema = z.object({
  address: z.string().min(1),
  chain: z.enum(["EVM", "SOLANA"]),
});

authRouter.post(
  "/nonce",
  asyncHandler(async (req, res) => {
    const { address, chain } = nonceSchema.parse(req.body);
    const normalized = chain === "EVM" ? address.toLowerCase() : address;

    const nonce = chain === "EVM" ? generateNonce() : generateSolanaNonce();
    const domain = new URL(env.API_BASE_URL).host;
    const message =
      chain === "EVM"
        ? buildSiweMessage(address, nonce, domain, env.API_BASE_URL)
        : buildSiwsMessage(address, nonce, domain);

    await prisma.authNonce.create({
      data: {
        address: normalized,
        chain,
        nonce,
        message,
        expiresAt: new Date(Date.now() + NONCE_TTL_MS),
      },
    });

    res.json({ nonce, message });
  }),
);

const verifySchema = z.object({
  address: z.string().min(1),
  chain: z.enum(["EVM", "SOLANA"]),
  signature: z.string().min(1),
  message: z.string().min(1),
});

authRouter.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const { address, chain, signature, message } = verifySchema.parse(req.body);
    const normalized = chain === "EVM" ? address.toLowerCase() : address;

    const record = await prisma.authNonce.findFirst({
      where: { address: normalized, chain, message, usedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new HttpError(401, "Nonce expired or not found — request a new one");
    }

    let verifiedAddress: string | null = null;
    if (chain === "EVM") {
      const result = await verifySiwe(message, signature, record.nonce);
      verifiedAddress = result.success ? result.address : null;
    } else {
      const ok = verifySiws(message, signature, address);
      verifiedAddress = ok ? address : null;
    }

    if (!verifiedAddress || verifiedAddress.toLowerCase() !== normalized.toLowerCase()) {
      throw new HttpError(401, "Signature verification failed");
    }

    await prisma.authNonce.update({ where: { id: record.id }, data: { usedAt: new Date() } });

    let wallet = await prisma.wallet.findUnique({ where: { chain_address: { chain, address: normalized } } });

    let userId: string;
    if (wallet) {
      userId = wallet.userId;
    } else {
      const user = await prisma.user.create({ data: {} });
      wallet = await prisma.wallet.create({
        data: { userId: user.id, chain, address: normalized, isPrimary: true },
      });
      userId = user.id;
    }

    const token = signSession({ sub: userId });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        plan: user.plan,
        rank: rankForXp(user.xp),
      },
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const wallets = await prisma.wallet.findMany({ where: { userId: user.id } });
    const discordLink = await prisma.discordLink.findUnique({ where: { userId: user.id } });
    const telegramLink = await prisma.telegramLink.findUnique({ where: { userId: user.id } });

    res.json({
      id: user.id,
      username: user.username,
      plan: user.plan,
      rank: rankForXp(user.xp),
      wallets: wallets.map((w) => ({ chain: w.chain, address: w.address, isPrimary: w.isPrimary })),
      discordLinked: Boolean(discordLink),
      telegramLinked: Boolean(telegramLink),
    });
  }),
);
