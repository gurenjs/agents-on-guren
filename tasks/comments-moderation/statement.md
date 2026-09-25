# Product request: comments on posts, kept clean by the community

**Requested by:** product / community
**Priority:** high, first release of reader interaction

## What we want

Readers can only read today. We want them to talk back under each post, and
we want the community to keep that space clean without a moderator on call.

- **Commenting.** Any signed-in user can leave a comment on any post, their
  own included. A guest who tries is sent to the login page, exactly like a
  guest who tries to write a post today.
- **Deleting.** A comment can be deleted by the person who wrote it, or by the
  author of the post it is on. Nobody else. Deleting really removes it (no
  "deleted" placeholder, no soft delete).
- **Reporting.** Any signed-in user can report a comment as inappropriate.
  One person reporting the same comment again changes nothing.
- **Hiding.** Once three or more *different* users have reported a comment, it
  disappears from the post page for everyone, its author and the post's
  author included. We keep it in the database so someone can review it later;
  a review screen is not part of this ticket.
- **Post page.** Under the post: its comments, oldest first, each with the
  author's name and when it was written; a box to write one when signed in;
  Delete where the viewer is allowed to use it, and Report.
- When a post is deleted, its comments go with it.

## Why

Readers keep asking for a way to respond. The moderation part is not
optional: we will not ship comments one bad actor can fill with spam.

## The contract (what we will check)

Endpoints, all for signed-in users; a guest gets the same redirect to
`/login` the rest of the app gives:

- `POST /posts/:id/comments` with `{ body }`. The body must be 1 to 2000
  characters; anything else fails exactly the way an invalid post title fails
  today, and stores nothing. On success, redirect to the post (`/posts/:id`).
  The comment's author is the signed-in user.
- `DELETE /comments/:id`: the comment's author or the post's author gets a
  redirect back to the post (`/posts/:postId`) and the row is gone. Anyone
  else gets **403** and the comment stays.
- `POST /comments/:id/report`: **204** with no content, every time; a second
  report by the same user answers 204 again and still counts once.

Post page (`GET /posts/:id`, rendered with the existing `posts/Show` page):
its props gain `comments`, an array of
`{ id, body, author: { id, name }, createdAt }` (`createdAt` an ISO 8601
string), oldest first, with hidden comments left out. The existing `post`
prop is unchanged.

Storage, so the review tooling can read it:

- table `comments` with at least `id`, `post_id`, `user_id`, `body`,
  `created_at`;
- table `comment_reports` with at least `comment_id` and `user_id`, one row
  per report, and the pair (`comment_id`, `user_id`) unique.

## How this will be checked

The acceptance run drives the app in-process as a guest and as several users,
reading the post page's props and the two tables directly: a guest's comment
goes to `/login` and stores nothing; one user's comment on another's post is
stored and listed with its author, oldest first; the comment's author and the
post's author can each delete it; a third user gets 403 and the comment stays;
three different reporters hide a comment from the page but not from
`comments`; a repeated report gets 204 and leaves one row; deleting a post
leaves none of its comments. Existing behaviour must stay as it is.
