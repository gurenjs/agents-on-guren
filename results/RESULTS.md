# Agents on Guren — Phase 3 results (360 cells, 2026-08-18)

Matrix: 20 tasks × {bare, shipped} × {Haiku 4.5, Sonnet 5, Opus 5} × N=3. Runner: headless Claude Code 2.1.228, `--max-turns 120`, isolated (no MCP, no user settings/plugins, no web tools, no curl). Wall clock 12:19–20:51 (8h32m) with three model drivers in parallel; one transient API 521 (Sonnet, one cell, auto-resumed). Cash cost: $0 (Max subscription); API-equivalent cost from the result events: **$600.22**.

## Headline

| model | condition | pass | total turns | Δ turns | total cost (API-eq) | Δ cost | max-turn hits |
|---|---|---|---|---|---|---|---|
| haiku-4-5 | bare | 51/60 | 2475 |  | $21.02 |  | 0 |
| haiku-4-5 | shipped | 54/60 | 2073 | -16% | $22.26 | +6% | 0 |
| sonnet-5 | bare | 58/60 | 3599 |  | $137.55 |  | 2 |
| sonnet-5 | shipped | 60/60 | 2596 | -28% | $102.67 | -25% | 0 |
| opus-5 | bare | 60/60 | 3361 |  | $168.42 |  | 0 |
| opus-5 | shipped | 60/60 | 2494 | -26% | $148.30 | -12% | 0 |

Reading: at the Opus/Sonnet tier the corpus is near ceiling on pass/fail, so the harness shows up as **effort** — 26–28% fewer turns, 12–25% lower cost — with the same or better pass rate. Haiku is the tier where pass rate itself moves (+5 pp) at slightly higher cost (the shipped context is paid for in input tokens on a model whose turns are cheap).

## Paired per-task effect (mean of 3 trials, shipped vs bare)

### haiku-4-5 — shipped used fewer turns on 13/20 tasks, cost less on 7/20

| task | pass bare→shipped | turns bare→shipped | Δ | cost bare→shipped |
|---|---|---|---|---|
| rate-limit-login | 3/3 → 3/3 | 83.7 → 39.3 | -53% | $0.80 → $0.43 |
| mass-assignment-author | 3/3 → 3/3 | 22.7 → 11.3 | -50% | $0.17 → $0.14 |
| missing-authorize-destroy | 3/3 → 3/3 | 25.7 → 13.7 | -47% | $0.20 → $0.14 |
| search-orwhere-leak | 3/3 → 3/3 | 32.0 → 17.7 | -45% | $0.28 → $0.22 |
| api-posts-contract | 0/3 → 0/3 | 55.0 → 31.7 | -42% | $0.53 → $0.33 |
| health-db-probe | 3/3 → 3/3 | 37.3 → 25.3 | -32% | $0.29 → $0.23 |
| route-wildcard-404 | 3/3 → 2/3 | 54.7 → 37.3 | -32% | $0.47 → $0.46 |
| dashboard-stats | 3/3 → 3/3 | 32.3 → 26.3 | -19% | $0.23 → $0.30 |
| auto-excerpt | 3/3 → 3/3 | 46.3 → 40.0 | -14% | $0.41 → $0.45 |
| post-slug-binding | 2/3 → 3/3 | 80.0 → 74.0 | -8% | $0.75 → $0.84 |
| published-flag | 1/3 → 3/3 | 63.7 → 60.3 | -5% | $0.53 → $0.56 |
| i18n-ja-catalog | 2/3 → 3/3 | 58.3 → 56.0 | -4% | $0.47 → $0.57 |
| typed-form-register | 2/3 → 3/3 | 44.0 → 42.7 | -3% | $0.38 → $0.40 |
| open-redirect-login | 3/3 → 2/3 | 45.0 → 45.7 | +1% | $0.35 → $0.49 |
| put-redirect-302 | 3/3 → 3/3 | 12.0 → 12.3 | +3% | $0.10 → $0.15 |
| unmounted-routes-file | 3/3 → 3/3 | 16.7 → 17.7 | +6% | $0.12 → $0.18 |
| welcome-mail-job | 2/3 → 2/3 | 69.0 → 73.7 | +7% | $0.58 → $0.78 |
| resource-drops-excerpt | 3/3 → 3/3 | 14.3 → 15.7 | +9% | $0.10 → $0.17 |
| pagination-skips-page | 3/3 → 3/3 | 13.0 → 17.3 | +33% | $0.10 → $0.20 |
| raw-body-no-validation | 3/3 → 3/3 | 19.3 → 33.0 | +71% | $0.14 → $0.39 |

