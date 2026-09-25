# Runbook: running a round

How round 2 (2026-09-24/25) was run end to end, as commands, so the next round
starts from here rather than from memory. Round 1's design is in `PLAN.md`,
the Stage 2 corpus in `CORPUS-STAGE2.md`, the file layout in `README.md`.

## 0. Before anything

```bash
claude auth status            # "loggedIn": true, or every cell fails with an auth error
claude --version              # the model ids you plan to use must be accepted by this version
claude -p "Reply PONG" --model claude-opus-5-5 --max-turns 1 --output-format json   # one probe per model
df -h /System/Volumes/Data    # 1.3 GB per live worktree; keep 10 GB free per parallel loop
ps -Ao pid,pcpu,etime,command -r | head   # a stray bun/claude from an old worktree eats a core for days
```

- Homebrew-managed Claude Code updates with `brew upgrade claude-code@latest`;
  `claude update` prints that and does nothing.
- 8 cores run three cells in parallel comfortably; four is too many.
- `pkill -f <model-id>` stops one loop and its live cell; remove the cell's
  worktree (`git -C ../agents-on-guren-app worktree list`) and its partial
  `results/<task>/<cell>.*` files without a `.patch` before restarting.

## 1. Part A: the cross-framework tags task (`~/Development/framework-comparison`)

Arms are `LABEL` + `IMPL` + `GUIDANCE` + `REF`; `agent-eval/run-arms.sh` runs a
list of them trial-outermost with verification after each cell and skips cells
that already have a verdict.

```bash
cd ~/Development/framework-comparison
(cd guren && bunx guren gate)                 # a new dependency advisory would block every stop
bash agent-eval/run-arms.sh > agent-eval/logs/partA-$(date +%F).log 2>&1 &
# edit the ARMS list in run-arms.sh first; results land in agent-eval/results/<label>-<n>.*
bun agent-eval/summarize.ts 1 2 3            # trial numbers are an argument, default 2 3 4
bun agent-eval/classify-archaeology.ts       # token-weighted classification, see ARCHAEOLOGY-2026-09.md
```

- `agent-eval/results/` is gitignored; commit the log and the analysis, attach
  the results to a release.
- Before an app arm: `bun update`, `bunx guren upgrade --check-only`,
  `bunx guren agent:sync`, and `agent:init --force --target claude` for the
  two files sync leaves alone (CLAUDE.md, settings.json).
- A "same app, older commit" control is `REF=<sha> LABEL=<name>`; keep the
  label distinct from anything in `results/` or the runner refuses to overwrite.

## 2. Part B: the task corpus (`~/Development/agents-on-guren`)

### Baseline

```bash
cd ~/Development/agents-on-guren-app && git checkout -b <stage>            # never edit main's tree
bunx create-guren-app@<ver> /tmp/scaffold --blueprint blog --db sqlite --agents none
# replace the tracked contents with the scaffold, keep README and .git, follow the scaffold's .gitignore
bun install && cp .env.example .env && bunx guren key:generate --write && bun run codegen \
  && bun run db:migrate && bun run db:seed && bun run typecheck && bun test
bunx guren check && bunx guren audit && bunx guren doctor && bunx guren gate
git commit -m "baseline: create-guren-app@<ver> ..."      # this sha goes into every task.json "baseline"
```

### Authoring

One subagent per task from `tasks/SUBAGENT-BRIEF.md` + the corpus brief; two
or three at a time (disk). A task is accepted only when
`bash harness/validate-task.sh <id>` prints `✓ <id>: valid` and the author has
broken the reference at least three ways to show the hidden tests can fail.
Plan tasks also prove `plan:next` returns a step in a fresh worktree.

### Calibration

```bash
bash harness/loop.sh --tasks <all> --models claude-sonnet-5 --conditions "bare,shipped,shipped+plan" --trials 1 \
  > logs/calibration-<stage>.log 2>&1 &
```

