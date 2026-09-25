# Stage 2 corpus (2026-09): feature tickets

Companion to `CORPUS.md` (round 1, 20 atomic tasks). Stage 2 mirrors Rails'
[Stage 2](https://rubyonrails.org/2026/9/9/agents-on-rails-stage-2): product
tickets that span several subsystems, written the way a product owner writes
them (what and why, not how), graded by behaviour over HTTP plus a separate
"idiom" column that never affects pass/fail.

## Baseline

`agents-on-guren-app` branch `stage2`, commit
`0fd165407851a43d7fed2c564d60be62c41fc1c2` (`create-guren-app@1.17.2
--blueprint blog --db sqlite --agents none`; @guren/cli 2.27.0, core 1.21.0,
server 2.26.0, orm 2.12.0, testing 1.14.0). Every Stage 2 `task.json` carries
`"baseline": "0fd165407851a43d7fed2c564d60be62c41fc1c2"` and
`"difficulty": "H"`. All tasks are feature tasks (`"seeded": false`).

What the baseline has: `users`, `posts` (title/excerpt/body/authorId,
timestamps); `Post`/`User` models; `PostPolicy`; `PostResource`;
`PostController` (index/show/create/store/edit/update/destroy/search, the
search is a `query` route with a `PostResource` contract); auth (register,
login, logout, profile edit); dashboard; `lang/en` with one key;
`i18n: { supported: ['en'] }`; no queue, mail, attachments, modules, API
tokens or agent routes.

## Rules that differ from round 1

- **Two-layer hidden checks.** `hidden/*.test.ts` is pass/fail and asserts
  behaviour: HTTP status, redirects, Inertia props (via `assertInertia`), DB
  state through the pinned table names below (query with drizzle `sql` on the
  table name, never through a model the agent may or may not have created).
  Security and validation are behaviour: an unauthorized delete that succeeds
  is a FAIL. The idiom layer is `task.json`'s `api_markers` /
  `handwritten_markers` (scanned by `harness/api-utilization.ts`) and is
  reported in its own column.
- **Statements pin the contract, not the design.** Table names, column
  names, routes, status codes, prop keys and the shapes of JSON are pinned so
  hidden tests have something stable. The statement never names the framework
  API, CLI command, file or class that solves it.
- **Difficulty is a design property**, not an observed pass rate: every task
  touches at least three subsystems. Calibration (Sonnet, N=1) only fixes
  ambiguous statements and false-negative hidden tests; it never selects on
  outcome.
- **Plans.** Three tasks (S1, S2, S4) also ship `tasks/<id>/plan/`, an
  approved RFC 0030 implementation plan for the `shipped+plan` condition. The
  plan directory holds exactly what gets copied into the worktree root:
  `docs/plans/<slug>/plan.json` and `docs/plans/<slug>/approvals.json`. The
  plan is written against the baseline (no seed, so approve it in the
  authoring worktree at the baseline commit with a clean tree), and it must
  survive the harness: after copying it into a fresh worktree at the baseline
  and committing, `bunx guren plan:next docs/plans/<slug>/plan.json` returns
  the first step, not a refusal. The plan describes what the reference
  solution builds, in the plan's own vocabulary (models, columns, actions,
  routes, pages, validators, policies, behaviours with `AC-` ids). Record the
  authoring cost (wall time, and the approximate tokens if a subagent wrote
  it) in `task.json` as `"plan_authoring": { "minutes": n, "notes": "..." }`.

## Per-task notes

### S1. post-tags (feat, H, plan)

The Part A task ported onto the blog baseline, so A and B share one ticket.

- **Statement:** posts can carry tags. Comma-separated "Tags" field on the
  create and edit forms; on save, unknown names are created, listed names
  associated, names removed from the field disassociated. The posts list and
  the show page show each post's tags; `GET /posts?tag=<name>` lists only
  posts carrying that tag (page resets to 1); tags link to that filtered
  list. Each tag name is 1–30 characters after trimming, at most 5 per post,
  duplicates collapse; invalid input fails the same way an invalid title does
  today. Pinned: tables `tags` (`id`, `name` unique) and `post_tags`
  (`post_id`, `tag_id`); every post object handed to the Index and Show pages
  carries `tags: string[]` (sorted as saved); the filter parameter is `tag`.
