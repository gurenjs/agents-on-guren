#!/bin/bash
# Usage: loop.sh <driver args...>
#
# Keeps the matrix moving unattended: runs driver.sh under caffeinate (no idle
# sleep), and when the driver stops on an API error (exit 3 — rate limit,
# expired auth, transient outage) waits and starts it again; completed cells
# are skipped by the driver itself. Ends when the driver finishes normally.
# An auth error needs a human (`claude` re-login) — the loop keeps retrying
# every RETRY_MINUTES so it picks up as soon as that happens.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RETRY_MINUTES="${RETRY_MINUTES:-30}"
MAX_RETRIES="${MAX_RETRIES:-48}"   # 48 × 30 min = 24 h of waiting at most
n=0
while :; do
  caffeinate -i bash "$HERE/driver.sh" "$@"
  rc=$?
  if [ $rc -eq 3 ]; then
    n=$((n+1))
    if [ $n -gt "$MAX_RETRIES" ]; then echo "== loop: giving up after $MAX_RETRIES retries"; exit 3; fi
    echo "== loop: driver stopped on an API error (retry $n/$MAX_RETRIES); sleeping ${RETRY_MINUTES}m before resuming — $(date '+%F %T')"
    sleep $((RETRY_MINUTES*60))
    continue
  fi
  echo "== loop: driver exited rc=$rc — done"
  exit $rc
done