Calibration exists to fix ambiguous statements, false-negative hidden tests and
the harness. It never selects tasks on outcome. **Move its results out before
production**: `driver.sh` treats any existing verdict as done, so calibration
cells would silently become trial 1 of the production run (round 2 shipped
21 such cells and had to re-run them):

```bash
python3 - <<'PY'
import glob,os,shutil
for f in glob.glob('results/*/claude-sonnet-5-*-1.*'):   # every calibration cell
    d='results-calibration-<stage>/'+f.split('/')[1]; os.makedirs(d,exist_ok=True); shutil.move(f,d)
PY
```

### Production

```bash
T=<comma-separated task ids>
bash harness/loop.sh --tasks "$T" --models claude-sonnet-5 --conditions "bare,shipped,shipped+plan" --trials 3 > logs/<stage>-sonnet.log 2>&1 &
bash harness/loop.sh --tasks "$T" --models claude-opus-5-5 --conditions "bare,shipped" --trials 3 > logs/<stage>-opus55.log 2>&1 &
bash harness/loop.sh --tasks "$T" --models claude-haiku-4-5-20251001 --conditions "bare,shipped" --trials 3 > logs/<stage>-haiku.log 2>&1 &
# fourth model once a loop ends; a slow model can be split by task set into two loops (disjoint --tasks only)
```

`loop.sh` runs under caffeinate and resumes after API errors. Watch with
`grep -c '→' logs/*.log` and `grep FAIL`. Cell times in round 2: Sonnet and
Opus 2–4 min, Haiku 5–7, Fable 6–7.

### Summaries

```bash
python3 harness/summarize-stage2.py --out results/RESULTS-STAGE2.md   # model × condition, delta, per task, idiom, plan loop
# The round-1 scripts read every results/<task>/ and would mix rounds into the
# round-1 files; write their output for a new round under a separate name.
bun harness/api-utilization.ts > results/API-UTILIZATION-<stage>.md
tar --zstd -cf ~/Development/agents-on-guren-streams-$(date +%F).tar.zst results/*/*.stream.jsonl results-calibration-*/*/*.stream.jsonl
git add results results-calibration-* && git commit        # streams are gitignored; attach the tarball to the release
```

## 3. Harness rules learned in round 2 (already in the scripts; do not undo)

- Every condition runs with the same allowlist, `--strict-mcp-config`,
  `--setting-sources project,local`, no web tools, auto memory off, and
  `--include-hook-events` (the stop-hook and plan-loop columns need it).
- `Bash(git:*)` is allowed and the patch is diffed against the recorded start
  commit: the plan loop commits per step.
- The `shipped+plan` prompt line ends with "Implement the plan." (the skill's
  trigger); with a weaker line the agents read the plan and never ran it.
- `PREAMBLE.md` carries "Runner notes" (Write/Edit tools, no heredocs, no
  `cd` chains, `env NAME=value cmd`); without them 17 cells logged 77 denials.
- Idiom scan skips `tests/` for tasks with a `baseline` field.
- Editing a script while a driver runs: write a temp file and `os.replace()`
  it (new inode); bash reads the running file incrementally.

## 4. Analysis and the report

1. Part A archaeology (`classify-archaeology.ts`), then the two-way split the
   plan's §6 asks for (package-name confusion vs API learning) is what decides
   the RFC 0024 question.
2. Draft EN + JA with a subagent from the plan document's outline, the round-1
   reports for voice, `.claude/rules/prose.md` for both languages; run the
   gurenjs prose audit with the locale passed explicitly.
3. Review: one independent numbers-and-claims review (round 2 used Codex);
   verify each finding against the logs before applying; recompute ratios
   from unrounded medians; give the mean beside the median wherever they
   disagree; state the actual pass gate (`verify.sh`: hidden + typecheck).
4. Before publishing: push both repos, upload the streams tarball to the
   release, fix the slug and date, run the four-point review (secrets, home
   paths, unfiled issues, wording).

## 5. Framework findings

Every finding a round produces goes into the running log of the plan document
with a number, then into a gurenjs ticket once verified against the source
(never from an agent's report alone). Round 2 produced 22; the list is in the
plan document and the report.
