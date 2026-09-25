#!/bin/bash
# Usage: run.sh <task> <model> <condition:bare|shipped|shipped+plan> <trial>
#
# One benchmark cell: cut a worktree of the app at the task's start state,
# install the shipped harness (or not), run a headless Claude Code session on
# the task statement, and store the event stream + the agent's work as a patch.
# shipped+plan = shipped plus the task's approved plan (tasks/<id>/plan/)
# committed into the start state and one line appended to the prompt.
#
# Permissions mirror gurenjs/framework-comparison agent-eval (rounds 1–6): edits auto-accepted in
# the worktree, Bash limited to an allowlist of development commands. The gate
# is identical across models and conditions.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

TASK="$1"; MODEL="$2"; COND="$3"; TRIAL="$4"
MAX_TURNS="$(task_max_turns "$TASK")"
BASE="$(task_baseline "$TASK")"
CELL="$(cell_id "$TASK" "$MODEL" "$COND" "$TRIAL")"
OUT="$RESULTS/$CELL"
WT="$WT_ROOT/run-$TASK-$MODEL-$COND-$TRIAL"
mkdir -p "$(dirname "$OUT")" "$WT_ROOT"

valid_condition "$COND" || { echo "condition must be bare|shipped|shipped+plan"; exit 2; }
# A shipped+plan cell without a plan would be a mislabeled shipped cell.
if [ "$COND" = "shipped+plan" ] && ! task_has_plan "$TASK"; then echo "$TASK has no plan/; shipped+plan does not apply"; exit 2; fi

ALLOWED_TOOLS=(
  "Bash(bun:*)" "Bash(bunx:*)" "Bash(npm:*)" "Bash(npx:*)" "Bash(node:*)"
  "Bash(ls:*)" "Bash(cat:*)" "Bash(head:*)" "Bash(tail:*)" "Bash(wc:*)"
  "Bash(grep:*)" "Bash(rg:*)" "Bash(find:*)" "Bash(sed:*)" "Bash(awk:*)"
  "Bash(mkdir:*)" "Bash(cp:*)" "Bash(mv:*)" "Bash(touch:*)"
  "Bash(sqlite3:*)" "Bash(openssl:*)" "Bash(sleep:*)" "Bash(kill:*)"
  "Bash(git:*)"
)
# No network documentation access in either condition: the shipped condition's
# context is exactly what `agent:init` installs plus node_modules. WebFetch /
# WebSearch are denied and curl is deliberately absent from the allowlist.
DISALLOWED_TOOLS=("WebFetch" "WebSearch")

echo "== cell: $CELL"
make_worktree "$TASK" "$WT"
setup_app "$WT"
precheck_app "$WT" || { echo "PRE-CHECK FAILED ($CELL)"; drop_worktree "$WT"; exit 1; }

# The shipped condition is literally what `bunx guren agent:init` installs from
# the published CLI in node_modules — nothing hand-authored. Committed so the
# agent's patch is only its own work.
if [ "$COND" = "shipped" ] || [ "$COND" = "shipped+plan" ]; then
  (cd "$WT" && bunx guren agent:init --target claude >/dev/null 2>&1)
  git -C "$WT" add -A
  git -C "$WT" -c user.name=aog -c user.email=aog@example.invalid commit -q -m "harness: agent:init" --no-verify
  echo "== guidance: shipped ($(cd "$WT" && ls -d CLAUDE.md .claude .mcp.json 2>/dev/null | tr '\n' ' '))"
  # Committed after agent:init so plan:next sees a clean tree at session start.
  if [ "$COND" = "shipped+plan" ]; then
    apply_plan "$TASK" "$WT" || { drop_worktree "$WT"; exit 1; }
    echo "== plan: $(cd "$WT" && git show --stat --format= HEAD | tail -1)"
  fi
else
  echo "== guidance: bare"
fi

PROMPT="$(build_prompt "$TASK" "$COND")"
# The patch is taken against the start commit, not HEAD: a plan cell commits per step.
START_COMMIT="$(git -C "$WT" rev-parse HEAD)"
echo "== starting agent (model: $MODEL, max-turns: $MAX_TURNS)"
START=$(date +%s)
cd "$WT"
# Isolation: --strict-mcp-config drops every MCP server (the operator's personal
# ones would otherwise load into every cell — verified in calibration), and
# --setting-sources project,local drops user-level settings/plugins/hooks, so a
# cell sees only the worktree (+ agent:init's .claude/ in the shipped condition).
# --include-hook-events only adds the Stop/PostToolUse hook events to the stream
# (SessionStart is there regardless), which summarize.ts counts gate blocks from.
claude -p "$PROMPT" \
  --model "$MODEL" \
  --max-turns "$MAX_TURNS" \
  --output-format stream-json --verbose --include-hook-events \
  --permission-mode acceptEdits \
  --strict-mcp-config \
  --setting-sources project,local \
  --allowedTools "${ALLOWED_TOOLS[@]}" \
  --disallowedTools "${DISALLOWED_TOOLS[@]}" \
  > "$OUT.stream.jsonl" 2> "$OUT.stderr.log" || true
END=$(date +%s)
echo "== agent finished in $((END-START))s"
# The result event is not always the last line of the stream (newer CLIs
# append a task_summary after it) — pick the last line whose type is "result".
python3 - "$OUT.stream.jsonl" "$OUT.result.json" <<'PY'
import json, sys
last = None
for line in open(sys.argv[1]):
    line = line.strip()
    if not line: continue
    try: ev = json.loads(line)
    except json.JSONDecodeError: continue
    if ev.get('type') == 'result': last = line
open(sys.argv[2], 'w').write((last or '{}') + '\n')
PY
CLAUDE_VERSION="$(claude --version 2>/dev/null | head -1 || true)"
python3 -c '
import json, sys
t, m, c, tr, w, b, mt, cv = sys.argv[1:9]
json.dump({"task": t, "model": m, "condition": c, "trial": int(tr), "wall_seconds": int(w),
           "baseline": b, "max_turns": int(mt), "include_hook_events": True,
           "plan": c == "shipped+plan", "claude_version": cv}, sys.stdout)
print()
' "$TASK" "$MODEL" "$COND" "$TRIAL" "$((END-START))" "$BASE" "$MAX_TURNS" "$CLAUDE_VERSION" > "$OUT.meta.json"

git -C "$WT" add -A >/dev/null 2>&1 || true
git -C "$WT" diff --cached --binary "$START_COMMIT" -- . ':(exclude)*.db' ':(exclude)*.db-shm' ':(exclude)*.db-wal' ':(exclude)data/' > "$OUT.patch" 2>/dev/null || true
drop_worktree "$WT"
echo "== saved: results/$CELL.{stream.jsonl,result.json,patch,meta.json}"
