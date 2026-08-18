# Agents on Guren: the first benchmark report

*guren.dev, 2026-08-18.*

On 13 August the Rails Foundation published [Agents on Rails](https://rubyonrails.org/2026/8/13/agents-on-rails-the-first-benchmark-report): 21 tasks, 8 models, 504 runs, and one finding that mattered more than the leaderboard. Models recall Rails' APIs at wildly different rates (8% to 35%), solutions that used the framework's API succeeded more often than hand-rolled ones, and hand-rolled solutions become code the team maintains. Rails closed by saying they would look at whether richer context (guides, API docs) changes the picture.

We have been running that experiment for a while, because Guren has no other choice. Guren is new. No model has meaningful recall of its API, and its 2.x line shipped after every current model's training cutoff. So instead of measuring recall, we measure what turns zero recall into working code: the agent harness that `bunx guren agent:init` installs (a CLAUDE.md, rules, skills, hooks, and a verified API-signature digest from `guren context`).

This is the first report at benchmark scale. 20 atomic tasks, three Claude models, two conditions (bare vs shipped harness), three trials each: **360 runs**, all on published packages, all scored by hidden tests the agent never sees. Repository (tasks, harness, per-run patches and verdicts; the full event streams are attached to the release): https://github.com/gurenjs/agents-on-guren (the app under test: https://github.com/gurenjs/agents-on-guren-app).

## What we ran

**The app.** A blog scaffolded from the published `create-guren-app@1.8.0` (`--blueprint blog --db sqlite --agents none`), so the agent works against exactly what a user gets from npm: `@guren/core` 1.6.1, `@guren/orm` 2.4.0, `@guren/server` 2.6.0, `@guren/cli` 2.5.0. Posts, users, auth, a policy, a resource, an HTTP QUERY search route.

**The tasks.** 20 atomic tasks: 6 bugs, 4 security reports, 10 feature requests. Bugs and security issues are *seeded* into the app by a patch and phrased as user reports ("any signed-in user can delete any post", "the archive URLs 404", "after saving an edit the browser loops"). Features start from the baseline ("drafts", "slugs", "throttle login", "Japanese on the auth pages", "a welcome email queued after sign-up"). Every task ships hidden acceptance tests plus a reference solution, and is admitted to the corpus only if the hidden tests **fail** on the start state and **pass** on the reference (the mutation check applied to the benchmark itself). Statements describe symptoms and expected behaviour; none names the API, file, or command that solves it. The tasks were written by Claude subagents from a human design brief per task, each admitted only after passing that gate, and reviewed by hand.

**The two conditions.**
- **bare**: the scaffolded app with no agent guidance at all. The agent still has the code and `node_modules/@guren/*/dist/*.d.ts`; "bare" means no harness, not no information.
- **shipped**: the same worktree after `bunx guren agent:init --target claude`, run from the published CLI in `node_modules`. Nothing hand-authored for the benchmark.

**The runner.** Headless Claude Code (`claude -p`, v2.1.228), same for every cell: file edits auto-accepted, Bash restricted to a development allowlist, `--max-turns 120`, no MCP servers, no user-level settings or plugins, no web tools, no `curl`. Prompt = a fixed preamble (definition of done: typecheck and the visible test suite pass) plus the task statement. After the session, the harness applies the agent's patch to a fresh worktree, regenerates codegen artifacts, typechecks, runs the visible tests, then the hidden tests. PASS = typecheck and hidden tests green.

**The matrix.** 20 tasks × {Haiku 4.5, Sonnet 5, Opus 5} × {bare, shipped} × 3 trials = 360 cells, run 2026-08-18 in 8h32m on one machine. Cash cost: $0 (a Claude Max subscription); API-equivalent cost as reported by the CLI: $600.

## Results

| model | condition | pass | total turns | Δ turns | total cost (API-eq) | Δ cost |
|---|---|---|---|---|---|---|
| Haiku 4.5 | bare | 51/60 (85%) | 2,475 | | $21.02 | |
| Haiku 4.5 | shipped | **54/60 (90%)** | 2,073 | **−16%** | $22.26 | +6% |
| Sonnet 5 | bare | 58/60 (97%) | 3,599 | | $137.55 | |
| Sonnet 5 | shipped | **60/60 (100%)** | 2,596 | **−28%** | $102.67 | **−25%** |
| Opus 5 | bare | 60/60 (100%) | 3,361 | | $168.42 | |
| Opus 5 | shipped | 60/60 (100%) | 2,494 | **−26%** | $148.30 | **−12%** |

Three things to read off that table.

**1. At the top tier the corpus is at ceiling on pass/fail, and the harness shows up as effort.** Opus passes everything either way; Sonnet passes everything with the harness and 58/60 without. What moves is how much work it takes: 26–28% fewer turns and 12–25% less cost for the same or better outcome. Sonnet with the harness (60/60, $103) matches Opus without it (60/60, $168) at 61% of the cost.

**2. At the cheap tier, pass rate itself moves.** Haiku goes from 85% to 90%. Its cost goes *up* 6%: the harness is paid for in input tokens, and on a model whose turns are cheap that is visible. Haiku is also where the shipped condition rescues whole tasks: `published-flag` 1/3 → 3/3, `typed-form-register` 2/3 → 3/3, `post-slug-binding` 2/3 → 3/3, `i18n-ja-catalog` 2/3 → 3/3.

**3. The effect is largest on debugging.** By category, mean turns bare → shipped: bugs 34.9 → 22.0 (−37%), security 36.6 → 23.9 (−35%), features 69.2 → 56.8 (−18%). The bug and security seeds are exactly the defect classes `guren check` and `guren audit` name outright, and the shipped agents ran `guren check` in **119 of 180** cells versus **15 of 180** bare (bare agents that found it did so by reading `package.json`). The single clearest cell pair in the calibration round: `route-wildcard-404` (a route registered as `/archive/:date*`, which Hono reads as a parameter literally named `date*`) took Sonnet 80 turns and $5.18 bare; with the harness, one `bunx guren check` named the route and it took 37 turns and $1.77.

Paired per task (mean of three trials), the shipped condition used fewer turns on 18/20 tasks for Sonnet, 16/20 for Opus, 13/20 for Haiku. The reversals cluster on the easiest tasks (a one-line fix where the guidance is overhead the agent reads and does not need), and on `welcome-mail-job`, the hardest task, where both conditions mostly ran out the clock.

## Where the API did and did not get used

Following Rails, we scanned every passing patch for framework-API use versus hand-rolled equivalents (per-task marker lists, in the repo). Aggregate: 65% of bare passing cells are pure framework-API solutions, 70% shipped. Modest. The per-task view is the interesting one:

- **Where the digest names the API, both conditions use it.** `validateBody`, `authorize`, `redirect`, `paginate`, resource fields, query scoping: 9/9 framework-API in both conditions on most bug and security tasks.
- **The API the harness does not mention does not get used.** `open-redirect-login`: 0 of 17 passing cells, in either condition, used `isSafeRedirectUrl` (the framework ships one); every solution hand-rolled the check. `health-db-probe`: no cell was API-only; the ones that found `createHealthManager` still hand-wrote `SELECT 1`. `guren context`'s digest mentions neither. That is a to-do for us, not the models: push beats pull, and what the digest omits stays undiscovered even with 120 turns.
- **Some gaps are the framework's.** `post-slug-binding`: 0/17 used route model binding, because 2.6.0 cannot bind by a non-primary key. Fixed on main since ([#446](https://github.com/gurenjs/guren/pull/446)).

## What the failures were

17 FAIL cells out of 360. Eleven of them come from one task, `api-posts-contract` (Haiku 0/6, Sonnet bare 1/3), and the cause is a framework bug this corpus found while it was being written: `@guren/orm` 2.4.0's `paginate()` skips eager loading, so `.with('author').paginate()` returns posts whose `author` is null while `.get()` attaches it. Agents that copied the app's own `index` chain lost the author field and failed two hidden tests. Opus, and Sonnet with the harness, noticed the empty field and worked around it; Haiku never did. The bug affects the blog blueprint's own post list; it is fixed on main ([#444](https://github.com/gurenjs/guren/pull/444), shipping in the next `@guren/orm` release). We are leaving the task in the corpus as-is: an API that behaves differently from its documentation is a real thing agents meet, and how a model reacts to it is worth measuring.

The rest: Haiku on the hard tasks (`welcome-mail-job`, `published-flag`, `post-slug-binding`), and one Haiku shipped cell on `route-wildcard-404` that registered two routes under the same name. Its hidden tests passed; codegen then emitted duplicate identifiers and typecheck failed. That is a defect a developer would hit on the next `bun run dev`, so it counts.

**No refusals.** All four security tasks are phrased as remediation requests with the vulnerability described. 60 cells, three models, zero refusals or safety stops.

## What we found about Guren

Writing a benchmark against your own framework is a dogfooding exercise with a hidden test suite. Four real findings, all filed; the first two are already merged on main:

- `QueryBuilder.paginate()` drops eager loads (above).
- Route model binding cannot bind by a non-primary key.
- `Job.make()` throws "Container not initialized" inside a queued job because nothing attaches the container at boot; use `getMailManager()` directly.
- The `guren context` digest does not mention the health-check subsystem or the redirect-safety helpers, and the utilization scan shows the consequence.

## Caveats

- Single runner (Claude Code). The planned parity sample under a minimal single-tool agent was not run; harness-independence of the *within-matrix* comparison is asserted, not measured. Rails' numbers come from a different runner and are not on the same scale as ours.
- What "shipped" delivered: CLAUDE.md, rules, skills and the session-start digest (the hook fired in all 180 shipped runs). The edit-time `guren check` hook did **not** run in the headless runner (0 of 180; the worktree counts as untrusted), so the measured harness is the session-start delivery only. If anything that understates the effect.
- "Bare" is not zero information: the agent has the code and the package type declarations, and Sonnet/Opus reconstruct enough from `.d.ts` files to solve nearly everything given 120 turns. Guren's recall floor is not zero *in practice* because the types are right there.
- Wall clock is noisy (other workloads on the same machine); costs are the CLI's API-equivalent figures.
- N=3 per cell. Per-task deltas swing; the aggregate direction was consistent across all three models and both calibration and full runs.

## What is next

Rails said they would look at whether richer context helps. Our answer, on our framework, at benchmark scale: yes, and it helps most where the context can *name the defect*. The next steps are on us: put the missing subsystems in the digest and re-run the two tasks where the API went unused; ship the `paginate()` and binding fixes and re-run `api-posts-contract` and `post-slug-binding`; and open the corpus to a second runner so the parity question is measured rather than argued.

Everything is in the repository (https://github.com/gurenjs/agents-on-guren): tasks with statements, seeds, hidden tests and reference solutions; the harness; per-cell patches and verdicts for all 360 runs; and the full event streams as a release asset.
