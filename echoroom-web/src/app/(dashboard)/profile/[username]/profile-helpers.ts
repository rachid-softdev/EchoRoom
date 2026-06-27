export function buildActivityFeed(
  scenarios: ScenarioFeedItem[],
  calls: CallFeedItem[],
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const s of scenarios) {
    items.push({ type: "scenario", ...s });
  }
  for (const c of calls) {
    items.push({ type: "call", ...c });
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items.slice(0, 10);
}

export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

export interface ScenarioFeedItem {
  id: string;
  title: string;
  createdAt: Date;
  playCount: number;
  likeCount: number;
}

export interface CallFeedItem {
  id: string;
  createdAt: Date;
  status: string;
  durationSeconds: number;
  scenarioTitle?: string;
  scenarioId?: string;
}

export type ActivityItem = ({ type: "scenario" } & ScenarioFeedItem) | ({ type: "call" } & CallFeedItem);
