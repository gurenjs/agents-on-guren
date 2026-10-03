# Agents on Guren, round 2: is convention token-efficient when the model doesn't know it?

*guren.dev, 2026-10-01.*

In his Rails World 2026 [keynote](https://www.youtube.com/watch?v=vDjW_dRyKXY), DHH said that convention over configuration [pays off as token efficiency](https://youtu.be/vDjW_dRyKXY?t=1984).

Rails' conventions, though, are ones models have seen many times in training. Does the claim hold for conventions a model barely knows?

[Guren](https://guren.dev) is our full-stack framework for Bun: Laravel-style conventions on top of Hono, Drizzle and React. It is new enough that models know little of it, so we teach its conventions through guidance: CLAUDE.md, rules and the other files an agent reads. [The first report](https://guren.dev/blog/agents-on-guren-the-first-benchmark-report) showed that guidance changes how much work an agent does. This one asks two questions:

- What does teaching an unfamiliar convention cost?
- Do agents actually use the conventions they are taught?

## What teaching a convention costs

Guren is built on Hono, so comparing it with a Hono stack that has no conventions isolates what teaching the conventions costs.

[framework-comparison](https://github.com/gurenjs/framework-comparison) implements one small blog spec on several frameworks: login, posts, comments, validation and tests. We asked an agent to add tags to the Guren and Hono implementations: a new table and migration, React forms and display, a `?tag=` filter, validation and tests. A run passes typecheck, the app's tests and a hidden HTTP check of the filter.

The Hono implementation is Hono, Drizzle and a React SPA wired together by hand. The parts underneath are Guren's own, so the only difference is Guren's conventions.

| setup | model | turns | cost | vs Hono |
|---|---|---|---|---|
| Hono | Sonnet 5.5 | 40 | $0.41 | 1.00× |
| Guren, no guidance | Sonnet 5.5 | 51 | $0.63 | 1.54× |
| Guren, guidance (25.5k tokens) | Sonnet 5.5 | 38 | $0.57 | 1.40× |
| Guren, trimmed guidance (7.1k tokens) | Sonnet 5.5 | 38 | $0.52 | 1.26× |
| Hono | Opus 5.5 | 40 | $0.88 | 1.00× |
| Guren, guidance (25.5k tokens) | Opus 5.5 | 40 | $1.32 | 1.49× |

Medians of three runs; cost is API-equivalent, as the CLI reports it.

- Without guidance, Guren takes the most turns, partly spent finding which package exports a function.
- With guidance, Guren takes as many turns as Hono. Taught the conventions, the agent does not hesitate.
- It still costs 1.26–1.49× Hono.

Where the difference comes from, splitting each Sonnet 5.5 run's actions by kind (an attribution from the logs, not a direct measurement):

| setup | gap to Hono | reading guidance | implementation | other |
|---|---|---|---|---|
| Guren, no guidance | $0.220 | $0.109 | $0.093 | $0.017 |
| Guren, guidance (25.5k) | $0.167 | $0.179 | −$0.012 | $0.001 |
| Guren, trimmed guidance (7.1k) | $0.135 | $0.074 | $0.028 | $0.033 |

"Reading guidance" includes reading type definitions under `node_modules`. A negative value means Guren spent less than Hono.

- With guidance, the whole gap is reading guidance. The implementation itself costs slightly less than on Hono.
- Guidance is re-read on every model call: 25.5k tokens of it cost $0.17–0.19 per run.
- Trimmed to 7.1k tokens, the gap shrinks to $0.135.

This is the cost of adding one feature to a finished app. Building the app itself took 632 handwritten lines on Guren and 977 on Hono.

## Do agents use the conventions they are taught?

Nine feature tickets on a Guren blog, each written as a product owner's request that names no API. Four models, with and without guidance, three runs each. A run passes when its hidden tests (84 in all) and typecheck pass.

| ticket | what it asks for |
|---|---|
| post-tags | tags on posts, a `?tag=` filter, at most five per post |
| comments-moderation | comments; author or post author may delete; three reports hide a comment |
| post-revisions | a revision per edit, list and restore, author only |
| scheduled-publish | publish later, hidden until then, a command listing the schedule |
| json-api-tokens | personal API tokens, a bearer JSON API, 60 requests per minute per token |
| locale-switch | Japanese, a persisted language switch |
| newsletter-module | a newsletter sign-up as a separate module |
| posts-agent-tool | search and create posts as agent tools over MCP |
| cover-attachment | a cover image, PNG or JPEG up to 2 MB, replace and remove |

| model | pass (none → guidance) | turns | cost |
|---|---|---|---|
| Sonnet 5.5 | 26/27 → 27/27 | 37 → 29 (−22%) | $0.57 → $0.61 |
| Opus 5.5 | 27/27 → 27/27 | 59 → 43 (−27%) | $1.51 → $1.29 |
| Haiku 4.5 | 8/27 → 12/27 | 90 → 80 (−11%) | $0.79 → $0.89 |
| Fable 5.1 | 27/27 → 27/27 | 99 → 78 (−21%) | $6.27 → $5.42 |

- Opus, Fable and Sonnet with guidance passed every ticket, on a framework they barely know.
- Guidance cut turns by 11–27% for every model.
- Cost fell for Opus and Fable, whose sessions are long. Sonnet's barely moved and Haiku's rose.
- Only Haiku's pass rate moved (30% to 44%).

Of the 181 passing runs, only six wrote by hand something Guren already provides (attachments, rate limiting and so on). The other 175 used Guren's features.

- That held without guidance too: agents found the features on their own.
- Going by the breakdown above, what guidance saves is the search for them, which is where the turns go.

## For anyone writing a CLAUDE.md

The same pattern likely applies to teaching an agent your own project's conventions.

- Guidance is a fixed cost paid on every call. Its size is its cost, so keep what always loads small.
- Its payoff is in turns. Here, longer sessions also saw lower cost, so long tasks seem to earn the fixed cost back.
- For the top models, guidance did not change whether a ticket passed. It changed how much work it took.
- Agents found the framework's features without guidance. What guidance should carry is what saves the search.

## Caveats

- One runner: headless Claude Code.
- Three runs per condition: enough to see a direction, not to establish an effect.
- We wrote the tickets and pinned their specs, which makes them easier than real ones.
- The two experiments used slightly different runner settings, so their dollar figures are not comparable.
- This is not a measurement on Rails, so it says nothing about how much Rails' own conventions help.

## Summary

- Convention pays off as token efficiency when the model knows the convention.
- An unfamiliar convention can be taught, and agents use it: the top models passed all nine feature tickets, almost always through the framework's own features.
- Teaching costs tokens on every call. Adding a feature cost 1.26–1.49× Hono.
- The less guidance always loads, the smaller that cost.

Guren ships the features an app needs out of the box: authentication, authorization, file attachments, rate limiting, exposing routes as MCP tools and more. In this round, agents built all nine tickets with them, and the app itself takes about a third fewer handwritten lines than Hono and React wired by hand. Give it a try: scaffold an app with the agent guidance included, and see [guren.dev](https://guren.dev) for the docs and a course on building an app with an agent.

```bash
bunx create-guren-app my-app --agents claude
```

The tickets, hidden tests, harness and per-run results are in [agents-on-guren](https://github.com/gurenjs/agents-on-guren), with the full logs on its [v2026.09.30 release](https://github.com/gurenjs/agents-on-guren/releases/tag/v2026.09.30). The Guren and Hono comparison lives in [framework-comparison](https://github.com/gurenjs/framework-comparison) under `agent-eval/`.