### sonnet-5 — shipped used fewer turns on 18/20 tasks, cost less on 15/20

| task | pass bare→shipped | turns bare→shipped | Δ | cost bare→shipped |
|---|---|---|---|---|
| put-redirect-302 | 3/3 → 3/3 | 53.0 → 15.7 | -70% | $1.73 → $0.63 |
| missing-authorize-destroy | 3/3 → 3/3 | 54.0 → 17.3 | -68% | $1.78 → $0.67 |
| search-orwhere-leak | 3/3 → 3/3 | 38.7 → 15.3 | -60% | $1.29 → $0.63 |
| pagination-skips-page | 3/3 → 3/3 | 54.0 → 23.0 | -57% | $2.01 → $0.86 |
| raw-body-no-validation | 3/3 → 3/3 | 54.0 → 30.0 | -44% | $2.20 → $1.09 |
| open-redirect-login | 3/3 → 3/3 | 36.0 → 22.3 | -38% | $1.13 → $0.87 |
| typed-form-register | 3/3 → 3/3 | 68.0 → 44.7 | -34% | $2.33 → $1.68 |
| mass-assignment-author | 3/3 → 3/3 | 36.0 → 24.3 | -32% | $0.95 → $0.80 |
| dashboard-stats | 3/3 → 3/3 | 54.3 → 37.7 | -31% | $1.66 → $1.28 |
| published-flag | 3/3 → 3/3 | 115.3 → 81.3 | -29% | $5.01 → $3.45 |
| route-wildcard-404 | 3/3 → 3/3 | 66.0 → 47.7 | -28% | $2.66 → $1.70 |
| post-slug-binding | 3/3 → 3/3 | 119.0 → 87.7 | -26% | $5.49 → $3.47 |
| i18n-ja-catalog | 3/3 → 3/3 | 86.0 → 66.3 | -23% | $3.08 → $2.27 |
| resource-drops-excerpt | 3/3 → 3/3 | 18.7 → 16.3 | -13% | $0.47 → $0.60 |
| auto-excerpt | 3/3 → 3/3 | 42.7 → 38.3 | -10% | $1.35 → $1.39 |
| rate-limit-login | 3/3 → 3/3 | 48.3 → 43.7 | -10% | $1.85 → $1.56 |
| welcome-mail-job | 3/3 → 3/3 | 110.3 → 106.0 | -4% | $4.69 → $5.04 |
| health-db-probe | 3/3 → 3/3 | 53.0 → 51.0 | -4% | $1.63 → $2.00 |
| unmounted-routes-file | 3/3 → 3/3 | 22.3 → 22.7 | +1% | $0.46 → $0.77 |
| api-posts-contract | 1/3 → 3/3 | 70.0 → 74.0 | +6% | $4.07 → $3.46 |

### opus-5 — shipped used fewer turns on 16/20 tasks, cost less on 15/20

