import { env } from "@/lib/env";

/** Ordered plan tiers, lowest to highest entitlement. Single source of truth. */
export type PlanTier = "free" | "starter" | "pro" | "ultra";

export interface PriceTier {
  id: PlanTier;
  label: string;
  credits: number;
  priceCents: number;
  stripePriceId: string;
  features: string[];
  highlighted: boolean;
  cta: string;
}

/** Rank of each tier (0 = lowest). Used for "at least" entitlement checks. */
export const TIER_RANK: Readonly<Record<PlanTier, number>> = Object.freeze({
  free: 0,
  starter: 1,
  pro: 2,
  ultra: 3,
});

export function tierRank(tier: PlanTier): number {
  return TIER_RANK[tier];
}

/** True when `actual` is the same as or higher than `minimum`. */
export function tierMeetsMinimum(actual: PlanTier, minimum: PlanTier): boolean {
  return TIER_RANK[actual] >= TIER_RANK[minimum];
}

function resolveStripePriceId(tierId: PlanTier): string {
  if (tierId === "starter") {
    if (!env.STRIPE_PRICE_STARTER) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Missing STRIPE_PRICE_STARTER env var for ${tierId}`);
      }
      return `price_dev_starter`;
    }
    return env.STRIPE_PRICE_STARTER;
  }
  if (tierId === "pro") {
    if (!env.STRIPE_PRICE_PRO) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Missing STRIPE_PRICE_PRO env var for ${tierId}`);
      }
      return `price_dev_pro`;
    }
    return env.STRIPE_PRICE_PRO;
  }
  if (tierId === "ultra") {
    if (!env.STRIPE_PRICE_ULTRA) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Missing STRIPE_PRICE_ULTRA env var for ${tierId}`);
      }
      return `price_dev_ultra`;
    }
    return env.STRIPE_PRICE_ULTRA;
  }
  // "free" and any unknown tier
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Unknown tier: ${tierId}`);
  }
  return `price_dev_${tierId}`;
}

/**
 * Maps a Prisma `UserBilling.plan` value to the canonical `PlanTier`.
 *
 * The Prisma enum is expected to be uppercase (FREE/STARTER/PRO/ULTRA); we also
 * tolerate lowercase for robustness. Unknown/missing values default to "free".
 */
export function prismaPlanToTier(plan: string | null | undefined): PlanTier {
  switch ((plan ?? "").trim().toUpperCase()) {
    case "ULTRA":
      return "ultra";
    case "PRO":
      return "pro";
    case "STARTER":
      return "starter";
    case "FREE":
      return "free";
    default:
      return "free";
  }
}

export const PRICING_CONFIG: readonly PriceTier[] = Object.freeze([
  {
    id: "free",
    label: "Découverte",
    credits: 5,
    priceCents: 0,
    stripePriceId: "",
    features: [
      "5 crédits offerts",
      "8 personnages IA",
      "Accès à la bibliothèque",
      "Feed communautaire",
    ],
    cta: "Commencer",
    highlighted: false,
  },
  {
    id: "starter",
    label: "Starter",
    credits: 50,
    priceCents: 999,
    stripePriceId: resolveStripePriceId("starter"),
    features: [
      "50 crédits",
      "Tous les personnages",
      "Création de scénarios illimitée",
      "Replay des appels",
      "Partage viral",
    ],
    cta: "Choisir Starter",
    highlighted: true,
  },
  {
    id: "pro",
    label: "Pro",
    credits: 200,
    priceCents: 2499,
    stripePriceId: resolveStripePriceId("pro"),
    features: [
      "200 crédits",
      "Tout le starter",
      "Scénarios en avant-première",
      "Badge créateur",
      "Support prioritaire",
    ],
    cta: "Choisir Pro",
    highlighted: false,
  },
  {
    id: "ultra",
    label: "Ultra",
    credits: 1000,
    priceCents: 4999,
    stripePriceId: resolveStripePriceId("ultra"),
    features: [
      "1000 crédits",
      "Tout le Pro",
      "Appels jusqu'à 600s",
      "Rooms multijoueurs / écoute entre amis",
      "Voix premium ElevenLabs",
      "Accès API",
      "Aucune limite d'appels quotidiens",
      "Accès anticipé (Beta)",
    ],
    cta: "Choisir Ultra",
    highlighted: false,
  },
]);
