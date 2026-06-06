"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * Formulaire de pré-inscription pour la démonstration audio.
 * Extrait en Client Component pour permettre l'interactivité
 * sans transformer toute la landing page en Client Component.
 */
export function DemoAudioForm() {
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: envoyer l'email à PostHog ou un service de notification
    // eslint-disable-next-line no-alert
    alert("Merci ! Vous serez prévenu du lancement.");
    setEmail("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row items-center gap-3 max-w-sm mx-auto"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="votre@email.com"
        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        required
      />
      <Button type="submit" size="sm" className="shrink-0">
        Prévenir
      </Button>
    </form>
  );
}