| task | pass bare→shipped | turns bare→shipped | Δ | cost bare→shipped |
|---|---|---|---|---|
| put-redirect-302 | 3/3 → 3/3 | 42.0 → 13.7 | -67% | $1.54 → $0.83 |
| mass-assignment-author | 3/3 → 3/3 | 37.0 → 13.3 | -64% | $1.39 → $0.86 |
| dashboard-stats | 3/3 → 3/3 | 42.0 → 19.7 | -53% | $1.55 → $1.21 |
| search-orwhere-leak | 3/3 → 3/3 | 38.3 → 19.3 | -50% | $1.55 → $1.13 |
| post-slug-binding | 3/3 → 3/3 | 104.3 → 55.7 | -47% | $5.80 → $3.38 |
| missing-authorize-destroy | 3/3 → 3/3 | 28.7 → 16.0 | -44% | $1.13 → $0.83 |
| raw-body-no-validation | 3/3 → 3/3 | 39.7 → 24.3 | -39% | $1.42 → $1.11 |
| unmounted-routes-file | 3/3 → 3/3 | 33.0 → 21.0 | -36% | $1.07 → $0.98 |
| pagination-skips-page | 3/3 → 3/3 | 46.0 → 32.0 | -30% | $1.91 → $1.63 |
| route-wildcard-404 | 3/3 → 3/3 | 52.7 → 37.0 | -30% | $2.52 → $2.09 |
| resource-drops-excerpt | 3/3 → 3/3 | 21.3 → 15.0 | -30% | $0.66 → $0.83 |
| published-flag | 3/3 → 3/3 | 90.3 → 64.3 | -29% | $4.24 → $3.69 |
| i18n-ja-catalog | 3/3 → 3/3 | 98.3 → 77.3 | -21% | $5.52 → $4.23 |
| rate-limit-login | 3/3 → 3/3 | 66.3 → 54.3 | -18% | $3.92 → $3.32 |
| open-redirect-login | 3/3 → 3/3 | 41.7 → 35.3 | -15% | $1.75 → $2.05 |
| welcome-mail-job | 3/3 → 3/3 | 122.0 → 105.3 | -14% | $8.73 → $8.28 |
| api-posts-contract | 3/3 → 3/3 | 70.7 → 72.3 | +2% | $4.67 → $4.53 |
| health-db-probe | 3/3 → 3/3 | 50.7 → 52.7 | +4% | $2.54 → $2.95 |
| typed-form-register | 3/3 → 3/3 | 62.7 → 66.0 | +5% | $2.87 → $3.50 |
| auto-excerpt | 3/3 → 3/3 | 32.7 → 36.7 | +12% | $1.36 → $2.01 |

## What the shipped harness changed in behaviour

- `guren check` was actually run (as a Bash command) in **119/180** shipped cells vs **15/180** bare cells (bare agents that found it did so by reading `package.json`/`node_modules`).
- Where the shipped guidance points straight at the defect class, effort collapses: e.g. Sonnet on missing-authorize-destroy 54→17 turns, put-redirect-302 53→16, pagination-skips-page 54→23; Opus on post-slug-binding 104→56, mass-assignment-author 37→13.
- Reversals exist (Haiku raw-body-no-validation 19→33 turns; Opus auto-excerpt 33→37): on the easiest tasks the shipped guidance is overhead the agent reads and does not need.

## Failure taxonomy (17 FAIL cells / 360)

| task | fails | where | cause |
|---|---|---|---|
| api-posts-contract | 8 | haiku-4-5-shipped, haiku-4-5-bare, sonnet-5-bare, haiku-4-5-bare, sonnet-5-bare, haiku-4-5-bare, haiku-4-5-shipped, haiku-4-5-shipped | `.with('author').paginate()` returns `author: null` — @guren/orm 2.4.0 `paginate()` skips eager loading (framework bug found by this corpus, filed); agents that copied the app's own `index` chain lost the author field |
| welcome-mail-job | 2 | haiku-4-5-bare, haiku-4-5-shipped | hardest task: queue + mail wiring from zero; incompletes / wrong wiring |
| published-flag | 2 | haiku-4-5-bare, haiku-4-5-bare | Haiku bare: incomplete visibility matrix (draft leaked in one surface) |
| typed-form-register | 1 | haiku-4-5-bare | Haiku bare: typecheck broken |
| i18n-ja-catalog | 1 | haiku-4-5-bare | Haiku bare: catalog parity / missing strings |
| open-redirect-login | 1 | haiku-4-5-shipped | Haiku shipped: sanitizer incomplete on one hostile form |
| route-wildcard-404 | 1 | haiku-4-5-shipped | Haiku shipped: two routes registered under one name → duplicate identifiers after codegen → typecheck fails (hidden tests passed) |
| post-slug-binding | 1 | haiku-4-5-bare | Haiku bare: slug route/redirect not fully working |

