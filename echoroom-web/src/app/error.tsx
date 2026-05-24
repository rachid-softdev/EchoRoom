"use client";

import { Button } from "@/components/ui";
import { AlertTriangle, RotateCcw } from "lucide-react";

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
        <p className="text-xs text-muted-foreground mb-6 font-mono">
          Erreur #{error.digest}
        </p>
      )}
      <Button onClick={reset} className="gap-2">
        <RotateCcw className="w-4 h-4" />
        Réessayer
      </Button>
    </div>
  );
}
