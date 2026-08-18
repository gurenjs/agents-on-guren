# Bug: unpublished posts show up in search results

**Reported by:** the blog's editor
**Severity:** high (unpublished content is exposed)

## What happens

Posts have a published flag. Posts that are *not* published are correctly
kept out of the post list (`/posts`) and their own page (`/posts/<id>`)
returns 404 — but they still come back from the search box on `/posts`.

Steps to reproduce:

1. Have one published post and one unpublished post whose titles share a
   word — say `zephyrquill` (unpublished posts are only ever created directly
   in the database; there is no UI for them yet).
2. Open `/posts` and search for `zephyrquill`.
3. Both posts are in the results, including the unpublished one. The same
   happens with two search words (`zephyrquill marmalade`): unpublished posts
   containing either word are listed.

While reproducing this I also noticed the results are padded with posts that
don't contain the search word at all, which used to not happen.

## Expected

Search results are exactly the **published** posts that contain at least one
of the search words in their title or excerpt — nothing else. An unpublished
post must never appear in search results, whatever and however many words are
searched; a word that only appears in unpublished posts returns an empty
result. The list and post pages already behave correctly and must keep doing
so.

Please fix the search so it never returns unpublished posts.
