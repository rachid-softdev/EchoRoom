import { createLogger } from "@/server/lib/logger";
import { cleanupOldRecordings } from "./cleanupRecordings";
import { cleanupOldAuditLogs } from "./cleanupAuditLogs";
import { purgeAnonymizedUsers } from "./gdprPurge";

const log = createLogger("cleanup-jobs");

async function main() {
  log.info("Starting cleanup jobs...");
  const deletedRecordings = await cleanupOldRecordings(90);
  const deletedAuditLogs = await cleanupOldAuditLogs(365);
  const { deletedUsers } = await purgeAnonymizedUsers(30);
  log.info("Cleanup jobs completed", {
    deletedRecordings,
    deletedAuditLogs,
    deletedUsers,
  });
}

main().catch((error) => {
  log.error("Cleanup jobs failed", { error });
});
