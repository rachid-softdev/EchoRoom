import { env } from "@/lib/env";

export interface PriceTier {
  id: string;
  label: string;
  credits: number;
  priceCents: number;
  stripePriceId: string;
  features: string[];
  highlighted: boolean;
  cta: string;
}

function resolveStripePriceId(tierId: string): string {
  if (tierId === "starter") return env.STRIPE_PRICE_STARTER || `price_dev_starter`;
  if (tierId === "pro") return env.STRIPE_PRICE_PRO || `price_dev_pro`;
  return `price_dev_${tierId}`;
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
]);
