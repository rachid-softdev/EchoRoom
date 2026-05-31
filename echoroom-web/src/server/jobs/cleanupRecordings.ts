import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";
import { deleteAudioFile } from "@/server/services/audio/r2";

const log = createLogger("cleanup-recordings");
const BATCH_SIZE = 50;

export async function cleanupOldRecordings(maxAgeDays = 90): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  let totalDeleted = 0;
  let cursor: string | undefined;

  while (true) {
    const oldCalls = await db.call.findMany({
      where: {
        endedAt: { lte: cutoff },
        recordingUrl: { not: null },
      },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "asc" },
      select: { id: true, recordingUrl: true, createdAt: true },
    });

    if (oldCalls.length === 0) break;

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

    // Set cursor to the last item for next page
    const lastItem = oldCalls[oldCalls.length - 1];
    if (!lastItem || oldCalls.length < BATCH_SIZE) break;
    cursor = lastItem.id;
  }

  log.info("Old recordings cleanup complete", { deleted: totalDeleted, maxAgeDays });
  return totalDeleted;
}