- **Hidden tests:** store with `tags: 'bun, webdev'` → show props
  `post.tags` = `['bun','webdev']`, rows in both tables; update with `tags:
  'bun'` → `webdev` disassociated, tag row may stay; `GET /posts?tag=bun`
  props list only tagged posts, another tag lists none; 6 tags → the same
  failure status the existing invalid-title case produces (check what the
  baseline does for an invalid title and assert that); a 31-character name
  fails; ` bun ,bun` collapses to one.
- **Idiom markers:** relationship on the model (`belongsToMany`/`hasMany`
  through, or `defineModel` of a join model), validator schema for the tags
  field, resource carrying `tags`, `.with(` eager load; handwritten: raw
  `db.select(` in the controller, string-split validation in the controller.
- **Plan:** models `Tag` (add) and `Post` (alter: relationship), tables,
  validator change, `PostController` store/update/index/show (alter), pages
  Index/Show/New/Edit (alter), behaviours for each hidden test.

### S2. comments-moderation (feat, H, plan)

- **Statement:** readers can comment on posts, and the community keeps it
  clean. Any signed-in user can post a comment on a post (guests are sent to
  login); the comment author *or the post author* can delete it, nobody else;
  any signed-in user can report a comment once; a comment reported by three
  or more different users disappears from the post page (kept in the
  database for review). Pinned: `POST /posts/:id/comments` with `{ body }`
  (1–2000 chars, else the existing validation failure), redirect back to the
  post; `DELETE /comments/:id` → redirect back, 403 for anyone else; `POST
  /comments/:id/report` → 204, idempotent per user; the Show page props carry
  `comments: [{ id, body, author: { id, name }, createdAt }]` oldest first,
  hidden comments excluded; tables `comments` (`id`, `post_id`, `user_id`,
  `body`, `created_at`) and `comment_reports` (`comment_id`, `user_id`,
  unique pair).
- **Hidden tests:** guest POST → redirect to /login, no row; user B
  comments on A's post → props show it with author B; B deletes own → gone;
  A (post author) deletes B's → gone; C deletes B's → 403, row stays; three
  distinct reporters → comment absent from props, row present; the same user
  reporting twice → still one row, 204; deleting a post removes its comments
  (cascade or explicit).
- **Idiom markers:** `CommentPolicy` + `this.authorize(`, a `Comment` model
  with relationships, a validator schema, a resource; handwritten: inline
  `if (comment.userId !== user.id && post.authorId !== user.id)` in the
  controller with no policy, raw `db.delete(`.
- **Plan:** models `Comment`, `CommentReport` (add), `Post`/`User`
  relationships (alter), `CommentPolicy` (add), `CommentController` (add:
  store/destroy/report), routes (add), Show page (alter), validator (add).

### S3. post-revisions (feat, H)

- **Statement:** authors want an undo. Every successful edit keeps the
  previous title, excerpt and body as a revision; the author can see the list
  and restore any of them; restoring also keeps the pre-restore state as a
  revision, so nothing is ever lost. Only the post's author may see or use
  revisions. Pinned: table `post_revisions` (`id`, `post_id`, `title`,
  `excerpt`, `body`, `created_at`); `GET /posts/:id/revisions` renders a page
  whose props carry `revisions: [{ id, title, createdAt }]` newest first
  (403 for other users, guests to login); `POST
  /posts/:id/revisions/:revisionId/restore` → redirect to `/posts/:id`; a
  revision id that belongs to another post → 404; deleting a post removes its
  revisions.
- **Hidden tests:** two updates → two rows, newest first in props; restore the
  first → post fields equal the original, three rows; other user GET → 403;
  guest → login redirect; cross-post revision id → 404; delete post → zero
  rows.
- **Idiom markers:** `PostRevision` model + `hasMany`, policy ability
  (`viewRevisions`/`restore`) or reuse of `PostPolicy.update` through
  `this.authorize(`, params validated through a schema; handwritten: raw
  `db.insert(`, ad-hoc `parseInt(c.req.param(`.

### S4. scheduled-publish (feat, H, plan)

