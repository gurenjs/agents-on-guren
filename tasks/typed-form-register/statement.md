# Engineering request: the sign-up form must be checked by the compiler against the server

**Requested by:** front-end lead
**Priority:** normal (tech debt, but it has bitten us twice)

## Background

Our forms drift from the server. The sign-up page (`/register`, page
component `resources/js/pages/auth/Register.tsx`) keeps its own private
copy of what the server accepts: the field names (`name`, `email`,
`password`, `passwordConfirmation`) are typed by hand in the page, the
error props are typed by hand in the page, and the form posts to a
hard-coded path. Nothing connects any of that to the route the server
actually registers for sign-up (`register.store`, `POST /register`) or to
the validation rules behind it. Rename a field on either side, or fat-finger
one in the page, and `bun run typecheck` stays green — the break only shows
up at runtime as a validation error nobody can explain.

The post editor's forms already meet the bar below; sign-up is the odd one
out. Start with sign-up (that is what this ticket is about); doing the same
for the login and profile forms is welcome but not required.

## What we want

After the change, all of the following must hold, and we will check them
literally:

1. **A misspelled field name fails typecheck.** If someone edits the
   front-end and writes `passwordConfirmatoin` where the form field is
   named — in the initial form values, where the field's value is set from
   the input, or where its error message is read — `bun run typecheck` must
   fail. This has to be true even if the misspelling is applied
   *consistently* everywhere under `resources/js/` (every occurrence of the
   token `passwordConfirmation` renamed): the source of truth for the field
   names must live on the server side, not in another front-end file.
2. **A wrong route name fails typecheck.** The form must target the sign-up
   route by its name (`register.store`), not by a hard-coded path, so that
   writing `register.stor` — again, anywhere under `resources/js/` — fails
   `bun run typecheck`.
3. **Behaviour does not change.** `/register` still renders the sign-up
   page; a valid submission still creates the account and redirects to the
   dashboard; an invalid submission (mismatched confirmation, blank name,
   bad email, …) still comes back as a `422` with errors keyed by the field
   the server rejected, and the page still shows each message under its
   field. The server-side validation rules themselves stay as they are.
4. `bun run typecheck` and the existing tests stay green on the unmodified
   result.

Keep the route name `register.store`, the path `/register` and the four
field names exactly as they are today — the check is meant to protect those
names, not to change them.
