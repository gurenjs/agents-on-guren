# Agents on Guren — benchmark plan (2026-08-14)

> **Decision (2026-08-14):** run the **Subscription + parity sample** tier —
> Claude Code on the Max plan for the full Claude matrix, plus a ~10%
> mini-swe-agent + API parity sample ($30–60 cash). The cross-vendor GPT
> table is deferred to a possible second report.
> *(Superseded 2026-08-18: the parity sample was not run; see Status.)*

A public benchmark report in the spirit of Rails'
["Agents on Rails: the first benchmark report"](https://rubyonrails.org/2026/8/13/agents-on-rails-the-first-benchmark-report)
(2026-08-13), built on the agent-eval infrastructure of
[gurenjs/framework-comparison](https://github.com/gurenjs/framework-comparison/tree/main/agent-eval)
(PILOT.md rounds 1–6).

## Why this report, and why now

The Rails report's most important finding is not the model leaderboard — it is
that **API recall varies wildly across models (8%–35%)**, that solutions using
framework APIs succeed more often than handwritten reimplementations (92% vs
87%), and that handwritten solutions become code the team must maintain. Rails
closes by saying they will *investigate* whether richer context (guides, API
docs) improves performance.

Guren has already measured exactly that. Round 6 (PILOT.md) showed the shipped
agent harness is the difference between passing and failing on APIs absent
from training data: bare 1/3 vs harness 3/3, at −29% cost. This report scales
that single data point into a task corpus × model matrix, published while the
Rails finding is fresh.

**Headline claim:** *On a framework the model has never seen, the harness —
not the model — decides whether the agent succeeds. Context delivery beats
recall.*

A deliberate contrast with Rails: their models have 20 years of Rails in
training data, so they measure recall. Guren's recall baseline is ~zero, so we
measure what turns zero recall into working code. If a cheap model + harness
beats an expensive model bare, that is the strongest possible version of the
result.

## Experimental design

Two-axis matrix — the harness axis is the one Rails does not have:

| Axis | Levels |
|------|--------|
| Harness | **bare** (all agent guidance stripped, as in rounds 1–2) / **shipped** (`guren agent:init` output present: CLAUDE.md / AGENTS.md, rules, API signature digest via `guren context`) |
| Model | Claude Opus 5, Claude Sonnet 5, Claude Haiku 4.5 (+ optionally GPT-5.6 Sol, GPT-5.6 Luna high-effort) |
| Trials | N = 3 per (task, model, condition) |

Baseline size: **18 tasks × 2 conditions × 3 trials = 108 runs per model**;
540 runs at five models — the same order of magnitude as Rails' 504.

### Metrics

1. **Pass rate** — hidden test set per task, run by the harness after the
   session ends (round-2 protocol: DoD inside the session is typecheck +
   visible tests only; functional acceptance is post-hoc and hidden).
2. **Cost / turns to green** — from the event stream, as in rounds 2+.
3. **Framework-API utilization** (new, mirrors Rails' recall finding): static
   scan of each passing diff classifying the solution as *framework-API*
   (`findOrFail`, `validateBody`, `JsonResource`, policies, typed routes…) vs
   *handwritten reimplementation* (manual 404 branches, ad-hoc validation,
   raw queries). Expected shape: bare → handwritten-heavy; shipped →
   API-heavy. This is the maintenance-burden argument with Guren numbers.
4. **Refusal / non-completion taxonomy** — Rails saw Fable 5 refuse 3
   security tasks; we log and classify rather than silently drop.

## Task corpus (the Writebook analog)

Target app: **examples/blog extracted into a standalone repo**, pinned to a
published `@guren/*` release and installing from npm — the exact resolution
path a real user has (and the path the template-drift tooling already
protects). guren.dev's CMS is the closer Writebook analog in spirit, but its
Workers + D1 runtime is hostile to local agent loops; the blog app runs
anywhere Bun does.

15–20 **atomic** tasks (rounds 1–6 used one large feature per trial; variance
was high and single failures dominated). Sources, all real:

- Bugs found while dogfooding the tutorial (the #375–#378 class).
- Friction items from building guren.dev and an internal app on Guren.
- Deliberately introduced vulnerabilities of the classes `guren audit`
  detects (missing validation on a mutating route, mass assignment, missing
  auth check) — phrased explicitly as *fix* requests with the vulnerability
  described, so safety-tuned models read them as remediation, not exploit
  authoring (the lesson from Fable's refusals in the Rails run).
- Small feature requests exercising distinct subsystems (model scope,
  resource shaping, route binding, i18n key, queue job).

Each task ships: problem statement (with repro), hidden test set, reference
solution. Hidden tests never enter the agent's context.

## Runner

- **Primary: headless Claude Code on the Max subscription** (`claude -p`,
  the rounds 1–6 setup). For a Claude-only report this *is* a single uniform
  harness — every run uses the same agent, same caps — so the fairness
  argument survives intact, and it is more ecologically valid than a minimal
  agent: it benchmarks the tool people actually point at Guren. Costs are
  reported as API-equivalent dollars from the event stream, exactly as in
  rounds 1–6; the cash outlay is $0 beyond the existing subscription.
- **Optional cross-vendor extension: mini-swe-agent** (single bash tool,
  litellm), only if the GPT/DeepSeek column is wanted. Because that column
  would run under a different harness, it gets its own clearly-labeled table
  plus a **parity sample**: ~10% of the Claude matrix re-run under
  mini-swe-agent + API (~$30–60) to show the harness choice does not flip
  conclusions. A Bun port ("miniswen for Guren") stays out of scope —
  second-report material.
- Comparability note for the report: Rails' numbers come from lemans; ours
  from Claude Code. State it plainly rather than implying a shared scale —
  the harness A/B *within* our matrix is self-contained either way.
- The shipped condition is **file-based**, so it works under a minimal agent:
  `agent:init --target` (RFC 0008 branch) emits AGENTS.md-style guidance any
  harness reads. **Prerequisite:** that branch must be merged and released
  first, so "shipped" means literally what `bunx guren agent:init` installs.
- Per-trial isolation: fresh worktree per run, verified green before start;
  patches applied to a clean tree for verification (existing
  run-trial.sh / verify-trial.sh flow, generalized to a task × model matrix).
- Driver discipline from earlier rounds: file-redirected output (the 512-byte
  pipe machine), check `uptime` before long batches, never edit a running
  script, read the port the app reports.

## Status (2026-08-14)

- **Phase 0 complete.** The RFC 0008 multi-agent harness turned out to be
  already merged *and shipped*: npm `@guren/cli@2.5.0` contains
  `agent:init --target` (verified in the published tarball, not assumed) and
  `create-guren-app@1.8.0` has `--agents`.
- Benchmark app scaffolded **from npm, not the workspace**:
  `bunx create-guren-app@1.8.0 agents-on-guren-app --blueprint blog --db sqlite --agents none`
  at `~/Development/agents-on-guren-app`, baseline commit `56f4e64`, verified
  green (codegen, migrate, seed, typecheck exit 0, tests 2/2). Resolved
  versions locked in bun.lock: core 1.6.1, cli 2.5.0, orm 2.4.0, server
  2.6.0, testing 1.5.0, inertia-client 1.1.1.
- **Phase 1 complete (2026-08-18).** 20 tasks authored and validated
  (`tasks/`, see CORPUS.md "As built"); harness written
  (`harness/{lib,run,verify,validate-task,driver}.sh`, `summarize.ts`,
  `api-utilization.ts`). One Haiku smoke cell ran end-to-end
  (missing-authorize-destroy bare → PASS, 17 turns, $0.14 API-equivalent).
  Authoring surfaced four framework findings (paginate() drops eager
  loads; no non-PK route model binding; Job.make() container never set;
  health subsystem missing from the `guren context` digest) — filed against
  gurenjs; the corpus is designed around them so both conditions grade fairly.
- **Phase 2 complete (2026-08-18):** calibration = Sonnet 5 × 20 tasks ×
  bare+shipped × N=1, 40 cells, 2h50m wall, ~$96 API-equivalent
  (`results-calibration/`). 38/40 PASS; both FAILs are welcome-mail-job
  (both conditions) and both are genuine incompletes at the 80-turn cap, not
  hidden-test false negatives — no statement or test needed changing. Findings
  applied to Phase 3: (1) 9 cells hit the 80-turn cap → cap raised to 120;
  (2) headless sessions were loading the operator's personal MCP servers and
  plugins into every cell (verified in the init event; no cell actually *used*
  them, web tools, or curl) → `--strict-mcp-config --setting-sources
  project,local`, WebFetch/WebSearch denied, curl dropped from the allowlist;
  (3) Sonnet 5 solves 19/20 bare — the recall floor is not zero, so the
  harness story is cost/turns, not pass/fail, at this model tier: shipped
  used 14% fewer turns overall (910 vs 1059) with large per-task swings
  (route-wildcard-404 80→37 turns, $5.18→$1.77, via one `guren check`;
  open-redirect-login 73→21; missing-authorize-destroy 48→17) and some
  reversals at N=1 — hence N=3.
- **Scoring rule made explicit during Phase 3:** `verify.sh` regenerates the
  codegen artifacts (`bun run codegen`) before typecheck and hidden tests, as
  the dev server would on the next start. A patch whose typecheck only passes
  against stale `.guren/*.gen.ts` (e.g. two routes sharing a name → duplicate
  identifiers) is a FAIL even when every hidden test passes; the shipped
  guidance documents codegen, the bare condition has to discover it.
- **Phase 3 complete (2026-08-18 12:19–20:51, 8h32m, 360/360 cells, $0 cash /
  $600 API-equivalent):** see `results/RESULTS.md`. Headline: Sonnet 5 shipped
  −28% turns / −25% cost / 60 vs 58 pass; Opus 5 −26% turns / −12% cost /
  60 vs 60; Haiku 4.5 −16% turns / +6% cost / 54 vs 51 pass. `guren check`
  ran in 119/180 shipped cells vs 18/180 bare. No refusals on the 4 security
  tasks. **Parity sample not run (decision 2026-08-18: no API-metered runner was set up); the report states single-runner (Claude Code) as a caveat.**
- **Phase 4 (2026-08-18):** reports written (`report/`, EN for guren.dev + JA
  for Zenn); repository published as `gurenjs/agents-on-guren` (event streams
  as the `v2026.08.18` release asset) with the app at
  `gurenjs/agents-on-guren-app`; gurenjs PR #449 cites the numbers on the
  homepage. English report published at
  https://guren.dev/blog/agents-on-guren-the-first-benchmark-report (2026-08-18). Pre-publication review by four independent reviewers (files,
  commit metadata, results, streams) found no secrets; their findings
  (home paths in logs, unfiled framework issues, wording) were applied —
  the framework findings are gurenjs #444, #446, #450, #451.
- ~~**Phase 3 running (started 2026-08-18 12:19):**~~ three drivers in parallel,
  one per model, under `harness/loop.sh` (caffeinate + auto-resume after API
  errors): 20 tasks × bare/shipped × N=3 × {Sonnet 5, Opus 5, Haiku 4.5} =
  360 cells. Logs in `logs/phase3-<model>.log`.

## Phases

| Phase | Work | Effort |
|-------|------|--------|
| 0 — prerequisites | Merge + release the multi-agent harness branch (RFC 0008); extract the benchmark app repo, pin to npm release, verify green | ~2 days |
| 1 — corpus & infra | Write 15–20 tasks + hidden tests + reference solutions; adapt runner/verifier/summarizer to the matrix | 3–5 days |
| 2 — calibration | 1 model (Sonnet 5) × all tasks × 1 trial; fix ambiguous statements, false-negative hidden tests, runtime outliers. Rails and our round 1 both mis-measured on the first attempt; this phase exists to fail cheaply | 1–2 days |
| 3 — full run | Full matrix; mostly wall-clock waiting | 2–3 days |
| 4 — analysis & publication | Aggregate; publish (a) this repo's tasks + raw logs, (b) report post — guren.dev in English, Zenn in Japanese, (c) homepage measurement panel update (successor to PR #284) | 2–3 days |

Calendar estimate: ~2 weeks part-time.

## Cost model

Grounded in two sources: Rails' published totals ($491 / 504 runs) and our own
rounds 2–6 on Guren.

Per-run reference points:

- Rails, per-model per-run (63 runs each): Luna default **$0.014**, Luna
  max-effort **$0.037**, Sol **≈$0.52**, Opus 5 **≈$1.90**.
- Our rounds (Sonnet 5, one *large* feature task on Guren): $2.0–5.5 bare,
  ~$4.90 shipped at round 6. Atomic tasks are roughly ⅓–¼ that size.
- Guren runs will be **more expensive per run than Rails' numbers**,
  especially bare: zero recall means more exploration. Estimates below carry
  that premium.

Per-model estimates for the 108-run block (18 × 2 × 3):

| Model | $/run (est.) | Block total |
|-------|--------------|-------------|
| Claude Opus 5 | 1.50–3.00 | $160–320 |
| Claude Sonnet 5 | 0.50–1.20 | $55–130 |
| Claude Haiku 4.5 | 0.10–0.25 | $11–27 |
| GPT-5.6 Sol | 0.50–0.90 | $55–95 |
| GPT-5.6 Luna (high effort) | 0.04–0.10 | $4–11 |

The table above is API-equivalent cost. **Cash** depends on where the runs
execute (add ~15% for Phase 2 calibration and reruns):

| Tier | Runner | Scope | Cash outlay |
|------|--------|-------|-------------|
| **Subscription** (recommended) | Claude Code on Max plan | Claude 3 models, 324 runs | **≈ $0** |
| Subscription + parity sample | + mini-swe-agent on ~10% of matrix | same, with harness-independence check | **$30–60** |
| Subscription + cross-vendor | + mini-swe-agent for GPT-5.6 Sol/Luna (half corpus) | adds vendor table (own scale, labeled) | **$65–115** |
| All-API (reference) | mini-swe-agent for everything | Rails-identical methodology | $350–650 |

On the subscription tier the binding constraint is **rate limits, not
dollars**: ~324 runs × $0.1–3 API-equivalent lands in the hundreds of
dollars of usage, which a Max plan absorbs only across multiple weekly
windows. Consequences:

- Phase 3 stretches to ~1 week of paced batches (run overnight, monitor with
  `/usage`, keep the driver resumable per (task, model, condition) cell so a
  rate-limit stop never loses completed runs).
- **Opus is the heavy consumer** (~2/3 of total usage). Two dials if pacing
  gets tedious: Opus bare at N=1 per task (bare is the contrast condition;
  shipped carries the model comparison), or Opus on half the corpus. Sonnet
  as the flagship with full N=3 everywhere is the cheapest honest matrix.
- Benchmark runs share the weekly window with normal development work —
  schedule Phase 3 for a light week or accept the slowdown.

## Risks

- **Floor effect in bare:** models may score near zero on Guren bare. That is
  itself the finding, but the report must frame it as such, and the shipped
  condition must carry the model-vs-model story.
- **OpenAI/DeepSeek API access** is unconfirmed — determines whether the full
  matrix is possible. The Claude-only tier needs nothing new.
- **Task leakage is a non-issue today** (Guren postdates every cutoff) but
  date-stamp the corpus anyway; future re-runs will need it.
- **Refusals:** security tasks phrased as remediation with explicit context;
  any refusal is logged and reported, not retried into compliance.
- **Local machine hazards** (learned in the earlier agent-eval rounds): 512-byte pipe
  buffer wedges heredocs; load spikes fail unrelated tests; leaked servers
  answer probes on stolen ports. Mitigations baked into the driver.

## Open questions

1. Final model list (depends on API key availability for non-Claude vendors).
2. ~~Benchmark app repo name and whether it lives under the guren org.~~ Resolved: `gurenjs/agents-on-guren-app`.
3. Whether to include a "docs-in-context but no harness" middle condition
   (Rails' stated next step) — adds 50% more runs; likely second report.
4. Publish raw transcripts or patches + logs only (privacy review is trivial
   here, but transcript volume is large).
