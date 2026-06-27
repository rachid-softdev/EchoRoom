"use client";

import { BadgeDisplay } from "./BadgeDisplay";

interface BadgeGridProps {
  userId: string;
}

/**
 * BadgeGrid affiche les badges d'un utilisateur dans une grille.
 * Délègue à BadgeDisplay qui gère le chargement, l'erreur, l'état vide et le rendu.
 */
export function BadgeGrid({ userId }: BadgeGridProps) {
  return <BadgeDisplay userId={userId} />;
}
