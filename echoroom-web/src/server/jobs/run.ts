import { cleanupOldRecordings } from "./cleanupRecordings";
import { cleanupOldAuditLogs } from "./cleanupAuditLogs";
import { purgeAnonymizedUsers } from "./gdprPurge";

async function main() {
  console.log("Starting cleanup jobs...");
  const deletedRecordings = await cleanupOldRecordings(90);
  const deletedAuditLogs = await cleanupOldAuditLogs(365);
  const { deletedUsers } = await purgeAnonymizedUsers(30);
  console.log(
    `Cleanup jobs completed: ${deletedRecordings} recordings, ${deletedAuditLogs} audit logs, ${deletedUsers} GDPR users purged.`,
  );
}

main().catch(console.error);
