import { Router } from "express";
import { prisma } from "../lib/prisma";
import { env } from "../env";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/errorHandler";
import { stripe, getOrCreateStripeCustomer } from "../lib/stripe";

export const billingRouter = Router();

billingRouter.post(
  "/checkout",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_VERIFIED_PRICE_ID) {
      throw new HttpError(503, "Billing is not configured yet");
    }

    const userId = req.user!.id;
    const existing = await prisma.subscription.findUnique({ where: { userId } });
    const customerId = await getOrCreateStripeCustomer(userId, existing?.stripeCustomerId ?? null);

    if (!existing) {
      await prisma.subscription.create({
        data: { userId, stripeCustomerId: customerId, status: "INCOMPLETE" },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: env.STRIPE_VERIFIED_PRICE_ID, quantity: 1 }],
      success_url: `${env.API_BASE_URL}/billing/success`,
      cancel_url: `${env.API_BASE_URL}/billing/cancel`,
      metadata: { userId },
    });

    res.json({ url: session.url });
  }),
);
