#!/usr/bin/env bash
# Sobe um Postgres local descartável (porta 54329) para os testes de RLS.
set -euo pipefail
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
DIR=${PGDATA_DIR:-/tmp/vestibularr-pg}
if [ ! -d "$DIR" ]; then
  mkdir -p "$DIR" && chown postgres "$DIR"
  su postgres -c "$PGBIN/initdb -D $DIR -A trust >/dev/null"
fi
su postgres -c "$PGBIN/pg_ctl -D $DIR -o '-p 54329 -k /tmp' -l $DIR/log -w start" >/dev/null || true
su postgres -c "psql -h /tmp -p 54329 -tc \"select 1 from pg_database where datname='vestibularr_test'\" postgres" | grep -q 1 \
  || su postgres -c "createdb -h /tmp -p 54329 vestibularr_test"
echo "postgres://postgres@localhost:54329/vestibularr_test"
