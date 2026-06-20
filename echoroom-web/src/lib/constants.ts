/** Minimum character length for an abuse report reason */
export const MIN_REPORT_REASON_LENGTH = 10;

export const DAILY_LIMITS = {
  MAX_CALLS: 10,
  MAX_DURATION_SECONDS: 3600,
  DEFAULT_MAX_DAILY_DURATION_SECONDS: 3600,
} as const;

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export const LOCALE = "fr-FR";

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CALLING: "Appel en cours",
  RINGING: "Sonnerie",
  ACTIVE: "Actif",
  COMPLETED: "Terminé",
  FAILED: "Échoué",
  BLOCKED: "Bloqué",
};

export const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  PENDING: "outline",
  CALLING: "default",
  RINGING: "secondary",
  ACTIVE: "default",
  COMPLETED: "secondary",
  FAILED: "destructive",
  BLOCKED: "destructive",
};

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export const CATEGORY_LABELS: Record<string, string> = {
  ROMANTIC: "Romantique",
  CHAOTIC: "Chaotique",
  CORPORATE: "Corporate",
  NPC: "NPC",
  HORROR: "Horreur",
  CRINGE: "Cringe",
  GAMER: "Gamer",
  WEIRD: "Weird",
};

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0
    ? `${mins}:${secs.toString().padStart(2, "0")}`
    : `${secs}s`;
}
