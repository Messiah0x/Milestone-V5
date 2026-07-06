import Stripe from "stripe";
import { env } from "../env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY || "sk_test_placeholder");

export async function getOrCreateStripeCustomer(userId: string, existingCustomerId: string | null): Promise<string> {
  if (existingCustomerId) return existingCustomerId;
  const customer = await stripe.customers.create({ metadata: { userId } });
  return customer.id;
}