No refusals: all 4 security-remediation tasks (60 cells) completed on every model; no cell ended with a refusal or safety stop.

## Framework-API utilization (passing cells, static scan of added lines)

Every task now carries per-task `api_markers` / `handwritten_markers` (`tasks/*/task.json`); `results/API-UTILIZATION.md` has the per-cell rows.

| condition | passing | framework-api | mixed | handwritten | unclassified |
|---|---|---|---|---|---|
| bare | 169 | 110 (65%) | 33 | 20 | 6 |
| shipped | 174 | 122 (70%) | 24 | 22 | 6 |

Modest aggregate shift toward pure framework-API solutions under the harness (65% → 70%). The per-task picture is the useful one:

- **The API the harness does not mention does not get used.** `open-redirect-login`: 0/17 passing cells (either condition) used `isSafeRedirectUrl` / `sanitizeOAuthRedirect` — every solution hand-rolled the check. `post-slug-binding`: 0/17 used route model binding (the framework cannot bind by a non-primary key in 2.6.0, so this is a gap, not a discovery failure). `health-db-probe`: no cell was API-only; those that used `createHealthManager`/`DatabaseCheck` still hand-wrote `SELECT 1`. `rate-limit-login`: 15/17 mixed — `createRateLimitMiddleware` plus hand-kept counters/wording.
- **Where the digest names the API, both conditions use it** (validateBody, authorize, redirect, paginate, resource fields, where/orderBy): 9/9 framework-api on most bug/sec tasks in both conditions.
- Actionable for `guren context`: add the redirect-safety helpers and the health subsystem to the digest; both are cases where the harness could have moved solutions from handwritten to API and did not, because the digest never mentions them (push beats pull).

## Caveats

- Single runner (Claude Code) — the planned mini-swe-agent parity sample was not run (no API-metered runner was set up), so harness-independence is asserted, not measured; wall-clock is noisy (other workloads on the same machine); API-equivalent cost is `total_cost_usd` from the CLI's result event.
- The bare condition still has `node_modules/@guren/*/dist/*.d.ts` and the app's own code as context — 'bare' means no agent guidance, not no information.
- Verification regenerates codegen artifacts before typecheck (dev-server behaviour); a patch that only typechecks against stale generated files fails.
- 2 Sonnet bare cells hit the 120-turn cap and still passed; no cell was censored into a FAIL by the cap.
- What the shipped condition actually delivered: `agent:init`'s CLAUDE.md, rules, skills and the SessionStart hook (which injects the `guren context` digest) — the hook fired in **180/180** shipped cells (`hook_started`/`hook_response` events in the streams). Its PostToolUse hook (`guren check` after every edit) fired in **0/180**: the headless runner treats the worktree as untrusted and did not run it, and it also ignored `agent:init`'s `permissions.allow` list (moot, since the runner's own allowlist already covers `bun`/`bunx`). So the measured harness is the *session-start* delivery only; the edit-time check was not part of it. If anything this understates the shipped effect.
- Tasks were authored by Claude subagents from the designs in CORPUS.md, each gated by `validate-task.sh` (hidden tests fail on the start state, pass on the reference) and reviewed by the maintainer; every task, seed, hidden test and reference solution is in `tasks/`.
