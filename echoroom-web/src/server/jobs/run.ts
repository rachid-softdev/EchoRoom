import { cleanupOldRecordings } from "./cleanupRecordings";
import { cleanupOldAuditLogs } from "./cleanupAuditLogs";

async function main() {
  console.log("Starting cleanup jobs...");
  const deletedRecordings = await cleanupOldRecordings(90);
  const deletedAuditLogs = await cleanupOldAuditLogs(365);
  console.log(
    `Cleanup jobs completed: ${deletedRecordings} recordings, ${deletedAuditLogs} audit logs purged.`,
  );
}

main().catch(console.error);
