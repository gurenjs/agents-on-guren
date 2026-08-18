#!/bin/bash
# Usage: validate-task.sh <task> [--keep]
#
# Fixture quality gate — a task is only admitted to the corpus if:
#   1. START state (baseline + seed) is green on typecheck + visible tests
#      (the agent must start from a healthy app), and
#   2. hidden tests FAIL on the START state (they actually detect the defect /
#      the missing feature — a hidden suite that passes before any work is
#      done measures nothing), and
#   3. START + reference.patch: typecheck, visible tests and hidden tests all
#      PASS (the task is solvable and the hidden suite accepts a real solution).
# This is the mutation check applied to the benchmark itself.
set -uo pipefail
source "$(dirname "$0")/lib.sh"

TASK="$1"; KEEP="${2:-}"
TDIR="$(task_dir "$TASK")"
WT="$WT_ROOT/validate-$TASK"
mkdir -p "$WT_ROOT"
LOG="$WT_ROOT/validate-$TASK.log"; : > "$LOG"
[ -d "$TDIR" ] || { echo "no such task: $TASK"; exit 2; }
[ -f "$TDIR/statement.md" ] || { echo "$TASK: missing statement.md"; exit 2; }
[ -f "$TDIR/reference.patch" ] || { echo "$TASK: missing reference.patch"; exit 2; }
ls "$TDIR"/hidden/*.test.ts >/dev/null 2>&1 || { echo "$TASK: no hidden tests"; exit 2; }

fail() { echo "✗ $TASK: $1 (log: $LOG)"; [ "$KEEP" = "--keep" ] || drop_worktree "$WT"; exit 1; }

make_worktree "$TASK" "$WT" || fail "seed does not apply"
setup_app "$WT"
precheck_app "$WT" || fail "start state is not green (typecheck/visible tests)"
echo "  ✓ start state green"

apply_hidden_tests "$TASK" "$WT"
if run_hidden_tests "$WT" "$LOG.hidden-start"; then
  fail "hidden tests PASS on the start state — they do not detect the task"
fi
echo "  ✓ hidden tests fail on start state ($(grep -oE '[0-9]+ pass|[0-9]+ fail' "$LOG.hidden-start" | tr '\n' ' '))"
rm -rf "$WT/tests/hidden"

git -C "$WT" apply --whitespace=nowarn "$TDIR/reference.patch" || fail "reference.patch does not apply"
(cd "$WT" && bun install --frozen-lockfile >/dev/null 2>&1 || bun install >/dev/null 2>&1)
(cd "$WT" && bun run codegen >/dev/null 2>&1; bun run db:migrate >/dev/null 2>&1)
(cd "$WT" && bunx tsc --noEmit > "$LOG.tc" 2>&1) || fail "reference solution fails typecheck"
(cd "$WT" && bun test tests/ > "$LOG.visible" 2>&1) || fail "reference solution fails visible tests"
apply_hidden_tests "$TASK" "$WT"
run_hidden_tests "$WT" "$LOG.hidden-ref" || fail "hidden tests FAIL on the reference solution"
echo "  ✓ reference solution passes typecheck + visible + hidden ($(grep -oE '[0-9]+ pass' "$LOG.hidden-ref" | head -1))"

[ "$KEEP" = "--keep" ] || drop_worktree "$WT"
echo "✓ $TASK: valid"
