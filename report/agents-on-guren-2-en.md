# Agents on Guren, round 2: the same feature on Hono, and nine product tickets

*guren.dev, 2026-09-25.*

On 9 September the Rails Foundation published [Agents on Rails Stage 2](https://rubyonrails.org/2026/9/9/agents-on-rails-stage-2): 20 feature tickets on Fizzy, 37signals' kanban app, three attempts per ticket. The best model passed 35% (GPT-6 Astra). Fable 5.1 passed 32% at $9.14 per run and Opus 5 passed 25% at $9.85. Stage 1 had stopped telling models apart; in Rails' words, "the tasks were deliberately small, and more than half the time the models reinvented the wheel instead of reaching for the framework".

On 23 September, in his Rails World [keynote](https://youtu.be/V9SxpJpHuus), DHH said 37signals has [stopped writing code by hand](https://youtu.be/V9SxpJpHuus?t=3240) and fixes the factory when an agent fails, that convention over configuration [pays off as token efficiency](https://youtu.be/V9SxpJpHuus?t=4020), and that every app should ship [a CLI](https://youtu.be/V9SxpJpHuus?t=4740) for its users' own agents.

Guren borrows Rails' conventions and is too new for any model to know, so both the token claim and a Stage 2 style corpus can be measured on it. This follows [the first report](https://guren.dev/blog/agents-on-guren-the-first-benchmark-report) from August, in two parts:

- Part A: one feature, one spec, one model, built on Guren and on plain Hono. 21 cells.
- Part B: nine product tickets on a Guren blog, four models, with and without the agent harness `guren agent:init` installs, plus a small experiment with approved implementation plans. 225 cells.

Rails ran its benchmark on its own runners (lemans and miniswen); ours is headless Claude Code, so the two sets of numbers are not on one scale.

## Part A: the same feature on Guren and on plain Hono

The task comes from [framework-comparison](https://github.com/gurenjs/framework-comparison): add tags to a small blog (schema, forms, display, a `?tag=` filter, validation, tests). Scoring is blind: typecheck, the app's tests, and a hidden HTTP smoke that checks the filter. In July, with Sonnet 5 on that runner, Guren cost 1.65 times the cheapest stack (Hono).

The July runner loaded the operator's own MCP servers, plugins and skills. This round's runner is isolated (`--strict-mcp-config`, project and local settings only, no web tools, auto-memory off) and records the CLI version (Claude Code 2.1.281), model and app commit per cell. The Guren app is on the current releases (cli 2.27.0, core 1.21.0, server 2.26.0, orm 2.12.0) with a regenerated harness. Two controls ran beside it under the same runner: Hono, and the Guren app as the summer rounds left it (commit 716117a, cli 2.0, labelled `guren-july` in the data). All 21 cells passed.

| arm | model | turns (range) | cost (range) | cost vs Hono |
|---|---|---|---|---|
| Hono | Sonnet 5 | 38 (36–42) | $0.42 ($0.39–0.48) | 1.00× |
| Guren, shipped harness (cli 2.27) | Sonnet 5 | 41 (37–52) | $0.60 ($0.60–0.82) | 1.43× |
| Guren, no harness | Sonnet 5 | 53 (47–59) | $0.71 ($0.59–0.79) | 1.69× |
| Guren, summer app (716117a) | Sonnet 5 | 37 (35–46) | $0.56 ($0.50–0.62) | 1.33× |
| Guren, shipped, rules scoped with `paths:` | Sonnet 5 | 31 (30–50) | $0.53 ($0.53–0.68) | 1.26× |
| Hono | Opus 5.5 | 40 (38–41) | $0.88 ($0.83–0.91) | 1.00× |
| Guren, shipped harness (cli 2.27) | Opus 5.5 | 40 (38–45) | $1.32 ($1.31–1.55) | 1.50× |

N=3 medians, API-equivalent cost as the CLI reports it.

On this task Guren costs more than plain Hono: 1.43 times on Sonnet and 1.5 times on Opus 5.5, in the same number of turns, so the difference is context carried per turn. Against the bare app the harness still saves 23% of turns and 15% of cost (the same direction as in the summer rounds, with overlapping ranges).

The summer app is not cheaper than the current one under the same runner (37 turns / $0.56 against 41 / $0.60). The July numbers ($3.35 for Guren, $2.03 for Hono) fell to under a dollar for every arm, Hono included. That drop belongs to the runner, most likely the isolation, and says nothing about Guren's releases. So this round makes no claim about Guren getting cheaper over time, and 1.43 does not follow on from July's 1.65.

### Where the remaining gap goes

Every tool action in the 15 Sonnet cells was classified and charged the tokens it cost (its output, its result cached and re-read on later calls, a share of the base prompt re-read). The buckets add up to each cell's `total_cost_usd` to within a cent:

- **name confusion**: looking for which package holds a symbol across the `@guren/core` / `@guren/server` split, the thing RFC 0024 (merging the two packages) would remove;
- **API learning**: reading `node_modules/@guren/*`, guidance files or generated types, plus the guidance loaded at session start;
- **implementation**: the app's own files, edits, codegen, tests.

| arm | gap to Hono (mean) | name confusion | API learning | implementation |
|---|---|---|---|---|
| Guren shipped | $0.244 | 0% | 80% | 17% |
| Guren bare | $0.264 | 12% (22% if removed) | 45% | 33% |

Name confusion is zero in every shipped cell. In each bare cell it is the same episode: the agent looks for `paginate()`'s options in `@guren/core/dist`, finds a bare re-export, and ends up in `@guren/server`'s `Paginator.d.ts` after four or five actions. The shipped harness states that signature at session start, so the search never happens.

Eighty percent of the shipped gap is API learning, almost all of it guidance paid for up front. The shipped agent reads almost nothing from `node_modules`; it pays for 25.5k tokens of guidance cached at the start and re-read on each of 16–24 calls, $0.18–0.22 per cell.

### `globs:` is not a key Claude Code reads

That 25.5k is larger than it should be. The harness ships six rule files scoped with a `globs:` frontmatter key. Claude Code's [memory docs](https://code.claude.com/docs/en/memory) name `paths` as the only field a rule is read for. A rule without `paths` loads at launch, like CLAUDE.md. So every scaffolded Guren app has been loading 42 KB of rules at the start of every session.

This contradicts an earlier diagnosis. In August (round 5 in the comparison repo's lab notes) we explained a lost harness win by rules that "attach on edit", after most API research is done. The round-5 app used the same `globs:` key, so its rules were probably loaded at launch too, unless Claude Code treated the key differently in August. The digest that round shipped in `guren context` stands on its own measurement; the explanation around it does not.

A fifth arm scoped the same six rules with `paths:`. The first call's context fell from 53k to 37k tokens, and the medians moved to 31 turns and $0.53, 1.26 times Hono. Some of the saving is paid back: the agents `cat` the ORM rule CLAUDE.md points to, and Claude Code attaches rule text after file reads (inferred from cache writes, since the stream does not show attached rules). The ranges overlap ($0.53–0.68 against $0.60–0.82), so N=3 gives the direction, which matches the $0.12 the accounting predicts, and not the size. The template fix is [open as #1056](https://github.com/gurenjs/guren/pull/1056); until it ships, an app scaffolded today is the 1.43× arm.

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

Pass or fail is the 84 hidden tests: behaviour over HTTP, Inertia props and database rows, plus a few wiring checks (the module lives where the ticket says, `guren check` exits 0). An unauthorized delete that succeeds is a fail. A separate idiom column scans passing patches for framework API versus hand-rolled code and never affects the verdict. Statements pin table names, routes, status codes and prop keys so the tests have something stable. Opus 5.5 subagents wrote all nine from our briefs; each was admitted only after its hidden tests failed on the baseline, passed on the reference, and failed again when the author broke the reference three ways.

Nine tickets × {Sonnet 5, Opus 5.5, Haiku 4.5, Fable 5.1} × {bare, shipped} × 3 trials, plus a plan condition for Sonnet on three tickets: 225 cells on 2026-09-25, a 200-turn cap no cell reached, 15.2 hours of cell time, $391.66 API-equivalent ($0 cash on a Max subscription).

| model | pass, bare | pass, shipped | median turns | median cost | Δ median cost | Δ mean cost |
|---|---|---|---|---|---|---|
| Sonnet 5 | 25/27 (93%) | 26/27 (96%) | 37 → 29 (−22%) | $0.57 → $0.63 | +11% | +10% |
| Opus 5.5 | 27/27 | 27/27 | 65 → 43 (−34%) | $1.58 → $1.31 | −17% | −10% |
| Haiku 4.5 | 11/27 (41%) | 15/27 (56%) | 96 → 81 (−16%) | $1.00 → $0.90 | −10% | −7% |
| Fable 5.1 | 27/27 | 27/27 | 77 → 59 (−23%) | $4.01 → $3.51 | −12% | −15% |

For Sonnet, Opus and Fable the harness shows up in turns: 22–34% fewer at the same pass rate. Cost follows for Opus and Fable. On Sonnet it goes the other way, +11% median and +10% mean. Its sessions are short (29–37 turns), and guidance loaded at start may weigh more against a short session; Part B was not token-accounted, so that is a hypothesis. Where median and mean disagree (Opus −17% against −10%, Fable −12% against −15%), the table has both.

Pass rate moves in two places. Haiku goes from 41% to 56%. On Sonnet, one ticket carries the whole difference:

| ticket | Sonnet bare | Sonnet shipped | Opus 5.5 bare / shipped | Haiku bare | Haiku shipped | Fable bare / shipped |
|---|---|---|---|---|---|---|
| post-tags | 3/3 | 3/3 | 3/3 · 3/3 | 1/3 | 2/3 | 3/3 · 3/3 |
| comments-moderation | 3/3 | 3/3 | 3/3 · 3/3 | 2/3 | 3/3 | 3/3 · 3/3 |
| post-revisions | 3/3 | 3/3 | 3/3 · 3/3 | 3/3 | 3/3 | 3/3 · 3/3 |
| scheduled-publish | 3/3 | 3/3 | 3/3 · 3/3 | 3/3 | 2/3 | 3/3 · 3/3 |
| json-api-tokens | 3/3 | 3/3 | 3/3 · 3/3 | 2/3 | 3/3 | 3/3 · 3/3 |
| locale-switch | 3/3 | 3/3 | 3/3 · 3/3 | 0/3 | 0/3 | 3/3 · 3/3 |
| newsletter-module | 1/3 | 3/3 | 3/3 · 3/3 | 0/3 | 1/3 | 3/3 · 3/3 |
| posts-agent-tool | 3/3 | 2/3 | 3/3 · 3/3 | 0/3 | 1/3 | 3/3 · 3/3 |
| cover-attachment | 3/3 | 3/3 | 3/3 · 3/3 | 0/3 | 0/3 | 3/3 · 3/3 |

Sonnet's two bare failures on newsletter-module are one defect: confirming a subscription with `update({ confirmedAt })`, which the model's `fillable` list rejects with a `MassAssignmentException`. The agents' own tests passed; the hidden tests caught it. All three shipped cells avoided it, and the shipped guidance names `fillable` and the force-write methods in CLAUDE.md, the ORM rule and the digest. At N=3 that is a plausible cause, unproven. Haiku fails locale-switch and cover-attachment in every cell.

posts-agent-tool is the closest this corpus comes to DHH's CLI claim: expose two routes as agent tools over MCP. Opus and Fable passed every cell, Sonnet five of six, Haiku one of six.

Rails' Stage 1 ceiling is back for Stage 2. Opus 5.5 and Fable 5.1 pass every cell in both conditions, Sonnet 93–96%. For the top models on this corpus pass rate has stopped discriminating, and the harness effect lives in effort. Rails' 35% is not comparable: a different runner, a larger app, and our tickets pin tables, routes and prop keys.

### Idiom

Rails counted wheel reinvention in Stage 1. The same column here, over passing cells:

| model | condition | passing | framework API only | mixed | hand-rolled |
|---|---|---|---|---|---|
| Sonnet 5 | bare | 25 | 12 | 8 | 5 |
| Sonnet 5 | shipped | 26 | 14 | 10 | 2 |
| Opus 5.5 | bare | 27 | 24 | 3 | 0 |
| Opus 5.5 | shipped | 27 | 17 | 10 | 0 |
| Haiku 4.5 | bare | 11 | 4 | 7 | 0 |
| Haiku 4.5 | shipped | 15 | 7 | 8 | 0 |
| Fable 5.1 | bare | 27 | 26 | 1 | 0 |
| Fable 5.1 | shipped | 27 | 21 | 6 | 0 |

Hand-rolled solutions are rare. Most of Sonnet's are cover-attachment (three bare, two shipped), writing files by hand instead of using attachments. Opus and Fable never hand-roll.

For Opus and Fable the column runs the wrong way: fewer framework-only patches with the harness (24 to 17, 26 to 21). The markers explain much of it. One handwritten marker makes a patch "mixed", and in the Opus shipped patches checked, the hits were `new Response(null, { status: 204 })` on endpoints the ticket pins as 204, `Bearer` in a comment beside the framework's bearer middleware, and `notFound(` inside `HttpException.notFound()`. It is a coarse scan, reported as measured.

## Plans: the loop the agents did not run

Guren's implementation plans (RFC 0030) are a factory in DHH's sense: a human approves a plan, the agent implements it step by step, and `plan:next`, `plan:verify` and a Stop hook check each step. Three tickets (post-tags, comments-moderation, scheduled-publish) got an approved plan, written by the authoring subagents in 6–11 minutes and roughly 50–70k tokens each (none recorded for scheduled-publish). The ticket text is identical in both conditions; the plan condition adds the plan files and one line: the plan is under `docs/plans/`, implement the plan. Sonnet 5, N=3.

Both conditions passed 9 of 9, and the plan cells took slightly more effort (33 turns and $0.68 median, against 29 and $0.64 without a plan). What matters is what the agents did with it.

| cell | `plan:next` calls | `plan:verify` calls | commits | turns |
|---|---|---|---|---|
| post-tags 1 / 2 / 3 | 1 / 2 / 1 | 0 / 1 / 0 | 0 / 0 / 1 | 27 / 34 / 23 |
| comments-moderation 1 / 2 / 3 | 1 / 6 / 1 | 0 / 8 / 0 | 0 / 4 / 0 | 33 / 62 / 34 |
| scheduled-publish 1 / 2 / 3 | 6 / 2 / 1 | 8 / 2 / 0 | 7 / 2 / 0 | 33 / 36 / 31 |

The designed loop is one step, one verification, one commit, repeated. Two cells of nine ran it for several steps. Five called `plan:next` once, read the plan and implemented everything in one pass; two stopped after a step or two. Medians hide that spread.

Part of the reason is the loop's design. The Stop hook judges only the step `plan:next` marked. The first step (scaffolding, verified by codegen and typecheck alone) passes trivially, and if the agent never calls `plan:next` again, nothing stops it. Headless Sonnet, told to implement the plan, mostly did not. For RFC 0030 that means the hook should block while unverified steps remain, or the skill has to drive the loop. What was measured is the plan as agents used it: mostly a one-shot implementation with a plan beside it.

## What this means for the framework

RFC 0024 stays where it is. Its case rested on name confusion between `@guren/core` and `@guren/server`, which Part A puts at zero with the harness and at one recurring search without it. The remaining cost is API learning paid at session start, so the levers are the digest and rule scoping; the `paths:` arm removed about 40% of the gap without renaming a package.

The round turned up 21 findings about Guren itself, most of them while the tickets were being written. The main ones:

- Harness: the rules' `globs:` key (#1056 above); the digest had nothing on API tokens, bearer auth or rate limits; `guren context` never mentions modules or `guren.arch.ts`.
- CLI checks: `guren audit` had no rule for a mutating action that skips a model's policy (it now warns, #1054, merged and not yet released); `check --arch` let a directory import (`'../modules/newsletter'`, the form `make:module` writes) through; `introspect` child processes outlive a crashed parent.
- ORM and API traps: `where('publishedAt', 'is null')` compares against the string `'is null'` (the agent's tests and the gate passed it, a hidden test did not); `DatabaseApiTokenStore` writes a `Date` into SQLite text timestamps and answers 500; `data.gen.ts` can declare an identifier twice; `belongsToMany` has no `attach`/`sync`; an unauthenticated agent-tool call gets a 302 that tool dispatch maps to success; `@guren/plugin-mcp` answers 500 until a token table exists, and nothing scaffolds one; attachments lack a MIME allowlist and per-collection size limits; codegen types `z.file()` as `unknown`; the test client has no cookie jar or `arrayBuffer()`.
- Plans: no plan element for a console command or a query scope, and the Stop hook gap above.

Nine are already tickets, with the MCP test-client finding filed beside the tool-dispatch one. The rest are open.

## Caveats

- One runner: headless Claude Code with project-only settings. Rails' numbers come from lemans and miniswen and are not on our scale.
- N=3 per cell. The medians have overlapping ranges, and means sit beside them wherever the two disagree. These numbers support directions; sizes need a larger N.
- We wrote the tasks, through Opus 5.5 subagents working from our briefs, and reviewed them. The statements pin their contract, which makes them easier than an open ticket.
- Calibration changed the runner. A Sonnet run (N=1, 21 cells, 20 passes) changed no statement or hidden test, but three runner changes went into every condition before production: the plan line ends in "Implement the plan." (with the earlier wording agents read the plan and never ran `plan:next`); `git` is allowed and the scored patch is diffed from the start commit, so a plan cell can commit per step; and the preamble asks for the Write and Edit tools instead of heredocs or `cd` chains, with `env` and `python3` allowed, after 77 permission denials in 17 cells.
- The driver first reused the calibration verdicts as Sonnet's production trial 1. Those were set aside and trial 1 re-run on the final runner.
- Part A predates those runner notes. Heredoc and `python3` denials cost every Part A arm $0.05–0.14 per cell, roughly equally, so absolute costs do not carry from Part A to Part B.
- Hooks fired this time. In round 1 the edit-time hook never ran. This round, the session-start, after-edit and Stop hooks fired in every shipped cell; the Stop hook runs `guren gate` and blocked three times in Sonnet shipped cells, twice in plan cells and never elsewhere. The shipped condition is not identical to round 1's.
- Opus 5.5 is not Opus 5, which round 1 and Rails' Stage 2 used. Models may also have changed since July in ways the Hono control only partly absorbs.
- Fable 5.1 passes everything at $3.51–4.01 median per cell, 2.5–2.7 times Opus 5.5.
- Stage 2 is still saturated for the top models; only a harder stage will let pass rate say anything about Opus 5.5 or Fable 5.1 on Guren.

The Stage 2 corpus (statements, hidden tests, reference solutions, plans), the harness, and per-cell patches and verdicts for all 225 cells are in the repository: https://github.com/gurenjs/agents-on-guren. The full event streams are a release asset. Part A's runner, logs and the token accounting live in [framework-comparison](https://github.com/gurenjs/framework-comparison) under `agent-eval/`.
