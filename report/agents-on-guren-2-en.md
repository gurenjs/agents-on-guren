# Agents on Guren, round 2: what 249 runs say about "convention as token efficiency"

*guren.dev, 2026-09-25.*

On 9 September the Rails Foundation published [Agents on Rails Stage 2](https://rubyonrails.org/2026/9/9/agents-on-rails-stage-2): 20 feature tickets on Fizzy, 37signals' kanban app, three attempts per ticket. The best model passed 35% (GPT-6 Astra). Fable 5.1 passed 32% at $9.14 per run and Opus 5 passed 25% at $9.85. Stage 1 had stopped telling models apart; in Rails' words, "the tasks were deliberately small, and more than half the time the models reinvented the wheel instead of reaching for the framework".

On 23 September, in his Rails World [keynote](https://youtu.be/V9SxpJpHuus), DHH said 37signals has [stopped writing code by hand](https://youtu.be/V9SxpJpHuus?t=3240) and fixes the factory when an agent fails, that convention over configuration [pays off as token efficiency](https://youtu.be/V9SxpJpHuus?t=4020), and that every app should ship [a CLI](https://youtu.be/V9SxpJpHuus?t=4740) for its users' own agents.

Guren borrows Rails' conventions, and the apps under test run its v2 line, released on 1 August 2026, after the reliable knowledge cutoff every model here publishes. So both the token claim and a Stage 2 style corpus can be measured on an API the models are unlikely to know from training. This follows [the first report](https://guren.dev/blog/agents-on-guren-the-first-benchmark-report) from August, in two parts:

- Part A: one feature, one spec, one model, built on Guren and on plain Hono. 24 cells.
- Part B: nine product tickets on a Guren blog, four models, with and without the agent harness `guren agent:init` installs, plus a small experiment with approved implementation plans. 225 cells.

Rails ran its benchmark on its own runners (lemans and miniswen); ours is headless Claude Code, so the two sets of numbers are not on one scale.

## Part A: the same feature on Guren and on plain Hono

The task comes from [framework-comparison](https://github.com/gurenjs/framework-comparison): add tags to a small blog (schema, forms, display, a `?tag=` filter, validation, tests). Scoring is blind: typecheck, the app's tests, and a hidden HTTP smoke that checks the filter. In July, with Sonnet 5 on that runner, Guren cost 1.65 times the cheapest stack (Hono).

The July runner loaded the operator's own MCP servers, plugins and skills. This round's runner is isolated (`--strict-mcp-config`, project and local settings only, no web tools, auto-memory off) and records the CLI version, model and app commit per cell (Claude Code 2.1.284 for the Sonnet 5.5 arms, 2.1.281 for the two Opus 5.5 arms). The Guren app is on the releases current when the round ran (cli 2.27.0, core 1.21.0, server 2.26.0, orm 2.12.0) with a regenerated harness. Two controls ran beside it under the same runner: Hono, and the Guren app as the summer rounds left it (commit 716117a, cli 2.0, labelled `guren-july` in the data). All 24 cells passed.

| arm | model | turns (range) | cost (range) | cost vs Hono |
|---|---|---|---|---|
| Hono | Sonnet 5.5 | 40 (29–42) | $0.41 ($0.38–0.46) | 1.00× |
| Guren, shipped harness (cli 2.27) | Sonnet 5.5 | 38 (30–41) | $0.57 ($0.56–0.61) | 1.40× |
| Guren, no harness | Sonnet 5.5 | 51 (47–52) | $0.63 ($0.58–0.69) | 1.54× |
| Guren, summer app (716117a) | Sonnet 5.5 | 33 (32–37) | $0.57 ($0.49–0.64) | 1.38× |
| Guren, shipped, rule frontmatter fixed | Sonnet 5.5 | 33 (29–41) | $0.57 ($0.47–0.70) | 1.39× |
| Guren, shipped harness (cli 2.28) | Sonnet 5.5 | 38 (37–43) | $0.52 ($0.50–0.63) | 1.26× |
| Hono | Opus 5.5 | 40 (38–41) | $0.88 ($0.83–0.91) | 1.00× |
| Guren, shipped harness (cli 2.27) | Opus 5.5 | 40 (38–45) | $1.32 ($1.31–1.55) | 1.49× |

Medians of three runs per arm. A range is the lowest and highest of those runs, not an interval around the median. Cost is API-equivalent, as the CLI reports it. The "rule frontmatter fixed" row is the shipped harness with one mistake corrected: its rule files used `globs:`, a key Claude Code does not read, instead of `paths:` (fixed in [#1056](https://github.com/gurenjs/guren/pull/1056)). The "cli 2.28" row runs the harness as released with that fix (cli 2.28.0, core 1.22.0, orm 2.13.0). The release changed more than the frontmatter (the digest gained API token and rate limit sections, and the harness a plan-writing skill), so the row measures the released harness as a whole: 1.26× at the median, 1.32× at the mean.

The Sonnet rows were first measured with Sonnet 5; Sonnet 5.5 came out while this report was in draft, and the six Sonnet arms were run again on it. The ratios moved little (shipped 1.44 → 1.40, no harness 1.68 → 1.54, cli 2.28 1.28 → 1.26), with one exception. On Sonnet 5 the frontmatter fix was the cheapest Guren arm (1.27×); on Sonnet 5.5 it is level with the unfixed harness. The fix still does what it is for (guidance loaded at session start falls from 25.5k to 9.2k tokens), but on Sonnet 5.5 the saving went elsewhere, as the accounting below shows. The Sonnet 5 numbers are round 7 of [framework-comparison](https://github.com/gurenjs/framework-comparison/blob/main/agent-eval/PILOT.md), the Sonnet 5.5 numbers round 8.

On this task Guren costs more than plain Hono: 1.40 times on Sonnet 5.5 and 1.5 times on Opus 5.5. The turn counts are close (38 against 40 on Sonnet, 40 each on Opus). For Sonnet, the token accounting below puts the difference in context carried per turn; the Opus cells were not accounted, so their mechanism is unmeasured. Against the bare app the harness saves 25% of turns, and 9% of cost at the median, 8% at the mean (the same direction as in the summer rounds, with overlapping ranges).

The current app is not cheaper than the July app under the same runner: the July app's median is 33 turns / $0.57, the current app's 38 / $0.57, and the ranges overlap. So this round makes no claim about Guren getting cheaper over time, and 1.40 does not follow on from July's 1.65. With Sonnet 5 under this round's runner, the July numbers ($3.35 for Guren, $2.03 for Hono) fell to under a dollar for every arm, Hono included. The July app fell with the rest, which rules out Guren's releases as the cause. That the runner caused it, most likely its isolation, is a hypothesis: nothing here isolates the runner, and the models may have moved since July too.

### Where the remaining gap goes

This accounting is an attribution model, not a direct measurement. Every tool action in the 18 Sonnet 5.5 cells was classified by heuristic and charged the tokens it cost: its output, its result cached and re-read on later calls, and an equal share of that call's re-read of the shared prompt prefix. Output tokens are reconstructed from visible characters, and result tokens at 2.4 characters per token. The buckets add up to each cell's `total_cost_usd` to within a cent:

- **name confusion**: looking for which package holds a symbol across the `@guren/core` / `@guren/server` split, the thing RFC 0024 (merging the two packages) would remove;
- **API learning**: reading `node_modules/@guren/*`, guidance files or generated types, plus the guidance loaded at session start;
- **implementation**: the app's own files, edits, codegen, tests.

| arm | gap to Hono (mean) | name confusion | API learning | implementation |
|---|---|---|---|---|
| Guren shipped | $0.167 | 0% | 107% | −8% |
| Guren bare | $0.220 | 6% (10% if removed) | 44% | 42% |
| Guren shipped, frontmatter fixed | $0.164 | 0% | 53% | 32% |
| Guren shipped (cli 2.28) | $0.135 | 0% | 55% | 21% |

The rest of each gap is rule text attached during the session, assistant text and rounding. This classifier detected no name confusion in any cell with a harness. That is a lower bound: a search hidden among other output of the same command goes undetected. In two of the three bare cells it is the same episode: the agent looks for `paginate()`'s options in `@guren/core/dist`, finds a bare re-export, and ends up in `@guren/server`'s `Paginator.d.ts` after four or five actions. The shipped harness states that signature at session start, so the search never happens.

The whole shipped gap is guidance paid for up front; its implementation actions cost slightly less than Hono's. The shipped agent reads nothing from `node_modules`; it pays for 25.5k tokens of guidance cached at the start and re-read on each of 15–18 calls, $0.17–0.19 per cell. The frontmatter fix cuts that to 9.2k tokens ($0.11 less per cell) and the cli 2.28 harness to 7.1k. In the frontmatter-fixed cells the $0.11 went elsewhere: about $0.04 to commands the runner refused (they had 5–7 refusals per cell against 4–5), $0.02 each to rule text attached later in the session, to implementation and to reading guidance on demand. A path-scoped rule is loaded when a matching file is touched, so part of the guidance moved later rather than going away. The implementation column includes refused commands.

## Part B: nine product tickets

Round 1's 20 atomic tasks saturated for Sonnet and Opus (58–60 of 60 either way). Stage 2 raises the task size the way Rails did: each ticket reads like a product owner's request (what and why, never which API) and touches at least three subsystems of a fresh `create-guren-app@1.17.2` blog.

| ticket | what it asks for | hidden tests |
|---|---|---|
| post-tags | tags on posts, `?tag=` filter, at most five per post (Part A's spec on this app) | 6 |
| comments-moderation | comments; author or post author may delete; three reports hide a comment | 8 |
| post-revisions | a revision per edit, list and restore, author only | 6 |
| scheduled-publish | publish later; hidden from others until then; a console command listing the schedule | 7 |
| json-api-tokens | personal API tokens, a bearer JSON API, 60 requests per minute per token | 10 |
| locale-switch | Japanese, a persisted language switch, catalogs that `guren check --i18n` accepts | 13 |
| newsletter-module | a newsletter sign-up as an application module, with an architecture rule keeping the blog out of it | 14 |
| posts-agent-tool | search and create posts as agent tools over MCP, with correct read-only hints | 11 |
| cover-attachment | a cover image: PNG or JPEG up to 2 MB, replace, remove, deleted with the post | 9 |

A cell passes when its ticket's hidden tests pass (84 across the nine tickets) and the app typechecks. The hidden tests check behaviour over HTTP, Inertia props and database rows, plus a few wiring checks (the module lives where the ticket says, `guren check` exits 0). The test suite the agent can see is run and reported, but it is not part of the gate. An unauthorized delete that succeeds is a fail. A separate idiom column scans passing patches for framework API versus hand-rolled code and never affects the verdict. Statements pin table names, routes, status codes and prop keys so the tests have something stable. Opus 5.5 subagents wrote all nine from our briefs; each was admitted only after its hidden tests failed on the baseline, passed on the reference, and failed again when the author broke the reference three ways.

Nine tickets × {Sonnet 5.5, Opus 5.5, Haiku 4.5, Fable 5.1} × {bare, shipped} × 3 trials, plus a plan condition for Sonnet on three tickets: 225 cells on 2026-09-29 and 30, a 200-turn cap no cell reached, 16.3 hours of cell time, $477.84 API-equivalent ($0 cash on a Max subscription).

| model | pass, bare | pass, shipped | median turns | median cost | Δ median cost | Δ mean cost |
|---|---|---|---|---|---|---|
| Sonnet 5.5 | 26/27 (96%) | 27/27 | 37 → 29 (−22%) | $0.57 → $0.61 | +7% | +1% |
| Opus 5.5 | 27/27 | 27/27 | 59 → 43 (−27%) | $1.51 → $1.29 | −14% | −11% |
| Haiku 4.5 | 8/27 (30%) | 12/27 (44%) | 90 → 80 (−11%) | $0.79 → $0.89 | +13% | +10% |
| Fable 5.1 | 27/27 | 27/27 | 99 → 78 (−21%) | $6.27 → $5.42 | −13% | −16% |

The harness shows up in turns. Opus and Fable take 21–27% fewer at the same pass rate; Sonnet takes 22% fewer while its pass rate moves by one cell. Cost follows for Opus and Fable. On Sonnet the median rises 7% and the mean 1%. Its sessions are short (29–37 turns), and guidance loaded at start may weigh more against a short session; Part B was not token-accounted, so that is a hypothesis. Haiku costs more with the harness (+13% median, +10% mean) in fewer turns, so each turn carries more; its failing cells cost more than its passing ones in both conditions. Where median and mean disagree, the table has both.

Pass rate moves in two places. Haiku goes from 30% to 44%. On Sonnet, one cell: newsletter-module goes from 2/3 to 3/3 (26/27 to 27/27):

| ticket | Sonnet bare | Sonnet shipped | Opus 5.5 bare / shipped | Haiku bare | Haiku shipped | Fable bare / shipped |
|---|---|---|---|---|---|---|
| post-tags | 3/3 | 3/3 | 3/3 · 3/3 | 0/3 | 2/3 | 3/3 · 3/3 |
| comments-moderation | 3/3 | 3/3 | 3/3 · 3/3 | 1/3 | 3/3 | 3/3 · 3/3 |
| post-revisions | 3/3 | 3/3 | 3/3 · 3/3 | 3/3 | 3/3 | 3/3 · 3/3 |
| scheduled-publish | 3/3 | 3/3 | 3/3 · 3/3 | 2/3 | 1/3 | 3/3 · 3/3 |
| json-api-tokens | 3/3 | 3/3 | 3/3 · 3/3 | 2/3 | 3/3 | 3/3 · 3/3 |
| locale-switch | 3/3 | 3/3 | 3/3 · 3/3 | 0/3 | 0/3 | 3/3 · 3/3 |
| newsletter-module | 2/3 | 3/3 | 3/3 · 3/3 | 0/3 | 0/3 | 3/3 · 3/3 |
| posts-agent-tool | 3/3 | 3/3 | 3/3 · 3/3 | 0/3 | 0/3 | 3/3 · 3/3 |
| cover-attachment | 3/3 | 3/3 | 3/3 · 3/3 | 0/3 | 0/3 | 3/3 · 3/3 |

Sonnet's one failure, on newsletter-module without the harness, is a mass-assignment defect: it confirms a subscription with `update({ id }, { confirmedAt })`, the model's `fillable` list rejects `confirmedAt`, and the confirmation link answers 500. The agent's own tests passed; the hidden tests caught it. The shipped guidance names `fillable` and the force-write methods in CLAUDE.md, the ORM rule and the digest, but one cell out of three is no evidence that the harness prevents it. Haiku fails locale-switch, newsletter-module, posts-agent-tool and cover-attachment in every cell.

posts-agent-tool is the closest this corpus comes to DHH's CLI claim: expose two routes as agent tools over MCP. Sonnet, Opus and Fable passed every cell, Haiku none of six.

Rails' Stage 1 ceiling is back for Stage 2. Opus 5.5 and Fable 5.1 pass every cell in both conditions, Sonnet 5.5 96–100%. For the top models on this corpus pass rate has stopped discriminating, and the harness effect lives in effort. Rails' 35% is not comparable: a different runner, a larger app, and our tickets pin tables, routes and prop keys.

### Idiom

Rails counted wheel reinvention in Stage 1. The same column here, over passing cells:

| model | condition | passing | framework API only | mixed | hand-rolled |
|---|---|---|---|---|---|
| Sonnet 5.5 | bare | 26 | 13 | 10 | 3 |
| Sonnet 5.5 | shipped | 27 | 15 | 9 | 3 |
| Opus 5.5 | bare | 27 | 22 | 5 | 0 |
| Opus 5.5 | shipped | 27 | 20 | 7 | 0 |
| Haiku 4.5 | bare | 8 | 4 | 4 | 0 |
| Haiku 4.5 | shipped | 12 | 4 | 8 | 0 |
| Fable 5.1 | bare | 27 | 19 | 8 | 0 |
| Fable 5.1 | shipped | 27 | 21 | 6 | 0 |

Hand-rolled solutions are rare. All six of Sonnet's are cover-attachment (three bare, three shipped), writing files by hand instead of using attachments. Opus and Fable have no handwritten-only patch; their mixed patches sit mostly in json-api-tokens and cover-attachment.

The harness barely moves this column: framework-only patches go from 22 to 20 for Opus, 19 to 21 for Fable, 13 to 15 for Sonnet. One handwritten marker makes a patch "mixed", and some markers fire on code the ticket asks for: in the Opus patches the hits are `new Response(null, { status: 204 })` on endpoints the ticket pins as 204, and a `Retry-After` header the ticket requires, set inside the framework rate limiter's `onRateLimited` callback. It is a coarse scan, reported as measured.

## Plans: the loop the agents did not run

Guren's implementation plans (RFC 0030) are a factory in DHH's sense: a human approves a plan, the agent implements it step by step, and `plan:next`, `plan:verify` and a Stop hook check each step. Three tickets (post-tags, comments-moderation, scheduled-publish) got an approved plan, written by the authoring subagents in 6–11 minutes and roughly 50–70k tokens each (none recorded for scheduled-publish). The ticket text is identical in both conditions; the plan condition adds the plan files and one line: the plan is under `docs/plans/`, implement the plan. Sonnet 5.5, N=3.

Both conditions passed 9 of 9, and the plan cells took more effort (37 turns and $0.70 median, against 27 and $0.55 on the same three tickets without a plan). What matters is what the agents did with it.

| cell | `plan:next` calls | `plan:verify` calls | commits | turns |
|---|---|---|---|---|
| post-tags 1 / 2 / 3 | 1 / 1 / 3 | 0 / 0 / 1 | 0 / 0 / 0 | 39 / 57 / 40 |
| comments-moderation 1 / 2 / 3 | 1 / 0 / 1 | 0 / 0 / 0 | 0 / 0 / 0 | 28 / 31 / 42 |
| scheduled-publish 1 / 2 / 3 | 0 / 1 / 0 | 0 / 1 / 0 | 0 / 0 / 0 | 37 / 27 / 28 |

The designed loop is one step, one verification, one commit, repeated. No cell ran it. None committed; three never called `plan:next`; the other six called it once to three times, read the plan and implemented everything in one pass, and two of them ran `plan:verify` once.

Part of the reason is the loop's design. The Stop hook judges only the step `plan:next` marked. The first step (scaffolding, verified by codegen and typecheck alone) passes trivially, and if the agent never calls `plan:next` again, nothing stops it. Headless Sonnet, told to implement the plan, did not. For RFC 0030 that means the hook should block while unverified steps remain, or the skill has to drive the loop. What was measured is the plan as agents used it: mostly a one-shot implementation with a plan beside it.

## What this means for the framework

RFC 0024 stays where it is. Its case rested on name confusion between `@guren/core` and `@guren/server`, which Part A's classifier did not detect with the harness and found as one recurring search without it. The remaining cost is API learning paid at session start, so the levers are the digest and how much guidance loads when a session starts.

The round turned up 22 findings about Guren itself, most of them while the tickets were being written. The main ones:

- Harness: the rule files used `globs:` where Claude Code reads `paths:`, so all six loaded at every session start (#1056); the digest had nothing on API tokens, bearer auth or rate limits (#1074); `guren context` never mentions modules or `guren.arch.ts`; the hook commands in the scaffolded `settings.json` were relative paths, so after an agent ran `cd` the after-edit hook failed with "Module not found" (22 times in five shipped cells, each after a `cd`, 18 of them in one Opus cell that had moved into `node_modules`; #1085).
- CLI checks: `guren audit` had no rule for a mutating action that skips a model's policy (it now warns, #1054); `check --arch` let a directory import (`'../modules/newsletter'`, the form `make:module` writes) through (#1071); `introspect` child processes outlived a crashed parent (#1084).
- ORM and API traps: `where('publishedAt', 'is null')` compared against the string `'is null'` (the agent's tests and the gate passed it, a hidden test did not; it is now refused, #1080); `DatabaseApiTokenStore` wrote a `Date` into SQLite text timestamps and answered 500 (#1065); `data.gen.ts` could declare an identifier twice (#1064); `belongsToMany` has no `attach`/`sync`; an unauthenticated agent-tool call got a 302 that tool dispatch mapped to success (#1073); `@guren/plugin-mcp` answers 500 until a token table exists, and nothing scaffolds one; attachments lack a MIME allowlist and per-collection size limits; codegen types `z.file()` as `unknown`; the test client has no cookie jar or `arrayBuffer()`.
- Plans: no plan element for a console command or a query scope, and the Stop hook gap above.

The ten with a number are fixed and shipped in the v2.27.0 release (cli 2.28.0, server 2.27.0, core 1.22.0, orm 2.13.0). The rest are not yet ticketed.

## Caveats

- One runner: headless Claude Code with project-only settings. Rails' numbers come from lemans and miniswen and are not on our scale.
- The first production run had auto memory on: partway through, cells began reading notes earlier cells had written. The Opus 5.5, Haiku 4.5 and Fable 5.1 cells were run again with it off; the earlier run is in the repository's history.
- Sonnet 5.5 was released after that run, and the Sonnet cells of both parts were run on it in place of Sonnet 5. The corpus had been calibrated on Sonnet 5 and frozen by design criteria, not by pass rate. Sonnet 5.5 costs the same per token.
- Guren's first release was in November 2025. Sonnet 5.5, Opus 5.5 and Fable 5.1 list a reliable knowledge cutoff of June 2026 (Haiku 4.5: February 2025), so three of the four models may have seen pre-v2 Guren. Guren v2 (August 2026) is after all four reliable knowledge cutoffs, but training data cutoffs are not published and can be later; Fable 5.1 was released in September 2026.
- Three trials per task, model and condition: 27 runs per model and condition in Part B (9 for the plan condition), three per arm in Part A. The ranges in the tables are the observed spread of those runs, not uncertainty around the medians, and they overlap; means sit beside medians wherever the two disagree. The observed directions are consistent with the proposed mechanisms, but N=3 does not establish an effect.
- We wrote the tasks, through Opus 5.5 subagents working from our briefs, and reviewed them. The statements pin their contract, which makes them easier than an open ticket.
- Calibration changed the runner. A Sonnet 5 run (N=1, 21 cells, 20 passes) changed no statement or hidden test, but three runner changes went into every condition before production: the plan line ends in "Implement the plan." (with the earlier wording agents read the plan and never ran `plan:next`); `git` is allowed and the scored patch is diffed from the start commit, so a plan cell can commit per step; and the preamble asks for the Write and Edit tools instead of heredocs or `cd` chains, with `env` and `python3` allowed, after 77 permission denials in 17 cells.
- None of the nine plan cells committed, so allowing `git` changed nothing measurable here.
- Part A predates those runner notes. Heredoc and `python3` denials cost every Part A arm $0.05–0.14 per cell, roughly equally, so absolute costs do not carry from Part A to Part B.
- Hooks fired this time. In round 1 the edit-time hook never ran. This round, the session-start, after-edit and Stop hooks fired in every shipped cell; the Stop hook runs `guren gate` and blocked three times in Sonnet shipped cells, once in a Haiku shipped cell and never elsewhere. The shipped condition is not identical to round 1's.
- Opus 5.5 is not Opus 5, which round 1 and Rails' Stage 2 used. Models may also have changed since July in ways the Hono control only partly absorbs.
- Fable 5.1 passes everything at $5.42–6.27 median per cell, about 4.2 times Opus 5.5. In the run set aside for auto memory it cost $3.51–4.01. Opus moved little between the two runs; Haiku passed more then (41% and 56%). The price per token is the same in both runs, so its sessions did more work this time; why is not established.
- On these nine self-authored tickets and this runner, the top models are saturated. Pass rate will say something about Opus 5.5 or Fable 5.1 here only on harder tickets.

The Stage 2 corpus (statements, hidden tests, reference solutions, plans), the harness, and per-cell patches and verdicts for all 225 cells are in the repository: https://github.com/gurenjs/agents-on-guren. The full event streams are attached to the [v2026.09.30 release](https://github.com/gurenjs/agents-on-guren/releases/tag/v2026.09.30). Part A's runner, logs and the token accounting live in [framework-comparison](https://github.com/gurenjs/framework-comparison) under `agent-eval/`, with its streams in [that repository's release](https://github.com/gurenjs/framework-comparison/releases/tag/v2026.09.30).
