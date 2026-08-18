# Product request: show my posts on the dashboard

**Requested by:** product / design
**Priority:** normal

## Background

The dashboard at `/dashboard` (signed-in users only) currently shows only
"Signed in as …" with the user's email. Writers keep asking "how many posts
do I have?" and "where's the one I wrote yesterday?" — today they have to
scroll through the public post list to find their own work.

## What we want

On `/dashboard`, below the "Signed in as" panel, add two things for the
signed-in user:

1. **A post count** — a line reading `You have N posts` (singular `post`
   when N is 1 is a nice touch, not a requirement), where N is the number of
   posts written by the signed-in user. Only their own posts count.
2. **A "Recent posts" list** — the signed-in user's **5 most recently
   created** posts, **newest first**, at most 5 entries. Each entry shows the
   post's title and links to that post's page (`/posts/<id>`). Posts by other
   users must never appear here, however recent they are. If the user has
   fewer than 5 posts, list the ones they have.
3. **Empty state** — a user with no posts sees `You have 0 posts` and, in
   place of the list, a short message such as "You haven't written any posts
   yet." (a link to the new-post form is welcome).

## Data contract for the page

The dashboard page component should receive, in addition to what it gets
today:

- `postCount: number` — the signed-in user's total number of posts.
- `recentPosts: Array<{ id: number; title: string }>` — the signed-in
  user's most recently created posts, newest first, at most 5 entries
  (an empty array when they have none).

Please keep these names and shapes exactly — the design mockups and the
front-end work are built around them.

## Unchanged

- The dashboard stays signed-in only: guests are still sent to the login
  page as they are today.
- The existing "Signed in as …" panel keeps working as before.
- Nothing else on the site should change.
