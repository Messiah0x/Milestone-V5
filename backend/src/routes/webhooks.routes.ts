import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { env } from "../env";
import { stripe } from "../lib/stripe";
import { asyncHandler } from "../middleware/asyncHandler";

// Stripe requires the raw request body for signature verification, so this
// handler is mounted in app.ts with express.raw() *before* the global JSON
// body parser — it is intentionally not part of the JSON-parsed webhooksRouter.
export const stripeWebhookHandler = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send("Missing signature");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${(err as Error).message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as { customer: string; subscription: string | null; metadata?: { userId?: string } };
      const userId = session.metadata?.userId;
      if (userId) {
        await prisma.subscription.update({
          where: { userId },
          data: { stripeSubscriptionId: session.subscription ?? undefined, status: "ACTIVE" },
        });
        await prisma.user.update({ where: { id: userId }, data: { plan: "VERIFIED" } });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as { id: string; status: string; current_period_end: number };
      const record = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
      if (record) {
        const active = sub.status === "active" || sub.status === "trialing";
        await prisma.subscription.update({
          where: { id: record.id },
          data: {
            status: active ? "ACTIVE" : sub.status === "past_due" ? "PAST_DUE" : "CANCELED",
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        });
        await prisma.user.update({ where: { id: record.userId }, data: { plan: active ? "VERIFIED" : "BASIC" } });
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
});

export const webhooksRouter = Router();

// Telegram delivers plain JSON updates; verified via the shared secret token
// header we configured in setWebhook (see lib/telegram.ts).
webhooksRouter.post(
  "/telegram",
  asyncHandler(async (req, res) => {
    const secret = req.header("X-Telegram-Bot-Api-Secret-Token");
    if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return res.sendStatus(401);
    }

    const message = req.body?.message;
    if (message?.chat?.id && message?.from?.id && !message.from.is_bot) {
      const chatId = String(message.chat.id);
      const userId = String(message.from.id);
      await prisma.telegramMessageCount.upsert({
        where: { chatId_userId: { chatId, userId } },
        create: { chatId, userId, count: 1 },
        update: { count: { increment: 1 } },
      });
    }

    res.sendStatus(200);
  }),
);
