"use client";

import { Loader2, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";

const STORAGE_KEY = "echoroom-call-disclaimer-accepted";

interface CallDisclaimerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  isPending?: boolean;
}

export function CallDisclaimerDialog({
  open,
  onOpenChange,
  onAccept,
  isPending = false,
}: CallDisclaimerDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [hasAcceptedBefore, setHasAcceptedBefore] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") {
        setHasAcceptedBefore(true);
      }
    } catch {
      // localStorage not available — continue without stored preference
    }
  }, []);

  function handleAccept() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // localStorage not available — accept still proceeds for this session
    }
    setHasAcceptedBefore(true);
    onAccept();
    onOpenChange(false);
  }

  // During SSR and before hydration, render nothing to prevent mismatch.
  // After hydration, check if user has already accepted.
  if (!mounted || hasAcceptedBefore) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Phone className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Avant de commencer l&apos;appel</DialogTitle>
          <DialogDescription className="text-center">
            Veuillez prendre connaissance des informations suivantes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="p-4 rounded-xl border border-border/40 bg-muted/30">
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-primary shrink-0 mt-0.5">•</span>
                <span className="text-muted-foreground">
                  Les enregistrements audio peuvent être utilisés à des fins de modération et
                  d&apos;amélioration du service
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary shrink-0 mt-0.5">•</span>
                <span className="text-muted-foreground">
                  Ne partagez pas d&apos;informations personnelles sensibles (numéro de sécurité
                  sociale, coordonnées bancaires, etc.)
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary shrink-0 mt-0.5">•</span>
                <span className="text-muted-foreground">
                  Ce service n&apos;est pas destiné aux situations d&apos;urgence. En cas
                  d&apos;urgence, contactez les services appropriés (15, 17, 18)
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary shrink-0 mt-0.5">•</span>
                <span className="text-muted-foreground">
                  Une modération automatique du contenu est active pour prévenir les abus
                </span>
              </li>
            </ul>
          </div>

          <Checkbox
            id="disclaimer-accept"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            label="Je comprends et j'accepte ces conditions"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleAccept} disabled={!accepted || isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Appel en cours...
              </>
            ) : (
              "Démarrer l'appel"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
