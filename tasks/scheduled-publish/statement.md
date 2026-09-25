# Product request: schedule a post to publish later

**Requested by:** editorial, with a small ask from ops
**Priority:** high — the launch calendar is currently kept in a spreadsheet

## Why

Authors write ahead of time, but a post goes live the moment it is saved. Today
people keep finished drafts in a document and paste them in at the right
minute, which has already gone wrong twice (one launch post went out a day
early). Authors want to write now and publish later.

## What we want

- **An optional publish date and time on a post.** The create and edit forms
  get a "Publish at" date-and-time field. Left empty, the post is public as
  soon as it is saved, exactly as today. Editing a post can set, change or
  clear the date.
- **Until that time, the post exists only for its author.** Everyone else,
  signed in or not, must not find it: it is not in the posts list, it does not
  come up in search, and its page answers as if it did not exist.
- **Once the time has passed, the post is public with no further action.**
  Nobody has to press a button and nothing has to run at that moment.
- **Authors can see what they have scheduled.** Their own scheduled posts stay
  in the posts list for them, with the date they go live, and their page
  opens for them.
- **Ops wants a quick report.** A console command that prints what is
  scheduled, so they can check the calendar from a terminal on the server and
  pipe it into other tools.

## Contract (what we will check)

- **Storage:** a nullable column `published_at` on `posts`, holding an ISO 8601
  timestamp as text, the same way `created_at` is stored. Empty (`NULL`) or a
  time that has already passed means the post is public; a later time means
  it is scheduled.
- **Form field:** `publishAt` on the existing create (`POST /posts`) and edit
  (`PUT /posts/:id`) requests. Optional; absent or `null` means "publish now".
  The check sends ISO 8601 UTC values such as `2026-10-01T09:00:00.000Z`. A
  value that is not a date and time (for example `next tuesday`) is rejected
  exactly the way an empty title is rejected today, and nothing is saved.
- **A scheduled post's page**, `GET /posts/:id`: **404** for guests and for
  any signed-in user other than its author; **200** for the author, with
  `publishedAt` (a timestamp string for the same instant) on the `post` prop.
- **The posts list**, `GET /posts`: a scheduled post is absent from the `data`
  prop for guests and other users, and present for its author, with
  `publishedAt` on that post. Posts with no date are listed for everyone, as
  today.
- **Search**, the existing `/posts/search` request: a scheduled post is absent
  from `data` for guests and other users.
- **Time passing:** the check moves a scheduled post's `published_at` into the
  past directly in the database. From then on its page, the list and search
  show it to everyone.
- **The report:** `bun run console posts:scheduled`, run in the app root,
  prints one line per scheduled post and **nothing else on stdout**:
  `<id>\t<title>\t<published_at>` (tab-separated, `published_at` exactly as
  stored), soonest first. Posts that are public (no date, or a date in the
  past) are not listed; with nothing scheduled it prints nothing. It exits
  with 0. Anything on stderr is ignored. The check runs it against the same
  database the test suite uses, after writing the rows itself.

Extra props, extra keys on a post and extra columns are fine. The check does
not look at the page markup, at what the author sees in search, or at time
zones other than UTC.

## Out of scope

Notifying anyone when a post goes live, unpublishing a live post other than by
giving it a future date, and any schedule other than one date per post.
