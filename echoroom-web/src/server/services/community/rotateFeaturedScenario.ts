import { featuredScenarioRepository } from "@/server/repositories";
import { getUTCDateString } from "@/server/lib/date";

interface RotationResult {
  scenarioId: string | null;
  date: string;
}

/**
 * Selects and persists the daily featured scenario based on engagement.
 *
 * Algorithm:
 * 1. If an admin has already curated a scenario for today (ADMIN_CURATED), skip.
 * 2. Find all PUBLIC / APPROVED scenarios created in the last 7 days.
 * 3. Score each by engagement: reactions × 2 + plays × 1.
 * 4. Upsert the highest-scored scenario as today's AUTOMATED feature.
 * 5. If no qualifying scenario exists, keep the existing entry (if any).
 */
export async function rotateFeaturedScenario(): Promise<RotationResult> {
  const today = getUTCDateString();

  // 1. Check for existing admin-curated entry — manual override always wins
  const existingEntry = await featuredScenarioRepository.findByDate(today);

  if (existingEntry?.featureType === "ADMIN_CURATED") {
    return { scenarioId: existingEntry.scenarioId, date: today };
  }

  // 2. Query scenarios from the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  const scenarios = await featuredScenarioRepository.findTopScenario(sevenDaysAgo);

  if (scenarios.length === 0) {
    // No qualifying scenarios — preserve the existing entry (manual or none)
    return { scenarioId: existingEntry?.scenarioId ?? null, date: today };
  }

  // 3. Compute engagement score and pick the winner
  const scored = scenarios
    .map((s) => ({
      id: s.id,
      score: s.reactionCount * 2 + s.playCount * 1,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const winner = scored[0];

  if (!winner) {
    // All scenarios have zero engagement
    return { scenarioId: existingEntry?.scenarioId ?? null, date: today };
  }

  // 4. Persist the auto-rotation result
  await featuredScenarioRepository.upsert(today, winner.id, "AUTOMATED");

  return { scenarioId: winner.id, date: today };
}
