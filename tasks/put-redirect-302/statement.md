# Bug report: saving an edited post never leaves the edit form

**Reported by:** a blog author
**Severity:** medium (edits are saved, but the UI looks broken every time)

## What happens

When I edit one of my posts and press **Save changes**, the button greys out
for a moment, then comes back, and I am still sitting on the edit form. No
error is shown on the page. If I open the browser console there is a failed
request to `/posts/<id>` with `net::ERR_TOO_MANY_REDIRECTS` and an
"HttpNetworkError: Network error" for the same URL.

The strange part: the edit *is* saved. If I reload, or open `/posts/<id>`
by hand, the post page shows my new title and body.

Steps to reproduce:

1. Sign in, publish a post (this works: after **Publish** I land on the new
   post's page as expected).
2. Open the post, click **Edit**, change the title, press **Save changes**.
3. The form stays on screen; the console shows the redirect error above.
4. Navigate to `/posts/<id>` manually — the new title is there.

Deleting a post also behaves normally (I end up on the post list). Only
saving an edit is affected.

## Expected

After a successful save, the browser should be sent on to the post's page
(`/posts/<id>`) as a normal page load, showing the updated content — exactly
what already happens after publishing a new post. Validation errors on the
edit form should keep working as they do now.
