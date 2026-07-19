"use client";

import { PRICING_CONFIG, type PlanTier } from "@/config/pricing";
import { CreditCard, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  toast,
} from "@echoroom/ui";
import { api } from "@/lib/trpc";
import { useApiToast } from "@/lib/trpc-error";

// Paid tiers are rendered dynamically from PRICING_CONFIG so the UI always
// matches the source of truth (previously the page hardcoded price_10/50/200/500
// ids that no longer exist, breaking checkout).
const paidTiers = PRICING_CONFIG.filter((t) => t.id !== "free");

function formatPrice(priceCents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(priceCents / 100);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default function BillingPage() {
  const creditsQuery = api.billing.getCredits.useQuery();
  const purchasesQuery = api.billing.getPurchases.useQuery();

  // Gérer le retour depuis Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const canceled = params.get("canceled");

    if (success === "true") {
      toast({
        title: "Achat réussi ! Vos crédits ont été ajoutés à votre compte.",
        variant: "success",
      });
      // Nettoyer l'URL sans recharger la page
      window.history.replaceState({}, "", window.location.pathname);
      // Rafraîchir les données
      creditsQuery.refetch();
      purchasesQuery.refetch();
    } else if (canceled === "true") {
      toast({
        title: "Achat annulé — vous pouvez réessayer quand vous voulez.",
        variant: "default",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [
    purchasesQuery.refetch, // Rafraîchir les données
    creditsQuery.refetch,
  ]); // eslint-disable-line react-hooks/exhaustive-deps
  const checkout = useApiToast(api.billing.createCheckout.useMutation(), {
    success: "Redirection vers le paiement...",
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const credits = creditsQuery.data?.credits ?? 0;

  function handleSubscribe(tierId: PlanTier) {
    checkout.mutate({ tier: tierId });
  }

  return (
    <DashboardShell title="Crédits & Facturation">
      <p className="text-muted-foreground mb-8">
        Solde actuel :{" "}
        <Badge variant="secondary" className="ml-1">
          {credits} crédits
        </Badge>
      </p>

      <h2 className="text-xl font-semibold mb-4">Choisissez votre formule</h2>
      <div id="credit-packs" className="grid md:grid-cols-3 gap-4 mb-10">
        {paidTiers.map((tier) => (
          <Card
            key={tier.id}
            className={`relative ${
              tier.highlighted ? "border-primary/50 ring-1 ring-primary/20" : ""
            }`}
          >
            {tier.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge>Populaire</Badge>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl font-bold">{tier.label}</CardTitle>
              <CardDescription>{tier.credits} crédits / mois</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold mb-4">
                {formatPrice(tier.priceCents)}
                <span className="text-sm font-normal text-muted-foreground"> / mois</span>
              </p>
              <Button
                className="w-full"
                variant={tier.highlighted ? "default" : "outline"}
                size="sm"
                onClick={() => handleSubscribe(tier.id)}
                disabled={checkout.isPending}
              >
                {checkout.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  tier.cta
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment history */}
      <h2 className="text-xl font-semibold mb-4">Historique des achats</h2>
      {purchasesQuery.isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between animate-pulse">
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : purchasesQuery.isError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive mb-2">Erreur lors du chargement de l&apos;historique</p>
            <Button variant="outline" size="sm" onClick={() => purchasesQuery.refetch()}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : purchasesQuery.data && purchasesQuery.data.length > 0 ? (
        <Card>
          <div className="divide-y">
            {purchasesQuery.data.map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium">{purchase.creditsPurchased} crédits</p>
                  <p className="text-sm text-muted-foreground">{formatDate(purchase.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {purchase.refundedAt && (
                    <Badge variant="outline" className="text-destructive border-destructive/30">
                      Remboursé
                    </Badge>
                  )}
                  {purchase.disputedAt && (
                    <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                      Litige
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Aucun achat pour le moment</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const el = document.getElementById("credit-packs");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Acheter des crédits
            </Button>
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  );
}
