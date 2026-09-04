"use client";

import { AlertTriangle, Copy, RotateCcw } from "lucide-react";
import { Button, toast } from "@echoroom/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <AlertTriangle className="w-16 h-16 text-destructive mb-6" />
      <h1 className="text-4xl font-bold mb-4">Une erreur est survenue</h1>
      <p className="text-muted-foreground mb-2 max-w-md">
        Désolés, quelque chose s&apos;est mal passé. Notre équipe a été notifiée.
      </p>
      {error.digest && (
        <div className="flex items-center justify-center gap-2 mb-6">
          <p className="text-xs text-muted-foreground font-mono">Erreur #{error.digest}</p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              navigator.clipboard
                .writeText(error.digest ?? "")
                .then(() => {
                  toast({ title: "Copié !", variant: "default" });
                })
                .catch(() => {
                  toast({ title: "Échec de la copie", variant: "destructive" });
                });
            }}
            aria-label="Copier l'identifiant d'erreur"
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      )}
      <Button onClick={reset} className="gap-2">
        <RotateCcw className="w-4 h-4" />
        Réessayer
      </Button>
    </div>
  );
}
