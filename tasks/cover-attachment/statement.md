# Product request: cover images on posts

**Requested by:** product / content
**Priority:** medium, the redesign of the posts list is waiting on it

## Why

Posts are a wall of text. Authors want to give each post a cover image that
shows at the top of the post page and next to the post in the list.

## What we want

- **Upload on create and on edit.** The new-post and edit-post forms get a
  file field for the cover image. Picking no file is fine: a post without a
  cover works exactly as posts work today.
- **PNG or JPEG, at most 2 MB.** Anything else (a GIF, a file over 2 MB) is
  refused exactly the way a post with an empty title is refused today (same
  response, the error reported on the `cover` field), and nothing is saved:
  no post is created, no file is kept, and on edit the post keeps the cover it
  had.
- **Shown on the post page and the list.** Both show the cover when the post
  has one.
- **Replaceable.** Uploading a new cover on the edit form replaces the old
  one. The old file is deleted from the server, not left behind.
- **Removable.** The edit form gets a "remove cover" checkbox. Saving with it
  ticked deletes the cover and its file. Editing a post without picking a file
  and without ticking the box leaves the cover as it is.
- **Deleted with the post.** Deleting a post deletes its cover file too.
- **Uploads stay private to the app.** The files are kept on the server's
  disk under the project's `storage/` directory, never under `public/` (which
  is served as-is to anyone), and the app itself serves them back.

## The contract (what we will check)

- **Form fields.** Creating stays `POST /posts` and editing stays
  `PUT /posts/:id`; both now also accept a `multipart/form-data` body carrying
  the usual `title`, `excerpt` and `body` plus an optional file field named
  `cover`. On edit, a field `removeCover` sent as `1` (a ticked checkbox)
  removes the cover.
- **Page data.** Every post object the posts list page (`posts/Index`, its
  `data` prop) and the post page (`posts/Show`, its `post` prop) receive
  carries `coverUrl: string | null`: a URL the browser can load the cover
  from, or `null` when the post has none.
- **Serving.** A `GET` of that `coverUrl` answers 200 with the file exactly
  as it was uploaded (no resizing or re-encoding) and its content type
  (`image/png` or `image/jpeg`). Once a cover is replaced,
  removed or deleted with its post, its old URL no longer serves it.
- **Storage.** Uploaded files live under `storage/` in the project, never
  under `public/`. The records describing stored files are kept in a table
  named `attachments`, one row per stored cover; replacing, removing or
  deleting a cover leaves no row behind for it.

## How this will be checked

The acceptance run drives the app in-process as a signed-in author, uploads
small generated PNG, JPEG and GIF images and an oversized PNG, reads the post
pages' data, fetches each `coverUrl`, looks for the uploaded bytes under
`storage/` and `public/`, and counts the rows of `attachments` and `posts`.
Everything that works today must keep working.
