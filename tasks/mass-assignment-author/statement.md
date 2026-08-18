# Security report: editing a post lets the request change who owns it

**Reported by:** a user of the blog
**Severity:** high (account takeover of content, data integrity)

## What happens

While signed in as my own account, I edited one of my posts but added an
extra field to the request the edit form sends. The server accepted it and
the post now belongs to a different author. The other account can now edit
and delete "their" post; I cannot.

Steps to reproduce:

1. Register two accounts, A and B. Note B's user id (every post page ships
   the post's `authorId` in its props, so B's id is visible on any of B's
   posts). As A, create a post and note its id.
2. Still signed in as A, submit `PUT /posts/<id>` with the JSON body

   ```json
   { "title": "Renamed", "excerpt": "Still mine?", "body": "...", "authorId": <B's id> }
   ```

   (any HTTP client with A's session cookie and a valid CSRF token — the
   edit form itself only sends `title`, `excerpt`, `body`, but nothing stops
   a client from sending more).
3. The response is the normal redirect to the post page. Open the post: the
   author is now B. Sign in as B and the "Edit" / "Delete" buttons appear
   for B; sign in as A and they are gone.

While reproducing this I also noticed that the same request accepts other
things it should not:

- An empty title (`"title": ""`) is saved as-is and the post page shows a
  blank heading. Creating a post with an empty title is correctly refused
  with the field error "Title is required."; editing used to be refused the
  same way, but is not anymore.
- Fields that are not part of the edit form at all (I tried `createdAt`) end
  up written to the post.

## Expected

- The request body must **never** be able to change a post's author.
  Ownership is decided by who created the post, not by anything the client
  sends. Whether the extra field is silently ignored or the whole request is
  refused is your call — but afterwards the post must still belong to A.
- The edit request must apply the same field rules as creating a post:
  `title` (required, at most 255 characters), `excerpt` (required, at most
  500 characters), `body` (required). An invalid edit must be refused with a
  `422` and field errors, and must not change the post at all.
- Fields outside those three must not be written to the post.
- Ordinary edits by the author (valid `title`/`excerpt`/`body`) must keep
  working, and non-authors must still be refused (`403`) as they are today.

Please fix the edit endpoint so request input can no longer change the
author, and so the edit form's validation applies again.
