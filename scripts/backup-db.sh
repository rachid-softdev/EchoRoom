#!/usr/bin/env bash
# ─── EchoRoom PostgreSQL Backup ────────────────────────────────────────────────
# Creates a compressed pg_dump backup with a timestamped filename.
# Keeps only the last 30 backups, removing older ones automatically.
#
# Usage:
#   export DATABASE_URL="postgresql://user:pass@host:5432/db"
#   ./scripts/backup-db.sh
#
# Environment:
#   DIRECT_URL      — Preferred connection string (higher priority)
#   DATABASE_URL    — Fallback connection string
#   BACKUP_DIR      — Output directory (default: ./backups)
#   RETENTION_COUNT — Number of backups to keep (default: 30)
#
# Requires: pg_dump (PostgreSQL client tools)

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION="${RETENTION_COUNT:-30}"

# Connection string: DIRECT_URL > DATABASE_URL
CONN_STRING="${DIRECT_URL:-${DATABASE_URL:-}}"

if [[ -z "$CONN_STRING" ]]; then
  echo "[ERROR] Neither DIRECT_URL nor DATABASE_URL is set." >&2
  echo "  Export one of them and retry." >&2
  exit 1
fi

# ─── Extract database name from connection string ────────────────────────────
# Match the database name after the last '/' before '?' or end-of-string.
# e.g. postgresql://user:pass@host:5432/echoroom_staging?sslmode=require
DB_NAME=$(echo "$CONN_STRING" | sed -n 's|.*/\([^?]*\)\(?.*\)*|\1|p')
if [[ -z "$DB_NAME" ]]; then
  echo "[ERROR] Could not parse database name from connection string." >&2
  exit 1
fi

# ─── Create backup directory ──────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ─── Timestamp ────────────────────────────────────────────────────────────────
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

echo "[INFO] Starting backup of '$DB_NAME' → $FILEPATH"

# ─── pg_dump (custom format + compression) ────────────────────────────────────
# Flags:
#   --format=c    Custom format (restore with pg_restore, supports parallel)
#   --compress=9  Maximum gzip compression level
#   --no-owner    Skip commands to set object ownership (safe across environments)
#   --clean       Drop database objects before recreating them on restore
#   --if-exists   Use IF EXISTS when dropping objects (avoids errors)
pg_dump \
  --format=c \
  --compress=9 \
  --no-owner \
  --clean \
  --if-exists \
  --dbname="$CONN_STRING" \
  --file="$FILEPATH"

# Verify backup was created and has content
if [[ ! -s "$FILEPATH" ]]; then
  echo "[ERROR] Backup file is empty or was not created." >&2
  exit 1
fi

echo "[INFO] Backup complete: $(du -h "$FILEPATH" | cut -f1)"

# ─── Retention: keep only last N backups ──────────────────────────────────────
# List backups for this database, sorted by name (lexical = chronological),
# remove the newest $RETENTION, and delete the rest.
BACKUP_PREFIX="${BACKUP_DIR}/${DB_NAME}_"
TOTAL=$(ls -1 "${BACKUP_PREFIX}"*.sql.gz 2>/dev/null | wc -l)

if [[ "$TOTAL" -gt "$RETENTION" ]]; then
  REMOVE=$((TOTAL - RETENTION))
  echo "[INFO] Retention: keeping $RETENTION of $TOTAL backups, removing $REMOVE"

  ls -1 "${BACKUP_PREFIX}"*.sql.gz \
    | sort \
    | head -n "$REMOVE" \
    | while IFS= read -r OLD; do
        rm -f "$OLD"
        echo "[INFO] Removed old backup: $OLD"
      done
else
  echo "[INFO] Retention: $TOTAL backups (≤ $RETENTION), nothing to remove"
fi

echo "[SUCCESS] Backup finished: $FILEPATH"
