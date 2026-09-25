#!/bin/bash
# Shared helpers for the Agents on Guren harness. Source, don't execute.
#
# Layout assumptions:
#   BENCH_ROOT/tasks/<id>/{task.json,statement.md,seed.patch?,reference.patch?,hidden/*.test.ts}
#   APP_REPO  = the benchmark application repository (separate git repo; the
#               agent's worktree is cut from it, so hidden tests never enter it)
#   BASELINE  = commit in APP_REPO a task starts from when its task.json has
#               no "baseline" (round 1: 56f4e64); a task's own "baseline" wins,
#               since its seed/reference/plan are diffs against that commit

BENCH_ROOT="${BENCH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
APP_REPO="${APP_REPO:-$HOME/Development/agents-on-guren-app}"
BASELINE="${BASELINE:-56f4e64}"
WT_ROOT="${WT_ROOT:-/tmp/aog-worktrees}"
RESULTS="${RESULTS:-$BENCH_ROOT/results}"

task_dir() { echo "$BENCH_ROOT/tasks/$1"; }

# task_field <task> <key> [default]  → a top-level string field of task.json
task_field() {
  python3 -c '
import json, sys
try: v = json.load(open(sys.argv[1])).get(sys.argv[2])
except (OSError, ValueError): v = None
print(v if isinstance(v, str) and v else sys.argv[3])
' "$(task_dir "$1")/task.json" "$2" "${3:-}"
}

task_baseline() { task_field "$1" baseline "$BASELINE"; }

# H tasks cross three or more subsystems; round 1's 120 cut 9 calibration
# cells short at 80, so they get 200. MAX_TURNS in the environment still wins.
task_max_turns() {
  if [ -n "${MAX_TURNS:-}" ]; then echo "$MAX_TURNS"; return; fi
  if [ "$(task_field "$1" difficulty)" = "H" ]; then echo 200; else echo 120; fi
}

valid_condition() { case "$1" in bare|shipped|shipped+plan) return 0;; *) return 1;; esac; }

# The plan fixture (tasks/<id>/plan/: docs/plans/<slug>/plan.json + approvals)
# is part of the shipped+plan start state only; bare and shipped never see it.
task_has_plan() { local d; d="$(task_dir "$1")/plan"; [ -d "$d" ] && [ -n "$(ls -A "$d")" ]; }

# apply_plan <task> <dest>  → copies the plan fixture into the worktree and commits it
apply_plan() {
  local task="$1" dest="$2" tdir; tdir="$(task_dir "$task")"
  task_has_plan "$task" || { echo "NO-PLAN ($task has no plan/)"; return 1; }
  cp -R "$tdir/plan/." "$dest/"
  git -C "$dest" add -A
  git -C "$dest" -c user.name=aog -c user.email=aog@example.invalid commit -q -m "plan: $task" --no-verify
}

# cell_id <task> <model> <condition> <trial>  →  stable results key
cell_id() { echo "$1/$2-$3-$4"; }

# make_worktree <task> <dest>
# Fresh detached worktree at the task's baseline; applies the task's seed patch (if any)
# and commits it, so the agent's diff is against the *seeded* start state.
make_worktree() {
  local task="$1" dest="$2" tdir base; tdir="$(task_dir "$task")"; base="$(task_baseline "$task")"
  rm -rf "$dest"
  git -C "$APP_REPO" worktree remove --force "$dest" 2>/dev/null || true
  git -C "$APP_REPO" worktree prune
  git -C "$APP_REPO" worktree add --detach "$dest" "$base" >/dev/null || { echo "BASELINE-MISSING ($task: $base)"; return 1; }
  if [ -f "$tdir/seed.patch" ]; then
    git -C "$dest" apply --whitespace=nowarn "$tdir/seed.patch" || { echo "SEED-APPLY-FAILED ($task)"; return 1; }
    git -C "$dest" add -A
    git -C "$dest" -c user.name=aog -c user.email=aog@example.invalid commit -q -m "seed: $task" --no-verify
  fi
}

drop_worktree() {
  local dest="$1"
  cd / || true
  git -C "$APP_REPO" worktree remove --force "$dest" 2>/dev/null || rm -rf "$dest"
  git -C "$APP_REPO" worktree prune
}

# setup_app <dir>
# Install + env + codegen + migrate the *dev* DB (tests use their own file via
# NODE_ENV=test and reset it themselves). Uses the frozen lockfile so every
# run resolves the same published @guren/* versions.
setup_app() {
  local app="$1"
  cd "$app"
  bun install --frozen-lockfile >/dev/null 2>&1 || bun install >/dev/null 2>&1
  cp .env.example .env
  bunx guren key:generate --write >/dev/null 2>&1
  bun run codegen >/dev/null 2>&1
  bun run db:migrate >/dev/null 2>&1
}

# precheck_app <dir>  → 0 if typecheck + visible tests are green
precheck_app() {
  local app="$1"
  cd "$app"
  bunx tsc --noEmit >/dev/null 2>&1 || return 1
  bun test tests/ >/dev/null 2>&1 || return 1
}

# apply_hidden_tests <task> <app>
# Copies the task's hidden tests into tests/hidden/ (created fresh).
apply_hidden_tests() {
  local task="$1" app="$2" tdir; tdir="$(task_dir "$task")"
  rm -rf "$app/tests/hidden"
  mkdir -p "$app/tests/hidden"
  cp "$BENCH_ROOT/tasks/_shared/"*.ts "$app/tests/hidden/"
  cp "$tdir"/hidden/*.test.ts "$app/tests/hidden/"
  # A task may ship extra non-test helpers next to its tests.
  find "$tdir/hidden" -maxdepth 1 -name '*.ts' ! -name '*.test.ts' -exec cp {} "$app/tests/hidden/" \;
  return 0
}

# run_hidden_tests <app> <logfile>  → 0 if all hidden tests pass; log has raw output
run_hidden_tests() {
  local app="$1" log="$2"
  cd "$app"
  bun run codegen >/dev/null 2>&1
  bun test tests/hidden/ > "$log" 2>&1
  local rc=$?
  grep -q " 0 fail" "$log" && [ "$rc" -eq 0 ]
}

# The prompt = fixed preamble + task statement, identical for every model and
# for bare/shipped. shipped+plan appends exactly one line pointing at the plan;
# the statement itself never changes, or the cell measures the prompt rather
# than the plan.
PLAN_PROMPT_LINE="An approved implementation plan for this ticket exists under docs/plans/. Implement the plan."
build_prompt() {
  local task="$1" cond="${2:-}" tdir; tdir="$(task_dir "$task")"
  cat "$BENCH_ROOT/harness/PREAMBLE.md"
  echo
  cat "$tdir/statement.md"
  if [ "$cond" = "shipped+plan" ]; then
    echo
    echo "$PLAN_PROMPT_LINE"
  fi
}
