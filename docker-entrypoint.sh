#!/bin/sh
set -e

if [ "${SKIP_MIGRATIONS:-}" != "true" ]; then
  node dist/database/migrate.js
fi

exec "$@"
