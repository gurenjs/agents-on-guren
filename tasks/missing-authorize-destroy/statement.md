# Security report: any signed-in user can delete any post

**Reported by:** a user of the blog
**Severity:** high (data loss)

## What happens

While signed in as my own account, I sent a DELETE request for a post
that belongs to a different author (I got the id from the public post
page). The post was deleted and I was redirected to the post list.

Steps to reproduce:

1. Register two accounts, A and B. As A, create a post and note its id.
2. Sign in as B and submit `DELETE /posts/<id>` (the "Delete" button on the
   post page sends this — or any HTTP client with a valid session/CSRF token).
3. The post is gone; B is redirected to `/posts` with no error.

## Expected

Only the post's author should be able to delete it. Everyone else — signed in
or not — must be refused (a `403` for a signed-in non-author, the usual
unauthenticated handling for guests), and the post must still exist afterwards.
Editing (`PUT /posts/<id>`) already behaves this way; deleting should match.

Please fix the authorization gap. Keep the author's ability to delete their
own posts working.
