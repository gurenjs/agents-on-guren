# Product request: personal API tokens for scripts

**Requested by:** integrations / power users
**Priority:** high, blocking two partner integrations

## Why

Several authors publish from scripts (a cron job posting release notes, a CI
step listing recent posts) by scraping the HTML with replayed login cookies,
which breaks whenever a page changes. They want a JSON API with credentials
they create and revoke themselves, and ops wants no single script able to
hammer the site.

## What we want

- **Tokens, managed from the profile page.** A signed-in user creates named
  personal API tokens ("CI", "old laptop") and revokes their own. The profile
  page lists them by name. The token is shown once, in the response that
  creates it; after that nobody, including us, can read it back.
- **We never keep the token.** The database stores only something derived
  from it, so a leaked dump hands out no working credentials.
- **A token authenticates JSON requests as its owner** via
  `Authorization: Bearer <token>`. A revoked token stops working at once; the
  owner's other tokens keep working.
- **A small posts API:** list posts, and create posts that belong to the
  token's owner whatever the request body says.
- **60 requests per minute per token**, not per account: two tokens of one
  user each get their own 60. A script over its limit is told when to retry.

## Contract (what we will check)

Every request the acceptance run makes sends `Accept: application/json`, and
every request body is JSON.

- **Storage:** a table named `api_tokens`, one row per token. Its columns are
  your choice, but no column of any row may contain the plain-text token (or,
  if your token format has a public part before a `|`, the secret part after
  it).
- **`POST /profile/tokens`** with `{ name }`, from a signed-in session: the
  name is 1 to 50 characters; answers **201** with
  `{ "id": ..., "name": "...", "token": "..." }`, where `token` is the plain
  text to use as the bearer credential and `id` identifies the token for
  revocation. A missing, empty or over-long name answers **422** and creates
  nothing. A guest gets no token (redirected to `/login`, or 401). The token is
  random and at least 16 characters long (counting only the part after the
  `|`, if your format has one).
- **`DELETE /profile/tokens/:id`**, from a signed-in session, with the `id`
  returned at creation: answers **204** and the token stops working. The id of
  another user's token answers **404** and that token keeps working.
- **`GET /api/posts`** with a valid bearer token: **200** with
  `{ "data": [{ "id", "title", "excerpt", "authorId", "createdAt" }] }`, every
  post by every author, newest first. `createdAt` is an ISO 8601 string. Extra
  keys are fine. Paging is out of scope for this ticket.
- **`POST /api/posts`** with a valid bearer token and `{ title, excerpt, body }`:
  **201** with `{ "data": { "id", "title", "excerpt", "authorId", "createdAt" } }`,
  the post created with the token's owner as its author (an `authorId` in the
  body is ignored). Input the web form would reject (for example an empty
  title, or no body) answers **422** with a JSON body and creates nothing.
- **Unauthenticated:** a missing, malformed, unknown, tampered or revoked
  bearer token answers **401** with a JSON body, on both API routes, and
  creates nothing. (A write that carries no bearer token at all may be stopped
  earlier by the site's existing cross-site request protection with 403
  instead; that is fine.)
- **Rate limit:** the 61st request within a minute on one token answers
  **429** with a `Retry-After` header (seconds, at most 60). Another token of
  the same user is still answered normally.

The acceptance run creates tokens through `POST /profile/tokens`, calls the
API with only the bearer header (no session cookie), and reads the
`api_tokens` table directly. It does not look at the profile page's markup.
Its 61 rate-limit requests are sent back to back and finish within a few
seconds, early in a clock minute.

## Out of scope

Token scopes or permissions, expiry dates, editing or deleting posts over the
API, paging, and API documentation.
