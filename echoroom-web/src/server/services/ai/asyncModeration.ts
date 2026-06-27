import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";
import { commentRepository } from "@/server/repositories";
import { checkContent } from "./moderation";

const log = createLogger("async-moderation");

type ModerationTarget = { type: "comment"; id: string } | { type: "scenario"; id: string };

// Maximum number of concurrent moderation jobs
const MAX_CONCURRENT_JOBS = 5;
let activeJobs = 0;
const pendingQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeJobs < MAX_CONCURRENT_JOBS) {
    activeJobs++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    pendingQueue.push(resolve);
  });
}

function releaseSlot(): void {
  activeJobs--;
  const next = pendingQueue.shift();
  if (next) {
    activeJobs++;
    next();
  }
}

export async function scheduleAsyncModeration(
  text: string,
  target: ModerationTarget,
): Promise<void> {
  // Fire-and-forget: schedule moderation on next microtask
  Promise.resolve().then(async () => {
    await acquireSlot();
    try {
      const result = await checkContent(text);

      if (!result.approved) {
        log.warn("Async moderation rejected", {
          targetType: target.type,
          targetId: target.id,
          reason: result.reason,
        });

        // Uses updateMany to handle race conditions gracefully
        if (target.type === "comment") {
          await commentRepository.updateModerationStatusBulk(
            { id: target.id },
            { moderationStatus: "REJECTED" },
          );
        } else {
          await db.scenario.updateMany({
            where: { id: target.id },
            data: { moderationStatus: "REJECTED" },
          });
        }
      } else {
        log.info("Async moderation approved", {
          targetType: target.type,
          targetId: target.id,
        });

        // Mark as APPROVED so content becomes publicly visible.
        // Uses updateMany to handle the race condition where another process
        // already moved the record out of PENDING — returns { count: 0 }
        // gracefully instead of throwing P2025 "Record to update not found".
        if (target.type === "comment") {
          await commentRepository.updateModerationStatusBulk(
            { id: target.id, moderationStatus: "PENDING" },
            { moderationStatus: "APPROVED" },
          );
        } else {
          await db.scenario.updateMany({
            where: { id: target.id, moderationStatus: "PENDING" },
            data: { moderationStatus: "APPROVED" },
          });
        }
      }
    } catch (error) {
      log.error("Async moderation failed", {
        targetType: target.type,
        targetId: target.id,
        error,
      });
      // Statut reste PENDING — tâche CRON externe peut traiter plus tard
    } finally {
      releaseSlot();
    }
  });
}
