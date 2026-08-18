#!/bin/bash
# Usage: run.sh <task> <model> <condition:bare|shipped> <trial>
#
# One benchmark cell: cut a worktree of the app at the task's start state,
# install the shipped harness (or not), run a headless Claude Code session on
# the task statement, and store the event stream + the agent's work as a patch.
#
# Permissions mirror gurenjs/framework-comparison agent-eval (rounds 1–6): edits auto-accepted in
# the worktree, Bash limited to an allowlist of development commands. The gate
# is identical across models and conditions.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

TASK="$1"; MODEL="$2"; COND="$3"; TRIAL="$4"
MAX_TURNS="${MAX_TURNS:-120}"
CELL="$(cell_id "$TASK" "$MODEL" "$COND" "$TRIAL")"
OUT="$RESULTS/$CELL"
WT="$WT_ROOT/run-$TASK-$MODEL-$COND-$TRIAL"
mkdir -p "$(dirname "$OUT")" "$WT_ROOT"

case "$COND" in bare|shipped) ;; *) echo "condition must be bare|shipped"; exit 2;; esac

ALLOWED_TOOLS=(
  "Bash(bun:*)" "Bash(bunx:*)" "Bash(npm:*)" "Bash(npx:*)" "Bash(node:*)"
  "Bash(ls:*)" "Bash(cat:*)" "Bash(head:*)" "Bash(tail:*)" "Bash(wc:*)"
  "Bash(grep:*)" "Bash(rg:*)" "Bash(find:*)" "Bash(sed:*)" "Bash(awk:*)"
  "Bash(mkdir:*)" "Bash(cp:*)" "Bash(mv:*)" "Bash(touch:*)"
  "Bash(sqlite3:*)" "Bash(openssl:*)" "Bash(sleep:*)" "Bash(kill:*)"
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
if [ "$COND" = "shipped" ]; then
  (cd "$WT" && bunx guren agent:init --target claude >/dev/null 2>&1)
  git -C "$WT" add -A
  git -C "$WT" -c user.name=aog -c user.email=aog@example.invalid commit -q -m "harness: agent:init" --no-verify
  echo "== guidance: shipped ($(cd "$WT" && ls -d CLAUDE.md .claude .mcp.json 2>/dev/null | tr '\n' ' '))"
else
  echo "== guidance: bare"
fi

PROMPT="$(build_prompt "$TASK")"
echo "== starting agent (model: $MODEL, max-turns: $MAX_TURNS)"
START=$(date +%s)
cd "$WT"
# Isolation: --strict-mcp-config drops every MCP server (the operator's personal
# ones would otherwise load into every cell — verified in calibration), and
# --setting-sources project,local drops user-level settings/plugins/hooks, so a
# cell sees only the worktree (+ agent:init's .claude/ in the shipped condition).
claude -p "$PROMPT" \
  --model "$MODEL" \
  --max-turns "$MAX_TURNS" \
  --output-format stream-json --verbose \
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
echo "{\"task\":\"$TASK\",\"model\":\"$MODEL\",\"condition\":\"$COND\",\"trial\":$TRIAL,\"wall_seconds\":$((END-START)),\"baseline\":\"$BASELINE\"}" > "$OUT.meta.json"

git -C "$WT" add -A >/dev/null 2>&1 || true
git -C "$WT" diff --cached --binary HEAD -- . ':(exclude)*.db' ':(exclude)*.db-shm' ':(exclude)*.db-wal' ':(exclude)data/' > "$OUT.patch" 2>/dev/null || true
drop_worktree "$WT"
echo "== saved: results/$CELL.{stream.jsonl,result.json,patch,meta.json}"
