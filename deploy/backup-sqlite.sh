#!/usr/bin/env bash
set -euo pipefail

# Safe online SQLite WAL + uploads backup for PinSign (keep 14 days)
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DATA_DIR="${DATA_DIR:-${PINSIGN_DATA_DIR:-$APP_DIR/data}}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
TMP_SQLITE="$BACKUP_DIR/pinsign-$STAMP.sqlite"
ARCHIVE="$BACKUP_DIR/pinsign-backup-$STAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DATA_DIR/pinsign.sqlite" ]; then
  echo "No database found yet at $DATA_DIR/pinsign.sqlite — skipping backup."
  exit 0
fi

node --no-warnings -e "
  import('node:sqlite').then(({ DatabaseSync }) => {
    const db = new DatabaseSync(process.argv[1]);
    const escaped = process.argv[2].replace(/'/g, \"''\");
    db.exec(\"VACUUM INTO '\" + escaped + \"'\");
    db.close();
  });
" "$DATA_DIR/pinsign.sqlite" "$TMP_SQLITE"

TAR_ARGS=(-C "$BACKUP_DIR" "$(basename "$TMP_SQLITE")")
if [ -d "$DATA_DIR/uploads" ] && [ -n "$(ls -A "$DATA_DIR/uploads")" ]; then
  TAR_ARGS+=(-C "$DATA_DIR" "uploads")
fi

tar -czf "$ARCHIVE" "${TAR_ARGS[@]}"
rm -f "$TMP_SQLITE"
find "$BACKUP_DIR" -name 'pinsign-backup-*.tar.gz' -type f -mtime +14 -delete
echo "Backup saved: $ARCHIVE"
