import crypto from "node:crypto";
import type { CrateTier } from "@prisma/client";

interface TierSpec {
  tier: CrateTier;
  weight: number; // out of 1000, so we can express 0.5%
  baseAmount: number;
}

// Normal 47.5%, Rare 47%, Unique 5%, Mythic 0.5% — weights sum to 1000.
const TIERS: TierSpec[] = [
  { tier: "NORMAL", weight: 475, baseAmount: 10 },
  { tier: "RARE", weight: 470, baseAmount: 25 },
  { tier: "UNIQUE", weight: 50, baseAmount: 100 },
  { tier: "MYTHIC", weight: 5, baseAmount: 500 },
];

const TOTAL_WEIGHT = TIERS.reduce((sum, t) => sum + t.weight, 0);

export interface CrateRoll {
  tier: CrateTier;
  amount: number;
}

/**
 * Cryptographically secure, server-only crate roll. Never expose the RNG or
 * odds resolution to the client — it only ever sees the final result.
 */
export function rollCrate(verifiedPlanBoost: boolean): CrateRoll {
  const roll = crypto.randomInt(0, TOTAL_WEIGHT); // [0, TOTAL_WEIGHT)

  let cursor = 0;
  let chosen: TierSpec = TIERS[0];
  for (const spec of TIERS) {
    cursor += spec.weight;
    if (roll < cursor) {
      chosen = spec;
      break;
    }
  }

  const boost = verifiedPlanBoost ? 1.2 : 1;
  const amount = Math.round(chosen.baseAmount * boost);

  return { tier: chosen.tier, amount };
}
