import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";
import { deleteAudioFile } from "@/server/services/audio/r2";

const log = createLogger("cleanup-recordings");
const BATCH_SIZE = 50;

export async function cleanupOldRecordings(maxAgeDays = 90): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  let totalDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    const oldCalls = await db.call.findMany({
      where: {
        endedAt: { lte: cutoff },
        recordingUrl: { not: null },
      },
      take: BATCH_SIZE,
      select: { id: true, recordingUrl: true },
    });

    if (oldCalls.length === 0) {
      hasMore = false;
      break;
    }

    for (const call of oldCalls) {
      if (call.recordingUrl) {
        try {
          await deleteAudioFile(call.recordingUrl);
          await db.call.update({
            where: { id: call.id },
            data: { recordingUrl: null },
          });
          totalDeleted++;
        } catch (error) {
          log.error("Failed to delete recording", { callId: call.id, error });
        }
      }
    }

    if (oldCalls.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  log.info("Old recordings cleanup complete", { deleted: totalDeleted, maxAgeDays });
  return totalDeleted;
}
