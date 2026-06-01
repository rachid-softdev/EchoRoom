"use client";

import { api } from "@/lib/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";

/**
 * An alert banner shown when the user has withdrawn consent.
 *
 * @description Fetches the user's consent status via tRPC query. If consent
 * has been withdrawn, renders a warning alert with a button to re-accept the
 * terms. Returns null when consent is active, so the banner is invisible by
 * default.
 * @example
 * <ConsentBanner />
 * @returns A warning alert element, or null when consent is active
 */
export function ConsentBanner() {
  const [isReconsenting, setIsReconsenting] = useState(false);
  const { data: consentStatus } = api.user.getConsentStatus.useQuery(undefined, {
    retry: false,
  });
  const reconsent = api.user.reconsent.useMutation({
    onSuccess: () => { window.location.reload(); },
  });

  if (!consentStatus?.isConsentWithdrawn) return null;

  return (
    <Alert variant="warning" className="mb-4">
      <ShieldAlert className="w-4 h-4" />
      <AlertTitle>Consentement retiré</AlertTitle>
      <AlertDescription>
        Vous avez retiré votre consentement. Pour accéder à toutes les fonctionnalités,
        veuillez ré-accepter les conditions d&apos;utilisation.
        <Button size="sm" className="ml-2" onClick={() => {
          setIsReconsenting(true);
          reconsent.mutate({ consentAccepted: true });
        }} disabled={isReconsenting}>
          {isReconsenting ? "..." : "Ré-accepter"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
