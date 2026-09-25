# Product request: tags on posts

**Requested by:** product / content
**Priority:** high, first step towards topic pages

## What we want

Readers can't find posts on a topic: the list is one long feed. Let authors
tag their posts, show the tags wherever a post appears, and let a reader click
a tag to see only the posts carrying it.

- **Writing tags.** The create and edit forms get a **Tags** field: one text
  input where the author types names separated by commas, e.g.
  `bun, webdev`. The edit form starts out with the post's current tags in it.
- **Saving.** When the post is saved, a name we have never seen becomes a new
  tag, every listed name is attached to the post, and a name the author
  removed from the field is detached from the post. A tag that no post uses
  any more may stay in the database. Leaving the field out or empty means the
  post has no tags.
- **Rules for the field.** Each name is trimmed of surrounding spaces; empty
  entries (a trailing comma, `a,,b`) are ignored; names are case-sensitive,
  and a name listed twice counts once (` bun ,bun` is the one tag `bun`). After
  that, each name must be 1–30 characters and a post may have at most 5 tags.
  Input that breaks a rule is refused exactly the way a post with an empty
  title is refused today (same response, the error reported on the `tags`
  field) and nothing is saved.
- **Showing tags.** The posts list shows each post's tags, and so does the post
  page. Each tag links to the posts list filtered by that tag.
- **Filtering.** `/posts?tag=<name>` lists only the posts carrying that tag,
  newest first and paginated like the unfiltered list. A tag link always
  lands on the first page, and the page links of a filtered list keep the
  filter. A tag nobody uses gives an empty list, not an error.

Deleting a post must keep working for tagged posts. Everything else
(authorization, validation of the other fields, redirects) stays as it is.

## The contract we build on

Other work (topic pages, a tag cloud) will read this data, so please keep to
these names:

- Table `tags` with columns `id` and `name` (unique), and table `post_tags`
  with columns `post_id` and `tag_id`, one row per tag attached to a post.
- Every post object the posts list page (`posts/Index`, its `data` prop) and
  the post page (`posts/Show`, its `post` prop) receive carries
  `tags: string[]`: the names, sorted alphabetically; `[]` for a post without
  tags.
- The form field is named `tags`; the filter parameter is `tag`.

## How this will be checked

The acceptance run drives the app in-process as a signed-in author and a
guest, and reads the two tables above directly. It expects:

1. Creating a post with tags `bun, webdev` stores both names in `tags`,
   attaches both in `post_tags`, and the post page's `post.tags` is
   `["bun", "webdev"]`.
2. Editing that post with tags `bun` leaves `bun` as its only tag, in
   `post_tags` and on the post page.
3. `/posts?tag=bun` lists only the posts carrying `bun`; another tag that no
   post carries lists nothing; on the unfiltered list every post carries its
   `tags`, `[]` included.
4. Six tags are refused with the same status an empty title gets today, and
   nothing is written to `posts`, `tags` or `post_tags`.
5. A 31-character name is refused the same way; a 30-character one is saved.
6. ` bun ,bun` saves exactly one tag, `bun`, attached once.
