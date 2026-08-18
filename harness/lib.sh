#!/bin/bash
# Shared helpers for the Agents on Guren harness. Source, don't execute.
#
# Layout assumptions:
#   BENCH_ROOT/tasks/<id>/{task.json,statement.md,seed.patch?,reference.patch?,hidden/*.test.ts}
#   APP_REPO  = the benchmark application repository (separate git repo; the
#               agent's worktree is cut from it, so hidden tests never enter it)
#   BASELINE  = commit in APP_REPO every task starts from

BENCH_ROOT="${BENCH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
APP_REPO="${APP_REPO:-$HOME/Development/agents-on-guren-app}"
BASELINE="${BASELINE:-56f4e64}"
WT_ROOT="${WT_ROOT:-/tmp/aog-worktrees}"
RESULTS="${RESULTS:-$BENCH_ROOT/results}"

task_dir() { echo "$BENCH_ROOT/tasks/$1"; }

# cell_id <task> <model> <condition> <trial>  →  stable results key
cell_id() { echo "$1/$2-$3-$4"; }

# make_worktree <task> <dest>
# Fresh detached worktree at BASELINE; applies the task's seed patch (if any)
# and commits it, so the agent's diff is against the *seeded* start state.
make_worktree() {
  local task="$1" dest="$2" tdir; tdir="$(task_dir "$task")"
  rm -rf "$dest"
  git -C "$APP_REPO" worktree remove --force "$dest" 2>/dev/null || true
  git -C "$APP_REPO" worktree prune
  git -C "$APP_REPO" worktree add --detach "$dest" "$BASELINE" >/dev/null
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

# The prompt = fixed preamble + task statement. Identical for every condition
# and model; the only thing that varies with the condition is what files sit
# in the worktree.
build_prompt() {
  local task="$1" tdir; tdir="$(task_dir "$task")"
  cat "$BENCH_ROOT/harness/PREAMBLE.md"
  echo
  cat "$tdir/statement.md"
}
