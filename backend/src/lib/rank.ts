export interface RankTier {
  tier: string;
  minXp: number;
  maxXp: number; // exclusive upper bound, Infinity for the last tier
  icon: string;
}

// Pure XP thresholds. Adding a tier or rebalancing thresholds never requires
// a migration or backfill — rank is always derived from `User.xp`.
export const RANK_TIERS: RankTier[] = [
  { tier: "Bronze I", minXp: 0, maxXp: 200, icon: "bronze" },
  { tier: "Bronze II", minXp: 200, maxXp: 400, icon: "bronze" },
  { tier: "Silver I", minXp: 400, maxXp: 700, icon: "silver" },
  { tier: "Silver II", minXp: 700, maxXp: 1000, icon: "silver" },
  { tier: "Gold I", minXp: 1000, maxXp: 1400, icon: "gold" },
  { tier: "Gold II", minXp: 1400, maxXp: 2000, icon: "gold" },
  { tier: "Platinum I", minXp: 2000, maxXp: 2800, icon: "platinum" },
  { tier: "Platinum V", minXp: 2800, maxXp: 4000, icon: "platinum" },
  { tier: "Diamond", minXp: 4000, maxXp: Infinity, icon: "diamond" },
];

export interface RankProgress {
  tier: string;
  icon: string;
  xp: number;
  xpIntoTier: number;
  xpForNextTier: number | null; // null at max tier
  pct: number; // 0-100
}

export function rankForXp(xp: number): RankProgress {
  const safeXp = Math.max(0, xp);
  const current = RANK_TIERS.find((t) => safeXp >= t.minXp && safeXp < t.maxXp) ?? RANK_TIERS[RANK_TIERS.length - 1];

  const span = current.maxXp - current.minXp;
  const xpIntoTier = safeXp - current.minXp;
  const pct = Number.isFinite(span) ? Math.round((xpIntoTier / span) * 100) : 100;

  return {
    tier: current.tier,
    icon: current.icon,
    xp: safeXp,
    xpIntoTier,
    xpForNextTier: Number.isFinite(current.maxXp) ? current.maxXp : null,
    pct: Math.min(100, Math.max(0, pct)),
  };
}
