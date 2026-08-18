# Bug report: the newest posts never show up on the post list

**Reported by:** a reader of the blog
**Severity:** medium (content is unreachable)

## What happens

The post list at `/posts` is supposed to show the newest posts first, ten to
a page. Right now the first page starts at the *11th* newest post — the ten
most recent ones are nowhere on the list. Publishing a new post confirms it:
the post exists (its own page opens fine), but it never appears at `/posts`,
and no page of the list ever reaches it.

Steps to reproduce:

1. Make sure there are more than 20 posts (I have 25).
2. Open `/posts`. The first card is the 11th newest post, not the newest.
   In the pager below the list, the highlighted page is "2", not "1".
3. Click "1" in the pager — it opens `/posts?page=1` and shows the same
   11th–20th posts again. Click "2" (`/posts?page=2`) — it shows the 21st
   newest onward. "3" (`/posts?page=3`) is empty.
4. Create a new post. Its own page opens; `/posts` still starts at what is
   now the 11th newest post, and the new one is missing from every page.

## Expected

`/posts` (and `/posts?page=1`) shows the 10 newest posts, `?page=2` the next
10, and so on until every post has appeared exactly once. The pager's current
page, first/last/previous/next links, and the "from–to of total" numbers
should describe the page actually being shown (page 1 of 3, 1–10 of 25).

Please fix the list so page 1 really is page 1. Nothing else about the list
(newest first, 10 per page, search) should change.
