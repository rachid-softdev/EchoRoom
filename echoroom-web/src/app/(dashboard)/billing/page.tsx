"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui";
import { CreditCard, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { api } from "@/lib/trpc";
import { useApiToast } from "@/lib/trpc-error";

interface CreditPack {
  credits: number
  price: string
  priceId: string
  popular: boolean
}

const creditPacks: CreditPack[] = [
  { credits: 10, price: "2,99 €", priceId: "price_10", popular: false },
  { credits: 50, price: "9,99 €", priceId: "price_50", popular: true },
  { credits: 200, price: "24,99 €", priceId: "price_200", popular: false },
  { credits: 500, price: "49,99 €", priceId: "price_500", popular: false },
];

export default function BillingPage() {
  const creditsQuery = api.billing.getCredits.useQuery();
  const checkout = useApiToast(api.billing.createCheckout.useMutation(), {
    success: "Redirection vers le paiement...",
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const credits = creditsQuery.data?.credits ?? 0;

  function handleBuy(pack: CreditPack) {
    checkout.mutate({ priceId: pack.priceId, credits: pack.credits });
  }

  return (
    <DashboardShell title="Crédits & Facturation">
      <p className="text-muted-foreground mb-8">
        Solde actuel :{" "}
        <Badge variant="secondary" className="ml-1">
          {credits} crédits
        </Badge>
      </p>

      <h2 className="text-xl font-semibold mb-4">Acheter des crédits</h2>
      <div id="credit-packs" className="grid md:grid-cols-4 gap-4 mb-10">
        {creditPacks.map((pack) => (
          <Card
            key={pack.credits}
            className={`relative ${
              pack.popular ? "border-primary/50 ring-1 ring-primary/20" : ""
            }`}
          >
            {pack.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge>Populaire</Badge>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl font-bold">{pack.credits}</CardTitle>
              <CardDescription>crédits</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold mb-4">{pack.price}</p>
              <Button
                className="w-full"
                variant={pack.popular ? "default" : "outline"}
                size="sm"
                onClick={() => handleBuy(pack)}
                disabled={checkout.isPending}
              >
                {checkout.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Acheter"
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment history */}
      <h2 className="text-xl font-semibold mb-4">Historique des achats</h2>
      <Card>
        <CardContent className="py-12 text-center">
          <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Aucun achat pour le moment</p>
          <Button variant="outline" size="sm" onClick={() => {
            const el = document.getElementById("credit-packs");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}>
            Acheter des crédits
          </Button>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
