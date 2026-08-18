# Bug report: post excerpts disappeared after the last deploy

**Reported by:** a user of the blog
**Severity:** medium (content missing, no data loss)

## What happens

Since the most recent deploy, every post card on the post list shows only
the title and the author line — the one-line excerpt that used to sit under
each title is gone. Opening a post is the same: the page shows the title,
the byline and the body, but the excerpt paragraph between them is empty.

The excerpts themselves do not seem to be lost: searching from the post
list for a word that appears only in a post's excerpt still finds that
post. They just never show up where readers see them. The edit form is
affected too — its Excerpt field now comes up empty, so saving an edit
fails with "Excerpt is required." unless I retype it.

Steps to reproduce:

1. Sign in and create a post with a distinctive excerpt (say
   `Bees remember faces`).
2. Go to `/posts`. The card for the new post shows its title, but not
   `Bees remember faces` underneath.
3. Click through to `/posts/<id>`. The excerpt paragraph under the byline is
   empty; the body renders normally.
4. Click "Edit". The Excerpt field is blank.

## Expected

The list at `/posts` shows each post's excerpt under its title, the post
page at `/posts/<id>` shows the excerpt between the byline and the body, and
the edit form is pre-filled with it — exactly the text stored for that
post, as it was before the deploy.

Please restore the excerpts. Nothing else on these pages should change.
