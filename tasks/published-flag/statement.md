# Product request: drafts

**Requested by:** the blog's editors
**Priority:** next release

## What we want

Right now every post is public the moment it is saved. Editors want to be
able to write a post over several sessions before anyone else can read it,
so we need a simple **draft / published** switch on posts.

### Behaviour

1. **New posts are drafts by default.** Saving the create form without
   touching anything new produces a draft, not a public post.
2. **The create and edit forms get a "Published" checkbox.** Ticking it on
   the create form publishes the post right away; on the edit form the
   author can publish a draft later, or take a published post back to draft.
3. **Only published posts are public.** For guests and for signed-in users
   who are not the author:
   - the post list (`/posts`, every page) shows only published posts;
   - the keyword search behind the list's search box returns only published
     posts, even when a draft's title or excerpt matches the keyword;
   - opening a draft's page (`/posts/<id>`) answers **404**, exactly as if
     the id did not exist — no hint that a draft is there.
4. **The author still has full access to their own drafts.** The author can
   open their draft's page (`/posts/<id>` returns the normal post page) and
   its edit form, and can save it. Editing/deleting other people's posts
   stays forbidden as it is today.
5. Existing data: the schema change must apply cleanly to a database that
   already has posts. Rows created by the demo seeder should be published,
   so the demo blog does not turn up empty.

Keep the scope tight: the dashboard does not need anything new, and no
other page changes are required beyond the checkbox and the visibility rules
above.

### Data contract (the frontend and our checks depend on these names)

- Every post object the pages receive (`/posts` list rows, the post page,
  the edit page, and the search results) gains a boolean field named
  **`published`**.
- The create form (`POST /posts`) and the edit form (`PUT /posts/<id>`)
  submit the checkbox as a field named **`published`** (a boolean). It is
  optional: when it is missing on create the post is a draft.

## Acceptance (what we will try)

- As guest and as a second user: a draft by user A does not appear on any
  page of `/posts`, does not come back from the search for a word only it
  contains, and `/posts/<draftId>` is a 404; A's published post is listed,
  searchable, and opens with `published: true`.
- As A: `/posts/<draftId>` opens (with `published: false` in the post
  data) and `/posts/<draftId>/edit` opens.
- Creating a post with `published: true` makes it visible to guests
  immediately; creating one without the field, or with `published: false`,
  leaves it hidden from guests but open to A.
- Saving the edit form with `published: true` publishes a draft; saving it
  with `published: false` hides a published post again.
