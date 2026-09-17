#!/usr/bin/env bash
# ponytail: plain pg_dump snapshot, no retention/rotation policy — add a cron + S3 upload if you need automated off-site backups later
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Set SUPABASE_DB_URL first (Project Settings > Database > Connection string, URI, 'Session pooler' mode)." >&2
  exit 1
fi

mkdir -p backups
FILE="backups/snapshot_$(date +%Y%m%d_%H%M%S).sql"

pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges -f "$FILE"

echo "Snapshot saved to $FILE"
echo "Rollback with: psql \"\$SUPABASE_DB_URL\" -f $FILE"
