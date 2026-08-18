# Security report: the profile form accepts anything

**Reported by:** a user of the blog
**Severity:** medium (data integrity — accounts end up with unusable data)

## What happens

The "Profile" page (`/profile`, signed-in users) lets me save values that
should never be accepted:

1. Sign in, open `/profile`, put `not-an-email` in the Email field and save.
   The page says "Profile updated successfully." and my account's email is
   now `not-an-email`.
2. Clear the Name field entirely and save. Same success message; my name is
   now empty.
3. Send the same `PUT /profile` request from an HTTP client (with a valid
   session and CSRF token) and add fields the form does not have, e.g. an
   `id` or a `passwordHash`. The request is accepted, and the extra values
   land in my account row — I was able to change my own account's id and
   overwrite the stored password hash this way.

The registration form does not behave like this: it refuses a badly
formatted email, an empty name, and so on. The profile form used to as well.

## Expected

`PUT /profile` must apply the same rules the registration form applies to
name and email:

- **name**: required, at most 120 characters (surrounding whitespace is
  trimmed).
- **email**: required, must be a well-formed email address; stored in
  lowercase.
- **password** (optional on this form): if provided, at least 8 characters;
  an empty value means "keep the current password".

Invalid input must be rejected with a validation error that the profile
form can display next to the offending field (the form already renders
`name` / `email` / `password` errors), and nothing about the account may
change in that case. Fields that are not part of the profile form (`id`,
`passwordHash`, anything else) must be ignored — never written — while the
valid fields are still saved.

A valid update (well-formed email, non-empty name) must keep working
exactly as it does today.
