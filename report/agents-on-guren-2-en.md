# Agents on Guren, round 2: what 246 runs say about "convention as token efficiency"

*guren.dev, 2026-10-01.*

On 9 September the Rails Foundation published [Agents on Rails Stage 2](https://rubyonrails.org/2026/9/9/agents-on-rails-stage-2): 20 feature tickets on [Fizzy](https://github.com/basecamp/fizzy), 37signals' open-source kanban tool for issues and ideas, built in Rails. The best model passed 35% (GPT-6 Astra); Fable 5.1 passed 32% at $9.14 per run, Opus 5 25% at $9.85. Rails moved to feature-size tickets because in Stage 1 "more than half the time the models reinvented the wheel instead of reaching for the framework".

Two weeks later, in his Rails World [keynote](https://www.youtube.com/watch?v=vDjW_dRyKXY), DHH said:

- 37signals has [stopped writing code by hand](https://youtu.be/vDjW_dRyKXY?t=1245) and fixes the factory when an agent fails;
- convention over configuration [pays off as token efficiency](https://youtu.be/vDjW_dRyKXY?t=1984);
- every app should ship [a CLI](https://youtu.be/vDjW_dRyKXY?t=2723) for its users' own agents.

[Guren](https://guren.dev) is our full-stack framework for Bun. [The first report](https://guren.dev/blog/agents-on-guren-the-first-benchmark-report), from August, introduced it, its agent harness (the guidance, hooks and skills `guren agent:init` installs) and the method. This one covers what changed since and two new sets of results:

- Part A (21 cells): the cost of adding one feature to the same blog app on Guren and on Hono.
- Part B (225 cells): nine product tickets on a Guren blog, four models, with and without the harness, plus a small experiment with approved implementation plans.

## Part A: the same feature on Guren and on Hono

[framework-comparison](https://github.com/gurenjs/framework-comparison) implements one small blog spec on several frameworks: login, posts, comments, validation, a notification and tests. Part A asks an agent to add tags to the Guren and Hono implementations: a new table and migration, React forms and display, a `?tag=` filter, validation and tests. A cell passes typecheck, the app's tests and a hidden HTTP smoke of the filter.

The Hono implementation is Hono, Drizzle and a React SPA wired together by hand. Guren is built on the same three, so this measures what Guren's conventions add to an agent's cost.

The task adds a feature to a finished app; it does not include building the app. In the same repository's measurement, the whole app took 632 handwritten lines on Guren and 977 on Hono. In July, with Sonnet 5 on a non-isolated runner, Guren cost 1.65× Hono.

This round:

- The runner is isolated: none of the operator's settings, MCP servers or auto memory are loaded.
- The Guren app is on the releases current at the time, with a regenerated harness.
- Controls under the same runner: Hono, and the Guren app as of July (cli 2.0), to tell whether any cost change since July comes from Guren's releases.
- All 21 cells passed.

| arm | model | turns (range) | cost (range) | cost vs Hono |
|---|---|---|---|---|
| Hono | Sonnet 5.5 | 40 (29–42) | $0.41 ($0.38–0.46) | 1.00× |
| Guren, shipped harness (cli 2.27) | Sonnet 5.5 | 38 (30–41) | $0.57 ($0.56–0.61) | 1.40× |
| Guren, no harness | Sonnet 5.5 | 51 (47–52) | $0.63 ($0.58–0.69) | 1.54× |
| Guren, July app (cli 2.0) | Sonnet 5.5 | 33 (32–37) | $0.57 ($0.49–0.64) | 1.38× |
| Guren, shipped harness (cli 2.28) | Sonnet 5.5 | 38 (37–43) | $0.52 ($0.50–0.63) | 1.26× |
| Hono | Opus 5.5 | 40 (38–41) | $0.88 ($0.83–0.91) | 1.00× |
| Guren, shipped harness (cli 2.27) | Opus 5.5 | 40 (38–45) | $1.32 ($1.31–1.55) | 1.49× |

Medians of three runs; a range is the lowest and highest run, not an interval. Cost is API-equivalent, as the CLI reports it.

- cli 2.28: the next release of the harness, with a fix to how rules load, API token and rate limit sections in the digest, and a plan-writing skill. 1.26× at the median, 1.32× at the mean.
- Sonnet 5 → 5.5: the Sonnet rows were first run on Sonnet 5, then again when Sonnet 5.5 came out. Ratios moved little (shipped 1.44 → 1.40, no harness 1.68 → 1.54, cli 2.28 1.28 → 1.26).

What the table says:

- Guren costs more than Hono in about the same number of turns (38 against 40 on Sonnet, 40 each on Opus). For Sonnet the difference is context carried per turn (below); the Opus cells were not broken down.
- Against no harness, the shipped harness saves 25% of turns and 8–9% of cost, with overlapping ranges.
- The current app is no cheaper than the July app (38 turns / $0.57 against 33 / $0.57), so this round claims no improvement over time.
- Every arm, Hono included, fell from July's dollars ($3.35 Guren, $2.03 Hono) to under a dollar when Sonnet 5 ran on the isolated runner. The July app fell too, so Guren's releases are not the cause. The runner's isolation is the likely one, but nothing here proves it.

### Where the gap goes

Each tool action in the Sonnet 5.5 cells was classified by heuristic and charged the tokens it cost (its output, its result re-read on later calls, and a share of the shared prefix). The buckets add up to each cell's cost within a cent. It is an attribution model, not a direct measurement.

- Name confusion: looking for which of `@guren/core` and `@guren/server` holds a symbol, the part merging the two packages would remove.
- API learning: reading `node_modules/@guren/*`, guidance or generated types, plus guidance loaded at session start.
- Implementation: the app's own files, edits, codegen, tests, and commands the runner refused.
- Other: rule text attached mid-session, assistant text and rounding.

The table splits how much more Guren cost than Hono per run, on average, by kind of work. A negative value means Guren spent less than Hono on it.

| arm | gap to Hono | name confusion | API learning | implementation | other |
|---|---|---|---|---|---|
| Guren shipped | $0.167 | $0.000 | $0.179 | −$0.012 | $0.001 |
| Guren bare | $0.220 | $0.012 | $0.097 | $0.093 | $0.017 |
| Guren shipped (cli 2.28) | $0.135 | $0.000 | $0.074 | $0.028 | $0.033 |

- Shipped: the whole gap is guidance paid up front, 25.5k tokens re-read on 15–18 calls ($0.17–0.19 per cell). The agent reads nothing from `node_modules`, and its implementation costs slightly less than Hono's.
- No harness: two of three cells hunt for `paginate()` across `@guren/core` and `@guren/server`. No cell with a harness does.
- cli 2.28: starts from 7.1k tokens and has the smallest gap.

## Part B: nine product tickets

Round 1's 20 atomic tasks saturated for Sonnet and Opus (58–60 of 60 either way). Stage 2 makes the tasks bigger, as Rails did: each ticket reads like a product owner's request (what and why, never which API) and touches at least three subsystems of a fresh `create-guren-app` blog.

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

- Pass rule and authoring are as in round 1 (84 hidden tests across the nine tickets). New this round: an unauthorized delete that succeeds fails the cell, and a ticket was admitted only if its hidden tests also fail on three broken references.
- Statements pin table names, routes, status codes and prop keys so the tests are stable.
- Matrix: 9 tickets × {Sonnet 5.5, Opus 5.5, Haiku 4.5, Fable 5.1} × {bare, shipped} × 3 trials, plus a Sonnet plan condition on three tickets: 225 cells, $477.84 API-equivalent.

| model | pass, bare | pass, shipped | median turns | median cost | Δ median cost | Δ mean cost |
|---|---|---|---|---|---|---|
| Sonnet 5.5 | 26/27 (96%) | 27/27 | 37 → 29 (−22%) | $0.57 → $0.61 | +7% | +1% |
| Opus 5.5 | 27/27 | 27/27 | 59 → 43 (−27%) | $1.51 → $1.29 | −14% | −11% |
| Haiku 4.5 | 8/27 (30%) | 12/27 (44%) | 90 → 80 (−11%) | $0.79 → $0.89 | +13% | +10% |
| Fable 5.1 | 27/27 | 27/27 | 99 → 78 (−21%) | $6.27 → $5.42 | −13% | −16% |

- Turns drop with the harness for every model.
- Cost follows for Opus and Fable. Sonnet's rises slightly (+7% median, +1% mean); its sessions are short, so guidance loaded at start may weigh more (a hypothesis: Part B was not broken down by token). Haiku's rises in fewer turns, so each turn carries more; its failing cells cost more than its passing ones.
- Pass rate moves for Haiku (30% → 44%) and by one Sonnet cell (newsletter-module, 2/3 → 3/3).

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

- Sonnet's one failure is a mass-assignment defect: `update({ id }, { confirmedAt })` on a model whose `fillable` excludes `confirmedAt`, so the confirmation link answers 500. The agent's own tests passed, but the hidden grading tests failed. The shipped guidance covers `fillable` in three places, but one failure in three is no evidence the harness prevents it.
- Haiku fails locale-switch, newsletter-module, posts-agent-tool and cover-attachment in every cell.
- posts-agent-tool, the closest ticket to DHH's CLI claim (two routes exposed as agent tools over MCP): Sonnet, Opus and Fable pass every cell, Haiku none.
- Saturation: as in Rails' Stage 1, the top models pass everything (Opus and Fable 100%, Sonnet 96–100%). Here the harness shows up in effort, not pass rate. Rails' 35% is not comparable: another runner, a larger app, and our tickets pin their contract.

### Did agents use the framework?

For each passing run, we checked whether the agent used the framework feature the ticket calls for (attachments, rate limiting and so on) or wrote the same thing by hand. Rails calls the latter reinventing the wheel.

| model | condition | passing | used the feature | both | hand-rolled |
|---|---|---|---|---|---|
| Sonnet 5.5 | bare | 26 | 13 | 10 | 3 |
| Sonnet 5.5 | shipped | 27 | 15 | 9 | 3 |
| Opus 5.5 | bare | 27 | 22 | 5 | 0 |
| Opus 5.5 | shipped | 27 | 20 | 7 | 0 |
| Haiku 4.5 | bare | 8 | 4 | 4 | 0 |
| Haiku 4.5 | shipped | 12 | 4 | 8 | 0 |
| Fable 5.1 | bare | 27 | 19 | 8 | 0 |
| Fable 5.1 | shipped | 27 | 21 | 6 | 0 |

- Hand-rolled patches are rare: all six are Sonnet's cover-attachment, writing files by hand instead of using attachments.
- The harness barely moves this (used the feature: 22 → 20 for Opus, 19 → 21 for Fable, 13 → 15 for Sonnet).
- It is a coarse scan: one hand-rolled-looking line makes a patch "both", and some fire on code the ticket asks for (`new Response(null, { status: 204 })` on endpoints pinned as 204; a required `Retry-After` header set inside the framework rate limiter's callback).

## Plans: the loop the agents did not run

Guren's implementation plans are a factory in DHH's sense: a human approves a plan, the agent implements it step by step, and `plan:next`, `plan:verify` and a Stop hook check each step. Three tickets (post-tags, comments-moderation, scheduled-publish) got an approved plan; the plan condition adds the plan files and one line, "implement the plan". Sonnet 5.5, N=3.

| cell | `plan:next` calls | `plan:verify` calls | commits | turns |
|---|---|---|---|---|
| post-tags 1 / 2 / 3 | 1 / 1 / 3 | 0 / 0 / 1 | 0 / 0 / 0 | 39 / 57 / 40 |
| comments-moderation 1 / 2 / 3 | 1 / 0 / 1 | 0 / 0 / 0 | 0 / 0 / 0 | 28 / 31 / 42 |
| scheduled-publish 1 / 2 / 3 | 0 / 1 / 0 | 0 / 1 / 0 | 0 / 0 / 0 | 37 / 27 / 28 |

- Both conditions passed 9 of 9. The plan cells took more effort: 37 turns and $0.70 median, against 27 and $0.55 for the same tickets without a plan.
- The designed loop (one step, one verification, one commit) ran in no cell. None committed, three never called `plan:next`, and the rest read the plan and implemented it in one pass.
- The loop lets that happen: the Stop hook judges only the step `plan:next` marked, and the first step passes trivially. Plans need the hook to block while unverified steps remain, or a skill that drives the loop.

## Caveats

- One runner: headless Claude Code with project settings only. Rails' numbers are on another scale.
- N=3: 27 runs per model and condition in Part B (9 for plans), three per arm in Part A. Ranges overlap; directions fit the proposed mechanisms but do not establish an effect.
- Self-authored tickets that pin their contract, which makes them easier than open tickets.
- Part A and Part B differ in small runner settings, so their absolute costs are not comparable.
- Hooks fired: unlike round 1, the session-start, after-edit and Stop hooks ran in every shipped cell. The Stop hook (`guren gate`) blocked three Sonnet stops and one Haiku stop.
- Opus 5.5 is not Opus 5, which round 1 and Rails' Stage 2 used.
- Saturation: on these tickets the top models pass everything; telling them apart needs harder tickets.

## Summary

- The top models (Opus 5.5, Fable 5.1, and Sonnet 5.5 with the harness) passed all nine feature tickets, which span authorization, API tokens, localization, modules, MCP tools and file attachments.
- Almost every passing patch used features Guren already has. Only six wrote the feature by hand.
- The harness cut Opus's and Fable's turns by 21–27%.
- The ticket that exposes app routes to agents as MCP tools passed in every run of the top three models.
- Adding a feature to a finished app costs 1.26× the hand-wired Hono stack with the released harness, in the same number of turns. The difference is guidance loaded at session start. Building the app itself takes about a third fewer handwritten lines on Guren.
- Given an approved plan, no agent went step by step. That loop is still to fix.
- The round turned up 22 findings about Guren; ten are fixed and released.

To try it, scaffold an app with the agent harness included, and see [guren.dev](https://guren.dev) for the docs and a course on building an app with an agent:

```bash
bunx create-guren-app my-app --agents claude
```

Everything is public: the Stage 2 corpus (statements, hidden tests, reference solutions, plans), the harness, and per-cell patches and verdicts are in [agents-on-guren](https://github.com/gurenjs/agents-on-guren), with the event streams on its [v2026.09.30 release](https://github.com/gurenjs/agents-on-guren/releases/tag/v2026.09.30). Part A's runner, logs and token accounting are in [framework-comparison](https://github.com/gurenjs/framework-comparison) under `agent-eval/`, with streams on [its release](https://github.com/gurenjs/framework-comparison/releases/tag/v2026.09.30).
