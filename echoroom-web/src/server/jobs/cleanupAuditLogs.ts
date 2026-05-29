import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("cleanup-audit-logs");

export async function cleanupOldAuditLogs(maxAgeDays = 365): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  const result = await db.auditLog.deleteMany({
    where: { createdAt: { lte: cutoff } },
  });

  log.info("Old audit logs cleanup complete", {
    deleted: result.count,
    maxAgeDays,
  });

  return result.count;
}
