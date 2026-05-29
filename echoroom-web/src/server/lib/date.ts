/**
 * Returns the start (00:00:00.000) and end (23:59:59.999) of the current UTC day
 * as Date objects. Use this instead of local-timezone-dependent date ranges
 * when querying UTC-based DateTime fields in the database.
 */
export function getUTCDayRange() {
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const todayEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );
  return { todayStart, todayEnd };
}

/** Returns the current UTC date as "YYYY-MM-DD" string */
export function getUTCDateString(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