- **Statement:** authors want to write now and publish later. A post can get
  a publish date/time; until then it exists only for its author. Everyone
  else (and guests) does not see it in the list, in search, or on its page.
  Once the time has passed it is public with no further action. Authors see
  their scheduled posts in the list with the date. Ops wants a command that
  prints what is scheduled. Pinned: nullable column `published_at` on
  `posts` (ISO 8601 text, as the other timestamps); form field `publishAt`
  (optional; an unparsable value fails like an invalid title); a scheduled
  post: `GET /posts/:id` → 404 for others and guests, 200 for the author;
  absent from `GET /posts` and `/posts/search` for others; present for the
  author with `publishedAt` in the post props; a past or absent
  `published_at` means public; `bun run console posts:scheduled` prints one
  line per scheduled post, `<id>\t<title>\t<published_at>`, soonest first,
  nothing else on stdout.
- **Hidden tests:** store with future `publishAt` → others get 404, index
  and search exclude it, author sees it with `publishedAt`; set
  `published_at` in the past directly in the DB → visible to all; invalid
  `publishAt` → validation failure; console command output (spawn `bun run
  console posts:scheduled` in the worktree with `Bun.spawn`, compare stdout
  lines; make sure the DB path the command uses is the test DB, or seed
  through the app's own migration path and document the choice).
- **Idiom markers:** a model scope (`static published()` / query scope) used
  by index, show and search; a console command class registered in
  `src/console.ts`; validator schema with a datetime/coerce; handwritten:
  visibility `if` duplicated across three actions, a `bin/` script instead of
  a console command.
- **Plan:** column (add on `posts`), `Post` (alter: scope), `PostController`
  index/show/store/update/search (alter), validator (alter), New/Edit/Index
  pages (alter), console command (add), behaviours.

### S5. json-api-tokens (feat, H)

- **Statement:** integrators want to read and write posts from scripts.
  A signed-in user creates personal API tokens from the profile page and
  revokes them; a token authenticates JSON requests; each token is limited to
  60 requests per minute. Pinned: `POST /profile/tokens` with `{ name }`
  (1–50 chars) and `Accept: application/json` → 201 `{ id, name, token }`
  where `token` is the plain text shown once; `DELETE /profile/tokens/:id` →
  204 (404 for another user's token); `GET /api/posts` with `Authorization:
  Bearer <token>` → 200 `{ data: [{ id, title, excerpt, authorId, createdAt
  }] }`; `POST /api/posts` `{ title, excerpt, body }` → 201 `{ data: {...}
  }` created as the token's user, 422 JSON on invalid input; no, invalid or
  revoked token → 401 JSON; the 61st request within a minute from one token →
  429 with `Retry-After`; table `api_tokens` stores a hash, never the plain
  text (the hidden test asserts the plain text is absent from the table).
- **Hidden tests:** the flows above, plus: a revoked token → 401; another
  user's token id → 404; rate limit per token (two tokens do not share a
  bucket).
- **Idiom markers:** `createApiToken` / `verifyApiToken` / the bearer
  middleware from the framework, `createRateLimitMiddleware` with a
  per-token key, a `JsonResource` for the API shape; handwritten: a custom
  `sha256(` + manual header parsing middleware, an in-memory `Map` counter
  written by hand.

### S6. locale-switch (feat, H)

- **Statement:** Japanese readers. Add `ja` as a supported language; a
  language switcher persists the choice; the navigation and the posts pages
  read their labels from the catalogs, so both languages show real text.
  Pinned: `POST /locale` with `{ locale }` (`en` or `ja`, else the usual
  validation failure) sets the choice for later requests and redirects back
  (`Referer`, else `/`); `Accept-Language: ja` also selects Japanese when
  nothing was chosen; the shared Inertia prop `_i18n` reports
  `locale: 'ja'` and includes the `ja` catalog; `lang/ja` mirrors every
  `lang/en` key and `bunx guren check --i18n` passes; these keys exist with
  these Japanese values and are used by the pages: `nav.home` 「ホーム」,
  `nav.posts` 「記事」, `nav.dashboard` 「ダッシュボード」, `posts.new`
  「新規投稿」, `posts.edit` 「編集」, `posts.delete` 「削除」,
  `posts.search` 「検索」, `auth.login` 「ログイン」, `auth.logout`
  「ログアウト」.
- **Hidden tests:** POST /locale ja → redirect; the next GET / carries
  `_i18n.locale === 'ja'` and the catalog value for `nav.posts`; POST with
  `fr` → validation failure and the locale unchanged; `Accept-Language: ja`
  with no choice → ja; `guren check --i18n` exit 0 (spawn in the worktree);
  static: `resources/js/pages/posts/Index.tsx` and `Show.tsx` reference the
  pinned keys (grep), no hard-coded 「記事」 in pages.
- **Idiom markers:** `useTranslation()` in pages, `this.t(` or the
  framework's locale cookie/detection settings; handwritten: a hand-rolled
  `translations[locale][key]` object in a page, a custom cookie name parsed by
  hand.

### S7. newsletter-module (feat, H)

- **Statement:** marketing wants a newsletter sign-up that the blog code does
  not have to know about, so it can be reused by the next product. Pinned:
  it lives as an application module under `modules/newsletter/` with its own
  routes, schema and migration; table `newsletter_subscriptions` (`id`,
  `email` unique, `token` unique, `confirmed_at` nullable, `created_at`);
  `POST /newsletter/subscribe` `{ email }` → redirect back with a
  confirmation pending (invalid or already-subscribed email fails like
  invalid input elsewhere); `GET /newsletter/confirm/:token` → sets
  `confirmed_at`, redirects to `/`, 404 for an unknown token; `POST
  /newsletter/unsubscribe` `{ email }` → removes the row, redirect back; the
  blog's own code (`app/`, `routes/`) imports nothing from the module, and an
  architecture rule enforces it; `bunx guren check` passes (module wiring and
  schema aggregate rules included).
- **Hidden tests:** subscribe → row with null `confirmed_at` and a token;
  confirm with that token → set; unknown → 404; duplicate → validation
  failure; unsubscribe → row gone; `guren check` and `guren check --arch`
  exit 0; static: `modules/newsletter/index.ts`, `modules/newsletter/routes`,
  `modules/newsletter/db/schema.ts` exist and `src/app.ts` registers the
  module; grep `app/` and `routes/` for `modules/newsletter` → none.
- **Idiom markers:** `defineModule(`, `guren.arch.ts` rule, the module's
  schema spread into `db/schema.ts`; handwritten: newsletter table declared
  in the root schema, routes registered from `routes/web.ts`.

### S8. posts-agent-tool (feat, H)

- **Statement:** users want their own AI assistant to search and draft posts
  on this blog through the standard agent protocol, without a chatbot in the
  UI. Pinned: two tools derived from the existing routes, `posts_search`
  (read-only; input `{ q }`, output the same shape the search endpoint
  returns) and `posts_store` (creates a post for the calling user; never
  read-only, requires authentication and the same authorization as the web
  form); an MCP endpoint at `/mcp` serving those tools to signed-in sessions
  (the dev-only endpoint does not count); `bunx guren tool:list --json` lists
  exactly these two with `readOnlyHint` true/false respectively; `bunx guren
  check` passes its agent-route rules; unauthenticated `posts_store` fails.
- **Hidden tests:** `app.agent().call('posts_search', { q })` returns the
  matching posts; `call('posts_store', {...}, { as: user })` creates a post
  with `authorId === user.id`; `call('posts_store', {...})` without a user
  fails; `tool:list --json` (spawn) has the two names and hints; `guren
  check` exit 0; static: `/mcp` is mounted (`registerMcpRoutes`/`mcpPlugin(`
  or the equivalent the guide names; grep) — see `agent-interface.md` in the
  framework docs for what the test app's `agent()` expects, and pin the tool
  names the derivation actually produces (check with `tool:list` in the
  authoring worktree; if the derived names differ from `posts_search` /
  `posts_store`, pin the derived ones in the statement instead).
- **Idiom markers:** `.agent(` on the two route definitions, `@guren/plugin-mcp`
  in `package.json` and `src/app.ts`, output schema on the search route;
  handwritten: a hand-written JSON-RPC handler, a custom `/mcp` route with
  its own tool list.

### S9. cover-attachment (feat, H, reserve)

- **Statement:** posts get a cover image. Upload on create/edit (PNG or JPEG,
  at most 2 MB, else the usual validation failure), shown on the post page,
  replaceable, removable, deleted with the post. Pinned: multipart field
  `cover`; a checkbox/field `removeCover` on edit; Show and Index props carry
  `coverUrl: string | null`; `GET <coverUrl>` → 200 with the image content
  type; the file lives outside `public/` and is served by the app; the
  storage table is `attachments`.
- **Hidden tests:** multipart store (TestApp accepts `FormData`) → `coverUrl`
  set, GET 200 `image/png`; a 3 MB file → validation failure; a `.gif` →
  failure; update with a new file → old file gone from disk; `removeCover` →
  null and file gone; delete post → file gone.
- **Idiom markers:** `Attachable(` / `hasOneAttached(` / `configureAttachments(`
  and the `attachments` table the framework's own scaffold adds;
  handwritten: `Bun.write(` into `public/uploads`, a hand-rolled
  `attachments` table with a `path` column.
- Reserve: promote if one of S1–S8 is dropped in calibration.

## Corpus-level notes

- **Mix:** 9 feat / 0 bug / 0 sec by category label, but S2, S3, S4, S5 and
  S8 each carry an authorization or authentication behaviour in the hidden
  tests, which is where round 1's sec tasks lived.
- **Subsystems per task** (design property): S1 schema+model+validator+
  controller+page+resource; S2 +policy; S3 schema+model+policy+controller+
  page; S4 schema+scope+validator+controller+page+console; S5 schema+auth+
  rate-limit+resource+validator; S6 i18n+cookie+controller+catalogs+pages;
  S7 module+schema+routes+arch+validator; S8 agent routes+MCP plugin+auth;
  S9 attachments+validator+controller+page.
- **Statement style:** a product owner's ticket (what, why, the pinned
  contract as "what we will check"), 300–600 words, never naming the
  framework API. Follow `tasks/welcome-mail-job/statement.md` for tone.
- **Authoring order:** S1, S2, S3 first (plans on S1 and S2), then S4 (plan),
  S5, S6, then S7, S8, S9. Two or three authoring worktrees at a time (disk).
- **Cut line:** if calibration shows a statement cannot be made unambiguous
  or a hidden test cannot be made behaviour-level, drop in this order: S9,
  S8, S6. Never drop on pass rate.

## As built (2026-09-25)

- All nine tasks were authored by Opus 5.5 subagents from the briefs above,
  each admitted only after `harness/validate-task.sh` passed and after the
  author broke its own reference at least three ways to show the hidden tests
  can fail. 85 hidden tests in total; plans on S1, S2 and S4 (authoring cost
  recorded in each `task.json` `plan_authoring`).
- **Calibration** (Sonnet 5, N=1, bare / shipped / shipped+plan, 21 cells,
  $16 API-equivalent): 20 pass, 1 fail. The fail (newsletter-module, bare)
  was a real defect the hidden tests caught: `update({ confirmedAt })` blocked
  by `fillable`. No statement or hidden test was changed on the outcome. Stage
  2 cells ran 19–73 turns and $0.29–1.48 on Sonnet, so the pass-rate ceiling
  Stage 1 hit is likely to return for Sonnet; the differentiating columns are
  turns, cost, idiom and the plan-loop adherence.
- **Harness changes made during calibration**, all applied uniformly to
  every condition before the production run:
  1. The `shipped+plan` prompt line ends with "Implement the plan." (the
     plan-implement skill's trigger). With the earlier line the agents read
     `docs/plans/` but never ran `plan:next`.
  2. `Bash(git:*)` is allowed, and the patch is diffed against the recorded
     start commit rather than `HEAD`, so a plan cell can commit per step
     without losing work from the scored diff.
  3. The preamble gained "Runner notes" (write files with the Write/Edit
     tools, no heredocs, no `cd` chains, `env NAME=value cmd`), and `env` and
     `python3` are allowed: 17 calibration cells logged 77 denials (50
     heredocs, 14 `cd` chains, 5 `NAME=value` prefixes), and the one failing
     cell had been unable to run its own end-to-end check because of them.
- Even with git allowed, the plan cells called `plan:next` once, read the
  plan, and implemented the rest in one go (no per-step commits). That is the
  treatment as measured; the report states adherence per cell rather than
  assuming the loop ran.
- The corpus is frozen at this point; the production matrix runs on the
  harness commit that carries these three changes.
