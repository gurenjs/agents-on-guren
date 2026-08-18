#!/bin/bash
# Usage: verify.sh <task> <model> <condition> <trial>
#
# Scores one cell: fresh worktree at the task's start state, apply the agent's
# patch, set up, then typecheck → visible tests → hidden tests. Writes
# results/<cell>.verdict.json. Never touches the agent's stream/patch.
set -uo pipefail
source "$(dirname "$0")/lib.sh"

TASK="$1"; MODEL="$2"; COND="$3"; TRIAL="$4"
CELL="$(cell_id "$TASK" "$MODEL" "$COND" "$TRIAL")"
OUT="$RESULTS/$CELL"
WT="$WT_ROOT/verify-$TASK-$MODEL-$COND-$TRIAL"

[ -f "$OUT.patch" ] || { echo "no patch for $CELL"; exit 2; }

verdict() { # verdict <status> [typecheck] [visible] [hidden] [hidden_count]
  local status="$1" tc="${2:-}" vis="${3:-}" hid="${4:-}" cnt="${5:-}"
  printf '{"task":"%s","model":"%s","condition":"%s","trial":%s,"status":"%s","typecheck":"%s","visible_tests":"%s","hidden_tests":"%s","hidden_summary":"%s"}\n' \
    "$TASK" "$MODEL" "$COND" "$TRIAL" "$status" "$tc" "$vis" "$hid" "$cnt" > "$OUT.verdict.json"
  echo "verdict $CELL: $status (typecheck=$tc visible=$vis hidden=$hid $cnt)"
}

make_worktree "$TASK" "$WT" || { verdict "SEED-FAILED"; exit 1; }
if [ -s "$OUT.patch" ]; then
  git -C "$WT" apply --whitespace=nowarn "$OUT.patch" || { verdict "PATCH-APPLY-FAILED"; drop_worktree "$WT"; exit 1; }
fi
setup_app "$WT"

TC=fail; VIS=fail; HID=fail; CNT=""
(cd "$WT" && bunx tsc --noEmit > "$OUT.typecheck.log" 2>&1) && TC=pass
(cd "$WT" && bun test tests/ > "$OUT.visible.log" 2>&1) && VIS=pass

apply_hidden_tests "$TASK" "$WT"
run_hidden_tests "$WT" "$OUT.hidden.log" && HID=pass
CNT="$(grep -oE '[0-9]+ pass|[0-9]+ fail' "$OUT.hidden.log" | tr '\n' ' ' | sed 's/ $//')"

if [ "$HID" = pass ] && [ "$TC" = pass ]; then STATUS=PASS; else STATUS=FAIL; fi
verdict "$STATUS" "$TC" "$VIS" "$HID" "$CNT"
drop_worktree "$WT"
