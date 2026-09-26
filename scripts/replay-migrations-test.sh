#!/usr/bin/env bash
# Replays supabase/migrations against a THROWAWAY Supabase project to validate
# the reconciled migration history. Never point this at production.
#
#   export TEST_DB_URL='<session pooler connection string of nexus-admin-test>'
#   bash scripts/replay-migrations-test.sh original     # history without drift_capture
#   bash scripts/replay-migrations-test.sh reconciled   # adds drift_capture + the rest
set -euo pipefail

PROD_REF="tbtyxtigbsljyrwyelqr"
DRIFT="20260714072100_drift_capture.sql"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${TEST_DB_URL:-}" ]]; then
  read -rsp "Paste the nexus-admin-test Session pooler URI (hidden), then Enter: " TEST_DB_URL
  echo
fi
if [[ -z "$TEST_DB_URL" ]]; then
  echo "No connection string given." >&2
  exit 1
fi
if [[ "$TEST_DB_URL" == *"$PROD_REF"* ]]; then
  echo "Refusing: TEST_DB_URL points at production ($PROD_REF)." >&2
  exit 1
fi

MODE="${1:-}"
if [[ "$MODE" == "all" ]]; then
  export TEST_DB_URL
  bash "$0" original
  echo
  bash "$0" reconciled
  exit $?
fi

case "$MODE" in
  original)
    # Same 29 files as production's history: everything except drift_capture.
    WORK="$(mktemp -d)"
    mkdir -p "$WORK/supabase/migrations"
    cp "$ROOT/supabase/config.toml" "$WORK/supabase/"
    find "$ROOT/supabase/migrations" -name '*.sql' ! -name "$DRIFT" -exec cp {} "$WORK/supabase/migrations/" \;
    echo "Replaying $(ls "$WORK/supabase/migrations" | wc -l | tr -d ' ') migrations (no drift_capture)…"
    npx --yes supabase@latest db push --workdir "$WORK" --db-url "$TEST_DB_URL" --yes || true
    ;;
  rebuild)
    # Wipes the TEST database and replays every repo migration from zero.
    echo "Resetting the test database and replaying all $(ls "$ROOT/supabase/migrations" | wc -l | tr -d ' ') migrations…"
    npx --yes supabase@latest db reset --workdir "$ROOT" --db-url "$TEST_DB_URL" --no-seed --yes
    ;;
  reconciled)
    # Full repo history; --include-all lets drift_capture go in before the
    # migrations already applied by the "original" run.
    echo "Replaying the reconciled history (with drift_capture)…"
    npx --yes supabase@latest db push --workdir "$ROOT" --db-url "$TEST_DB_URL" --include-all --yes
    ;;
  *)
    echo "Usage: $0 original|reconciled|all|rebuild" >&2
    exit 2
    ;;
esac
