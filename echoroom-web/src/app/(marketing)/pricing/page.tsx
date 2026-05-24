"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui";
import { Check, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/trpc";
import { useApiToast } from "@/lib/trpc-error";

interface Plan {
  name: string
  price: string
  credits: number
  priceId: string
  features: string[]
  cta: string
  highlighted: boolean
}

const plans: Plan[] = [
  {
    name: "Découverte",
    price: "Gratuit",
    credits: 5,
    priceId: "",
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
    name: "Starter",
    price: "9,99 €",
    credits: 50,
    priceId: "price_starter",
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
    name: "Pro",
    price: "24,99 €",
    credits: 200,
    priceId: "price_pro",
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
];

export default function PricingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const checkout = useApiToast(api.billing.createCheckout.useMutation(), {
    success: "Redirection vers le paiement...",
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  function handleBuy(plan: Plan) {
    if (!session) {
      router.push("/login");
      return;
    }
    if (!plan.priceId) return;
    checkout.mutate({ priceId: plan.priceId, credits: plan.credits });
  }

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="text-xl font-bold tracking-tight">
          EchoRoom
        </Link>
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Connexion
          </Button>
        </Link>
      </nav>

      <section className="flex-1 px-6 py-16 max-w-5xl mx-auto w-full">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            Tarifs
          </Badge>
          <h1 className="text-4xl font-bold mb-3">
            Un crédit = un appel IA
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Payez uniquement ce que vous utilisez. Pas d&apos;abonnement caché, pas de
            surprise.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative border-border/50 ${
                plan.highlighted
                  ? "border-primary/50 ring-1 ring-primary/20"
                  : ""
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge>Populaire</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.price !== "Gratuit" && (
                    <span className="text-muted-foreground ml-1">/ mois</span>
                  )}
                </div>
                <CardDescription className="mt-2">
                  {plan.credits} crédits par mois
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.price === "Gratuit" ? (
                  <Link href="/register">
                    <Button className="w-full" variant="outline">
                      {plan.cta}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    onClick={() => handleBuy(plan)}
                    disabled={checkout.isPending}
                  >
                    {checkout.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      plan.cta
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
