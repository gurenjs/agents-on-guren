# Agents on Guren

A public benchmark of AI coding agents on a [Guren](https://guren.dev) web
application, in the spirit of Rails'
[Agents on Rails](https://rubyonrails.org/2026/8/13/agents-on-rails-the-first-benchmark-report):
20 atomic bug / security / feature tasks with **hidden acceptance tests**, run
across three models and two conditions:

- **bare** — the scaffolded app with no agent guidance (code and
  `node_modules` type declarations only)
- **shipped** — the same app after `bunx guren agent:init` (what Guren
  installs for agents: CLAUDE.md, rules, skills, hooks, an API-signature digest)

Report: [English on guren.dev](https://guren.dev/blog/agents-on-guren-the-first-benchmark-report) ([source](report/agents-on-guren-en.md)) · [日本語 on Zenn](https://zenn.dev/7nohe/articles/agents-on-guren-benchmark) ([source](report/agents-on-guren-ja.md)) · numbers: [results/RESULTS.md](results/RESULTS.md)

## Headline (360 cells, 2026-08-18)

| model | condition | pass | total turns | Δ turns | total cost (API-eq) | Δ cost |
|---|---|---|---|---|---|---|
| Haiku 4.5 | bare | 51/60 (85%) | 2,475 | | $21.02 | |
| Haiku 4.5 | shipped | **54/60 (90%)** | 2,073 | **−16%** | $22.26 | +6% |
| Sonnet 5 | bare | 58/60 (97%) | 3,599 | | $137.55 | |
| Sonnet 5 | shipped | **60/60 (100%)** | 2,596 | **−28%** | $102.67 | **−25%** |
| Opus 5 | bare | 60/60 (100%) | 3,361 | | $168.42 | |
| Opus 5 | shipped | 60/60 (100%) | 2,494 | **−26%** | $148.30 | **−12%** |

Runner: headless Claude Code, `--max-turns 120`, isolated (no MCP, no user
settings/plugins, no web tools). 20 tasks × 3 models × 2 conditions × 3 trials.
Cash cost $0 (Claude Max); API-equivalent $600.

## Round 2 (Stage 2, 2026-09-25)

Nine product tickets that each span three or more subsystems, graded by 84
hidden behaviour tests (pass = hidden tests + typecheck) with a separate
idiom column, run on four models with and without the harness, plus approved
implementation plans on three tickets. 225 cells, Claude Code 2.1.281, an
isolated runner.

| model | pass bare → shipped | turns (median) | cost USD (median) |
|---|---|---|---|
| Sonnet 5 | 93% → 96% | 37 → 29 | 0.57 → 0.63 |
| Opus 5.5 | 100% → 100% | 65 → 43 | 1.58 → 1.31 |
| Haiku 4.5 | 41% → 56% | 96 → 81 | 1.00 → 0.90 |
| Fable 5.1 | 100% → 100% | 77 → 59 | 4.01 → 3.51 |

- Corpus and its rules: [CORPUS-STAGE2.md](CORPUS-STAGE2.md); tasks under
  `tasks/<id>/` with `"baseline"` set to the app's `stage2` branch (0fd1654).
- Tables: [results/RESULTS-STAGE2.md](results/RESULTS-STAGE2.md)
  (`harness/summarize-stage2.py`); calibration cells are kept apart in
  `results-calibration-stage2/`.
- How the round was run, step by step: [RUNBOOK.md](RUNBOOK.md).
- Event streams will be attached to the release.

## Layout

| Path | What |
|---|---|
| `PLAN.md` | design, decisions, phase log, cost model |
| `CORPUS.md` | why each task exists, and how the corpus was actually built |
| `tasks/<id>/` | `statement.md` (what the agent reads), `seed.patch` (the defect, for bug/sec tasks), `hidden/*.test.ts` (acceptance tests the agent never sees), `reference.patch` (our solution), `task.json` (category, difficulty, API-utilization markers). See `tasks/AUTHORING.md`. Tasks were authored by Claude subagents from per-task design briefs (`CORPUS.md`, `tasks/SUBAGENT-BRIEF.md`), admitted only after `harness/validate-task.sh` passed, and reviewed by the maintainer. |
| `harness/` | `validate-task.sh` (fixture gate: hidden tests must fail on the start state and pass on the reference), `run.sh` (one cell), `verify.sh` (score one cell), `driver.sh` (resumable matrix), `loop.sh` (unattended, auto-resume on API errors), `summarize.ts`, `api-utilization.ts` |
| `results/` | per cell (home-directory paths in logs are shortened to `~`; `permission_denials` in `result.json` record commands the agent *attempted* and the runner refused, not commands that ran): `*.patch` (the agent's diff), `*.result.json` (Claude Code result event: turns, cost), `*.verdict.json`, `*.hidden.log`, `*.typecheck.log`; plus `RESULTS.md`, `SUMMARY.md`, `API-UTILIZATION.md`, `summary.csv/json` |
| `results-calibration/` | the 40-cell Sonnet calibration round (80-turn cap, pre-isolation) |
| `report/` | the write-ups |

Full event streams (`*.stream.jsonl`, every tool call and message of every
cell; 140 MB, 16 MB compressed) are attached to the GitHub release rather than
committed: `agents-on-guren-streams-2026-08-18.tar.zst`, unpack into the repo
root.

## The application under test

A separate repository, [`agents-on-guren-app`](https://github.com/gurenjs/agents-on-guren-app):
`bunx create-guren-app@1.8.0 --blueprint blog --db sqlite --agents none`,
pinned to the published `@guren/*` packages (core 1.6.1, orm 2.4.0, server
2.6.0, cli 2.5.0). The harness cuts a git worktree from it per cell, so hidden
tests never enter the agent's working tree.

## Reproduce

```bash
git clone https://github.com/gurenjs/agents-on-guren-app ~/Development/agents-on-guren-app
git clone https://github.com/gurenjs/agents-on-guren && cd agents-on-guren
bash harness/validate-task.sh missing-authorize-destroy       # fixture gate for one task
bash harness/run.sh missing-authorize-destroy claude-sonnet-5 shipped 1   # one cell (needs `claude` logged in)
bash harness/verify.sh missing-authorize-destroy claude-sonnet-5 shipped 1
bash harness/loop.sh --models claude-sonnet-5 --trials 3      # a full model column, resumable
bun harness/summarize.ts
```

`APP_REPO` and `BASELINE` (default `56f4e64`) can be overridden in the
environment; a task whose `task.json` names its own `baseline` always starts
from that commit. See `harness/lib.sh`.

Round 2 (Stage 2 tasks) adds a `shipped+plan` condition: `shipped` plus the
task's approved plan (`tasks/<id>/plan/`) committed into the start state and
one line appended to the prompt. Its streams carry hook events
(`--include-hook-events`), from which `summarize.ts` counts Stop-hook blocks.

## License

MIT.
