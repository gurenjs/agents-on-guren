# Agents on Guren — task corpus (v1 authored & validated, 2026-08-18; draft 2026-08-14)

20 candidate atomic tasks against the benchmark app
(`agents-on-guren-app`, baseline `56f4e64`: blog blueprint, sqlite,
Post/User + auth + PostPolicy + PostResource + QUERY search).

Structure per task: **start state** (baseline, or baseline + seed patch that
introduces the defect), **statement** (what the agent reads), **hidden
tests** (run by the harness after the session; never in agent context),
**API under test** (feeds the API-utilization metric: did the solution use
the framework API or hand-roll it?).

Categories: `bug` (seeded defect, phrased as a user bug report), `sec`
(seeded vulnerability, phrased as remediation), `feat` (baseline start).
Difficulty: E(asy) / M(edium) / H(ard) — targets a Rails-like 3–15 min/run.

| # | id | Cat | Diff | One-line statement | API under test |
|---|----|-----|------|--------------------|----------------|
| 1 | route-wildcard-404 | bug | M | Archive URLs `/posts/archive/2026/08` 404 (seeded `:date*` param) | route param syntax; `guren check` flags it |
| 2 | pagination-skips-page | bug | E | Page 1 of /posts shows items 11–20 (seeded `page + 1`) | `paginate()` contract |
| 3 | resource-drops-excerpt | bug | E | Post cards lost their excerpt (seeded removal from `PostResource.toArray`) | JsonResource shaping |
| 4 | search-orwhere-leak | bug | M | Search returns drafts (seeded: published filter OR'd into keyword group) | `where(callback)` OR/AND grouping |
| 5 | put-redirect-302 | bug | M | Saving an edit re-submits as GET & loses state (seeded manual 302 on PUT) | `this.redirect()` / 303 semantics |
| 6 | unmounted-routes-file | bug | M | Every /admin route 404s (seeded `routes/admin.ts` never called by registrar) | registrar wiring; `guren check` flags it |
| 7 | mass-assignment-author | sec | M | Report: PUT /posts/:id with `authorId` transfers ownership (seeded `forceUpdate` on request data) | fillable / `update()` vs `forceUpdate` |
| 8 | missing-authorize-destroy | sec | E | Report: any signed-in user can delete anyone's post (seeded `authorize` removal) | `this.authorize()` + policy |
| 9 | raw-body-no-validation | sec | E | Report: profile update accepts any JSON, invalid emails saved (seeded raw `request.json()`) | `validateBody` + Zod |
| 10 | open-redirect-login | sec | M | Report: `/login?redirect=https://evil.example` redirects off-site after login | redirect sanitization |
| 11 | published-flag | feat | M | Add draft/published: index & search show published only; author sees own drafts | migration + fillable + query scoping |
| 12 | post-slug-binding | feat | H | Slugs: `/posts/:slug`, unique, generated from title | route model binding `bind:` + `this.model()` |
| 13 | api-posts-contract | feat | M | JSON `GET /api/posts` with typed query (page, author) and resource-typed client | RouteContractOptions + resource hint + codegen |
| 14 | rate-limit-login | feat | E | Throttle login: 5 attempts/min per IP, then 429 | rate limiting middleware |
| 15 | i18n-ja-catalog | feat | M | Japanese translations for auth pages, locale switch honors `Accept-Language` | lang/ catalogs + typed keys + `check --i18n` |
| 16 | welcome-mail-job | feat | H | Queue a welcome mail on registration (must not block the response) | queue job + mailable + testing fakes |
| 17 | dashboard-stats | feat | E | Dashboard: my post count + 5 most recent titles | model query API (`where`/`orderBy`/`limit`) |
| 18 | auto-excerpt | feat | E | Excerpt optional in the form; derive from body's first 140 chars | validator refinement + create flow |
| 19 | health-db-probe | feat | E | /health verifies DB connectivity, reports per-check status | health check API |
| 20 | typed-form-new-post | feat | H | Convert posts/New to typed form (`RouteBody`, typed `<Form>`), field errors typed | typed-forms / route manifest components |

## Per-task notes

### 1. route-wildcard-404 (bug, M)
- **Seed:** add a working "archive" feature whose route is
  `/posts/archive/:date*` — registers a single-segment param literally named
  `date*`, so every real URL 404s (the exact trap `guren check` warns about
  since #411/#413).
- **Statement:** user bug report with repro URLs. No mention of routing.
- **Hidden tests:** `GET /posts/archive/2026/08` → 200 + filtered list;
  `/posts/archive/2026` also matches; unrelated routes unaffected.
- **Signal:** shipped agents can find it instantly via `bunx guren check`;
  bare agents must debug Hono param lexing. Strong harness-delta candidate.

### 2. pagination-skips-page (bug, E)
- **Seed:** `paginate({ page: page + 1, perPage: 10 })` in `index`.
- **Hidden tests:** with 25 seeded posts: default page shows ids 25–16;
  `?page=2` shows 15–6; pagination meta consistent.

### 3. resource-drops-excerpt (bug, E)
- **Seed:** remove `excerpt` from `PostResource.toArray` (and the Data type
  regenerates without it).
- **Hidden tests:** index page props include non-empty `excerpt` per row.
- **Metric note:** watch for the handwritten fix (inlining a second query or
  patching props in the page) vs restoring the resource field.

### 4. search-orwhere-leak (bug, M)
- **Seed:** ship task 11's published flag pre-applied minimally (schema +
  filter), but with `.orWhere('published', true)` inside the keyword
  callback — drafts match any keyword. The starter's own comment block warns
  about exactly this; the seed deletes that comment.
- **Hidden tests:** QUERY /posts/search never returns unpublished posts,
  including single-keyword and multi-keyword cases.

### 5. put-redirect-302 (bug, M)
- **Seed:** replace `this.redirect()` in `update` with a manual
  `new Response(null, { status: 302, headers: { Location } })`.
- **Statement:** "after saving an edit the browser shows a method-not-allowed
  / stale page" (the Inertia PUT→302→GET repost trap).
- **Hidden tests:** PUT /posts/:id responds 303; follow-up GET renders the
  updated post.

### 6. unmounted-routes-file (bug, M)
- **Seed:** `routes/admin.ts` exporting a registrar the entry registrar never
  imports; a dashboard link points at /admin/posts.
- **Hidden tests:** `GET /admin/posts` (authed) → 200.
- **Signal:** `guren check` (routes-check) names the unmounted file — the
  looks-wired-mounts-nothing class.

### 7. mass-assignment-author (sec, M)
- **Seed:** `update()` switched to
  `Post.forceUpdate({ id }, await this.request.json())`.
- **Statement:** vulnerability report with reproduction (authorId takeover),
  explicit remediation request.
- **Hidden tests:** PUT with `authorId: 999` → post keeps original author &
  other fields update; validation still applies (bogus field rejected).
- `guren audit` flags the forceUpdate-on-request-input pattern.

### 8. missing-authorize-destroy (sec, E)
- **Seed:** delete the `authorize('delete', ...)` line from `destroy`.
- **Hidden tests:** user B DELETE on A's post → 403, post still present;
  owner can still delete.

### 9. raw-body-no-validation (sec, E)
- **Seed:** `ProfileController.update` reads `await this.request.json()`
  directly, ProfileValidator import removed.
- **Hidden tests:** invalid email → 422 with field error; valid update works;
  extra unknown field is not persisted.

### 10. open-redirect-login (sec, M)
- **Seed:** login page/controller honor `?redirect=` verbatim after
  successful login.
- **Hidden tests:** `redirect=/dashboard` works;
  `redirect=https://evil.example` and `redirect=//evil.example` land on the
  app's default; login still succeeds.
- Mirrors the #104 OAuth redirectTo sanitization lore.

### 11. published-flag (feat, M)
- **Statement:** product request: drafts. New posts default draft, author
  publishes via edit form; index/search/show hide others' drafts; dashboard
  lists own drafts.
- **Hidden tests:** visibility matrix (guest/other/author × index, show,
  search, dashboard) + migration applies cleanly to the seeded DB.
- Overlaps task 4's seed — the two never run against the same start state
  (4 seeds its own minimal flag), but keep both only if 4's seed stays tiny.

### 12. post-slug-binding (feat, H)
- **Statement:** SEO request: `/posts/my-first-post`. Unique slugs derived
  from title at create, stable across title edits, old id URLs redirect.
- **Hidden tests:** create → slug route 200; duplicate titles get suffixed
  slugs; `/posts/:id` → 301 to slug URL.
- **API under test:** route model binding (`bind:` + `this.model()`) vs
  hand-rolled `where('slug', ...)` lookup — clean utilization signal.

### 13. api-posts-contract (feat, M)
- **Statement:** an external consumer needs JSON `GET /api/posts` with
  `?page` and `?author` filters, typed in the generated API client.
- **Hidden tests:** JSON shape (resource fields, pagination meta); codegen
  runs; a compile-check fixture using `createApiClient` with the new route
  name typechecks.

### 14. rate-limit-login (feat, E)
- **Hidden tests:** 5 wrong-password attempts → 6th returns 429 with
  Retry-After; successful login within limit unaffected.
- Statement should not name the middleware — utilization signal is whether
  the agent finds `rateLimit` or hand-rolls a counter Map.

### 15. i18n-ja-catalog (feat, M)
- **Statement:** Japanese users see English on auth pages; add ja catalog and
  locale negotiation.
- **Hidden tests:** `Accept-Language: ja` login page contains the ja
  strings; `guren check --i18n` exits 0 (key parity + placeholders).

### 16. welcome-mail-job (feat, H)
- **Statement:** send a welcome email after registration without slowing the
  response.
- **Hidden tests:** registration response time-independent assertion via
  queue fake: job dispatched with the user's email; mailable renders name.
- Hardest infra task — validates the corpus against subsystems the app
  doesn't touch yet. Confirm @guren/testing queue/mail fakes cover this
  before finalizing (else demote to calibration-round experimental).

### 17. dashboard-stats (feat, E)
- **Hidden tests:** dashboard props contain `postCount` and 5 most recent own
  titles, ordered desc; other users' posts excluded.

### 18. auto-excerpt (feat, E)
- **Hidden tests:** create without excerpt → derived from body (140 chars,
  no mid-word cut per statement); explicit excerpt still wins; validator no
  longer 422s on missing excerpt.

### 19. health-db-probe (feat, E)
- **Hidden tests:** /health 200 with db check reported healthy; shape
  includes per-check status.
- Utilization: framework health-check API vs hand-rolled JSON literal.

### 20. typed-form-new-post (feat, H)
- **Statement:** forms drift from routes; adopt the typed form layer for the
  New Post page so a wrong field name fails `tsc`.
- **Hidden tests:** behavior unchanged (create flow passes); a mutation
  fixture (misspelled field) fails typecheck; correct fixture passes.
- Grading leans on tsc rather than HTTP — flag as the most
  grading-fragile candidate; calibration decides if it stays.

## Corpus-level notes

- **Mix:** 6 bug / 4 sec / 10 feat; difficulty 7E / 10M / 3H.
- **Seeds are per-task branches** off baseline `56f4e64`; feature tasks start
  at baseline. Task 4 is the only seeded task that also adds schema; keep its
  seed minimal so it stays a bug task, not a feature task.
- **Harness-delta showcases** (where `guren check`/`audit` point straight at
  the defect): 1, 6, 7, and 15 — expect the largest bare-vs-shipped gaps
  there; say so in the report rather than letting readers discover it.
- **Refusal watch:** 7–10 are remediation-phrased with explicit reports;
  any refusal gets logged and reported per the plan.
- **Cut line if 20 is too many:** drop 20 (grading fragility), 16 (fake
  coverage risk), then 3 (thinnest signal) → 17-task corpus.


## As built (2026-08-18)

All 20 tasks are authored under `tasks/<id>/` and pass `harness/validate-task.sh`
(start state green → hidden tests fail on start → reference passes typecheck +
visible + hidden). Hidden-test counts below are `it(...)` blocks (an `it.each`
counts once).

| id | cat | diff | seeded | hidden tests |
|---|---|---|---|---|
| api-posts-contract | feat | M | no | 9 |
| auto-excerpt | feat | E | no | 10 |
| dashboard-stats | feat | E | no | 4 |
| health-db-probe | feat | E | no | 3 |
| i18n-ja-catalog | feat | M | no | 15 |
| mass-assignment-author | sec | M | yes | 5 |
| missing-authorize-destroy | sec | E | yes | 3 |
| open-redirect-login | sec | M | yes | 3 (+5 via it.each) |
| pagination-skips-page | bug | E | yes | 6 |
| post-slug-binding | feat | H | no | 8 |
| published-flag | feat | M | no | 14 |
| put-redirect-302 | bug | M | yes | 3 |
| rate-limit-login | feat | E | no | 4 |
| raw-body-no-validation | sec | E | yes | 5 |
| resource-drops-excerpt | bug | E | yes | 3 |
| route-wildcard-404 | bug | M | yes | 10 |
| search-orwhere-leak | bug | M | yes | 5 |
| typed-form-register | feat | M | no | 9 |
| unmounted-routes-file | bug | M | yes | 3 |
| welcome-mail-job | feat | H | no | 3 |

Changes from the draft, with reasons:

- **#20 typed-form-new-post → `typed-form-register`.** On the baseline the
  New/Edit post pages are *already* typed (`useForm<ApiRoutes['posts.store']['body']>`
  + `route('posts.store')`), so a New-Post task could not discriminate. The
  sign-up form is the nearest untyped form (hand-declared type, literal
  `'/register'`, no `body:` contract on the route). Compile gate is
  identifier-agnostic: a whole-tree textual rename of a field / route name must
  turn `tsc` red; measured green on baseline, red on the reference. Difficulty M.
- **#4 search-orwhere-leak** keeps its own minimal `published` seed (schema +
  migration + index/show/search scoping, no UI); **#11 published-flag** starts
  from baseline and drops the dashboard leg (scope). The two never share a
  start state.
