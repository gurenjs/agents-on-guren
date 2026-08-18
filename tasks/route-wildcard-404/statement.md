# Bug report: the post archive URLs are broken

**Reported by:** a reader of the blog
**Severity:** medium (feature unusable)

## What happens

The blog has a JSON archive of posts by month and by year. It is documented
(and linked from a newsletter) as:

- `GET /posts/archive/<year>/<month>` — e.g. `/posts/archive/2026/08`, the
  posts created in August 2026
- `GET /posts/archive/<year>` — e.g. `/posts/archive/2026`, every post created
  in 2026

Neither works:

1. `curl -i http://localhost:3333/posts/archive/2026/08` → `404 Not Found`,
   even though there are posts from August 2026 on the site.
2. `curl -i http://localhost:3333/posts/archive/2026` → `422` with a JSON
   validation error complaining that a required value is missing — the URL is
   exactly the documented one.
3. `/posts/archive/2026/8` (no leading zero) also 404s.

Everything else on the site is fine: `/posts`, `/posts/<id>`, search, and the
sign-in pages all behave as usual.

## Expected

The archive should answer both URL shapes with `200` and a JSON body of the
form `{ "data": [ ... ] }`, where each entry is a post (at least `id` and
`title`, the same fields the other post listings return), newest first:

- `/posts/archive/2026/08` lists exactly the posts created in that month
  (`08` and `8` must both work).
- `/posts/archive/2026` lists exactly the posts created anywhere in that year.
- A period with no posts returns `{ "data": [] }`, and a month outside 1–12
  is rejected with a 4xx rather than served or crashing.
- Creation times are compared as stored (UTC).

Please fix it so the documented URLs work; the archive is the only thing that
should change.
