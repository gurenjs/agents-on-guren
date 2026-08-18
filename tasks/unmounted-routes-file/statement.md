# Bug: the admin post list at `/admin/posts` is a 404 for everyone

**Reported by:** the moderation team
**Severity:** medium (a shipped feature is unreachable)

## What happens

The dashboard now has an "Admin" box that says the moderation tools read the
full post table from `/admin/posts`, and links to it. Clicking that link — or
requesting the URL with any HTTP client, signed in or not — gives a plain
`404 Not Found`. It has never worked on any environment; the moderation
script that polls it has been failing since the feature merged.

The code for the endpoint is in the repository (it landed together with the
dashboard change), so this is not a missing feature — the endpoint just isn't
being served.

Steps to reproduce:

1. Register an account and sign in.
2. Open `/dashboard`; note the "Admin" box linking to `/admin/posts`.
3. Follow the link (or `GET /admin/posts` with the session cookie): `404`.
4. Sign out and `GET /admin/posts` again: still `404` rather than being sent
   to the login page.

## Expected

- A signed-in user requesting `GET /admin/posts` gets `200` with a JSON
  document of the form `{ "data": [ ... ] }` listing **every** post in the
  database (newest first), each row carrying at least the post's `id`,
  `title`, and its `author` `{ id, name }` — exactly what the existing
  controller already builds.
- A guest requesting it is handled like every other signed-in-only page in
  the app (redirected to `/login`), not `404`.
- Nothing else changes: `/posts`, `/posts/:id`, the dashboard and the auth
  pages keep working as they do now.

Please make the endpoint reachable. The behaviour of the endpoint itself is
already implemented and should not need to change.
