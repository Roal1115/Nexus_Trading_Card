#!/usr/bin/env bash
# Servidor local contra el sandbox: npm run dev:sandbox
# `npm run dev` usa .env, que apunta a producción.
set -euo pipefail

set -a
source .env.test
set +a

if [[ "${NEXUS_URL:-}" != *ssbifqcvuhcfijbdtjjh* ]]; then
  echo "NEXUS_URL en .env.test no es el sandbox. No se inició." >&2
  exit 1
fi

VITE_NEXUS_URL="$NEXUS_URL" VITE_NEXUS_PUBLISHABLE_KEY="$NEXUS_ANON_KEY" \
  exec npx vite dev --port 8081 --strictPort
