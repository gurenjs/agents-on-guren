# Product request: post revisions ("undo" for authors)

**Requested by:** editorial
**Priority:** high — authors have lost work to accidental overwrites

## Why

Saving the edit form overwrites a post for good. Twice this month an author
pasted the wrong draft over a published post and had no way back. Authors
want an undo: a history of earlier versions of each post, and a one-click
restore.

## What we want

- **Every successful edit keeps the previous version.** When an author saves
  the edit form and the save goes through, the title, excerpt and body the post
  had *before* the save are kept as a revision. Creating a post keeps nothing
  (there is no earlier version). An edit that is refused (invalid input, not
  allowed) keeps nothing either.
- **Authors can see the history.** Each post gets a revisions page at
  `/posts/<id>/revisions` listing its revisions, newest first, with each
  revision's title and when it was kept. Link to it from the post page for
  the author.
- **Authors can restore any revision.** Restoring puts that revision's title,
  excerpt and body back on the post and takes the author to the post page.
  Restoring is itself an edit: the version the post had just before the
  restore is kept as a new revision, and the restored revision stays in the
  list. Nothing is ever lost.
- **History is private to the author.** Only the post's author may see or use
  its revisions. Everyone else signed in is refused; guests are sent to the
  login page, the same way editing works today.
- **Deleting a post deletes its history.**

A worked example: a post is created as "First", edited to "Second", then
edited to "Third". Its revisions list shows `Second`, then `First`. Restoring
`First` makes the post "First" again, and the list now holds three revisions
(`Third`, `Second`, `First`).

## Contract (what we will check)

- **Storage:** a table named `post_revisions` with columns `id`, `post_id`,
  `title`, `excerpt`, `body`, `created_at` (`created_at` as ISO 8601 text, like
  the other timestamps). One row per kept version, belonging to the post in
  `post_id`.
- **`GET /posts/:id/revisions`** renders a page whose props include
  `revisions: [{ id, title, createdAt }]`, newest first. `id` is the row's id
  in `post_revisions`, `createdAt` is a timestamp string. Extra keys and extra
  props are fine.
- **`POST /posts/:id/revisions/:revisionId/restore`** restores that revision
  and redirects to `/posts/:id`.
- **Authorization:** a signed-in user who is not the post's author gets
  **403** on both routes and nothing changes. A guest is redirected to
  `/login` on both routes and nothing changes.
- **Wrong post:** a `revisionId` that belongs to a different post answers
  **404** and nothing changes, even when the same author owns both posts.
- **Delete:** after `DELETE /posts/:id` succeeds, no `post_revisions` rows
  remain for that post; other posts' revisions are untouched.

The acceptance run edits posts through the existing edit endpoint, reads the
revisions table directly, and checks the page props, statuses and redirects
above. It does not check what happens when a save changes nothing, and it does
not look at the page's markup.

## Out of scope

Comparing revisions side by side, pruning old revisions, and revisions for
anything other than title, excerpt and body.
