# Agents on Guren, round 2: teaching agents a framework they have never seen

*guren.dev, 2026-10-01.*

At Rails World 2026, DHH said that convention over configuration [pays off as token efficiency](https://youtu.be/vDjW_dRyKXY?t=1984). Rails can count on models knowing its conventions from training. Guren cannot: it is new, and no model has seen much of it. Every Guren app that works with an agent depends on the guidance we ship (the CLAUDE.md, rules and skills that `create-guren-app --agents claude` and `guren agent:init` install) to teach those conventions.

[The first report](https://guren.dev/blog/agents-on-guren-the-first-benchmark-report) showed that this guidance cuts an agent's work by about a quarter. This round asks two harder questions:

- What does teaching our conventions cost, compared with a stack that has none?
- On feature-size tickets, do agents actually use what we teach?

## What teaching costs

Guren is built on Hono, Drizzle and React, so the fairest baseline is those three wired together by hand. [framework-comparison](https://github.com/gurenjs/framework-comparison) has the same small blog (login, posts, comments, validation, tests) implemented both ways. We asked an agent to add tags to each: a new table and migration, React forms and display, a `?tag=` filter, validation and tests.

| setup | model | turns | cost | vs Hono |
|---|---|---|---|---|
| Hono, Drizzle, React by hand | Sonnet 5.5 | 40 | $0.41 | 1.00× |
| Guren, no guidance | Sonnet 5.5 | 51 | $0.63 | 1.54× |
| Guren, guidance in cli 2.27 (25.5k tokens) | Sonnet 5.5 | 38 | $0.57 | 1.40× |
| Guren, guidance in cli 2.28 (7.1k tokens) | Sonnet 5.5 | 38 | $0.52 | 1.26× |
| Hono, Drizzle, React by hand | Opus 5.5 | 40 | $0.88 | 1.00× |
| Guren, guidance in cli 2.27 | Opus 5.5 | 40 | $1.32 | 1.49× |

Medians of three runs; cost is API-equivalent, as Claude Code reports it.

With guidance, an agent on Guren takes as many turns as on the hand-wired stack. It still costs more, and the logs show why. With the cli 2.27 guidance, all of the difference is the guidance itself, which is re-read on every model call; the implementation work cost slightly less than on Hono.

That makes the size of what always loads the thing to optimize. In cli 2.28, rules load only when the agent touches the files they cover, and the guidance at session start fell from 25.5k to 7.1k tokens. With the cli 2.28 harness as a whole, the gap to Hono is 1.26×.

This compares adding one feature to a finished app. It leaves out what Guren takes on before that: Inertia between server and React, generated types for pages and routes, validation errors returned to forms, policies, jobs, and security defaults such as security headers and session-bound CSRF tokens. The hand-wired stack writes most of these itself or settles for a simpler version.

## Do agents use what we teach?

We wrote nine feature tickets for a fresh Guren blog, each as a product owner's request that names no API: tags, comment moderation, post revisions, scheduled publishing, personal API tokens with rate limiting, a Japanese locale, a newsletter module, posts as MCP agent tools, and cover images. Four models ran each ticket three times with and without guidance; a run passes when 84 hidden tests and typecheck pass.

| model | pass (no guidance → guidance) | turns | cost |
|---|---|---|---|
| Sonnet 5.5 | 26/27 → 27/27 | 37 → 29 (−22%) | $0.57 → $0.61 |
| Opus 5.5 | 27/27 → 27/27 | 59 → 43 (−27%) | $1.51 → $1.29 |
| Haiku 4.5 | 8/27 → 12/27 | 90 → 80 (−11%) | $0.79 → $0.89 |
| Fable 5.1 | 27/27 → 27/27 | 99 → 78 (−21%) | $6.27 → $5.42 |

- Opus 5.5, Fable 5.1 and Sonnet 5.5 with guidance passed every ticket.
- Guidance cut turns by 11–27% for every model. Cost fell where sessions are long (Opus, Fable).
- Of 181 passing runs, 175 used Guren's own features for the job (attachments, rate limiting, policies and so on). Six wrote one by hand, all of them the same file upload in Sonnet runs.

## What's next

We also gave Sonnet 5.5 approved implementation plans for three tickets. All nine runs passed, but none followed the plan step by step: agents read the plan and implemented it in one go. The Stop hook checks only the step `plan:next` handed out, so it never stopped them. We plan to make it hold while unverified steps remain.

## Update your app

To pick up the smaller guidance, upgrade the `@guren/*` packages and refresh the harness:

```bash
bunx guren agent:sync
```

New apps get it from the start:

```bash
bunx create-guren-app my-app --agents claude
```

## Caveats

- One runner (headless Claude Code) and three runs per condition: enough to see a direction, not to settle an effect.
- We wrote the tickets and pinned their specs, which makes them easier than real ones.
- The two experiments used slightly different runner settings, so their dollar figures are not comparable.

The tickets, hidden tests, harness and per-run results are in [agents-on-guren](https://github.com/gurenjs/agents-on-guren), with the full logs on its [v2026.09.30 release](https://github.com/gurenjs/agents-on-guren/releases/tag/v2026.09.30). The Guren and Hono comparison lives in [framework-comparison](https://github.com/gurenjs/framework-comparison) under `agent-eval/`.
