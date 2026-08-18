# Product request: readable post URLs (slugs)

**Requested by:** marketing / SEO
**Priority:** high — blocks the next content push

## What we want

Post pages are currently addressed by their database id (`/posts/42`).
Search engines and readers should see the title in the URL instead:
`/posts/hello-world`.

### The slug

- Every post gets a **slug**, generated from its title when the post is
  created: lowercase, ASCII letters and digits only, words joined by a single
  `-`, no leading/trailing `-`. `"Hello, World!"` → `hello-world`;
  `"  Guren  &  Bun: 2026 Edition!  "` → `guren-bun-2026-edition`.
- Slugs are **unique**. A second post titled "Hello, World!" gets
  `hello-world-2`, a third `hello-world-3`, and so on (the next free number).
- Slugs are **stable**: editing a post's title later does **not** change its
  slug. The post keeps the address it was created with, and the slug the new
  title would have produced is not assigned to it.
- Posts that already exist (including the sample posts) need a slug too — any
  unique, well-formed value is acceptable for them.

### The URLs

- The post page is served at `GET /posts/<slug>` (200 for an existing slug,
  404 for an unknown one).
- After creating a post, the author is sent to its slug URL.
- The old numeric address `GET /posts/<id>` must keep working for links that
  are already out there: it responds with a **301 permanent redirect** to
  `/posts/<slug>` (an unknown id is still a 404).
- Every place that links to a post — the post list and the latest posts on the
  home page — links to the slug URL, and the post objects sent to those pages
  (and to the post page itself) carry the slug as a `slug` field.
- Editing, updating and deleting stay at their current id-based addresses
  (`GET /posts/<id>/edit`, `PUT /posts/<id>`, `DELETE /posts/<id>`) and must
  keep working; moving them to slugs is out of scope. After an update the
  author is sent to the post's slug URL.

## Notes

- Include the database change (schema and migration) in your change.
- Keep the existing test suite green and add tests as you see fit.