- **#12 post-slug-binding**: `bind: { slug: Post }` resolves by primary key
  only, so the reference goes through a `Post.bySlug` bindable adapter;
  hidden tests create posts over HTTP so store-path-only slug generation
  passes. Framework gap filed as a follow-up.
- **#13 api-posts-contract**: `query:` schemas do not reach the generated
  API client in `@guren/cli` 2.5.0, so the typed-surface check is done
  in-process via `app.router.definitions()` plus a name/`response:` text check
  on the generated file.
- **#19 health-db-probe** does test the 503 path (a static JSON literal would
  otherwise pass); shape accepts `ok|healthy` / `error|unhealthy` and
  object-or-list `checks` so framework and hand-rolled solutions both grade.
- **#16 welcome-mail-job**: gradable — tests swap in the framework's fake queue
  driver and observe mail at the transport level, so job/mailable naming is
  free. Baseline has no queue/mail wiring; wiring providers is part of the task.
- **#5 put-redirect-302**: baseline `redirect()` returns 303 for non-GET, so the
  seed's hand-built 302 is the bug; symptom verified in a real browser
  (PUT re-sent in a loop → `ERR_TOO_MANY_REDIRECTS`).
- Several statements name the *data contract* (prop names, JSON shape, `.env`
  keys, `lang/` location) so hidden tests can assert on it; none name the
  framework API, file, or command that solves the task.

Framework findings from authoring (real bugs/gaps, filed against gurenjs):
`QueryBuilder.paginate()` skips eager loading (`.with('author').paginate()`
returns `author: null`; the blog blueprint's own index page is affected);
route model binding cannot bind by a non-primary key; `Job.make()` throws
"Container not initialized"; the `guren context` digest does not list the
health subsystem.
