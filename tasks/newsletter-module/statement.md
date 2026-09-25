# Product request: newsletter sign-up as a reusable module

**Requested by:** marketing
**Priority:** medium, needed before the autumn campaign

## Why

Marketing wants readers to be able to sign up for a newsletter. The same
sign-up will ship with the next product we build, so it must not be tangled
into the blog: it should live in its own self-contained folder that we can
lift into another app as is. The blog's code should not even know it exists,
and we want the project's own tooling to stop anyone from quietly making the
blog depend on it later.

## What we want

- **Subscribe.** A visitor (signed in or not) submits an email address. We
  store it as a pending subscription with a random, unguessable confirmation
  token, and send the visitor back to the page they came from.
- **Confirm.** Following the confirmation link marks the subscription as
  confirmed and takes the visitor to the home page. Sending the confirmation
  email is the next ticket; for now the token only needs to be stored.
- **Unsubscribe.** A visitor submits their email address and the subscription
  is deleted, then they are sent back to the page they came from.
- **Kept apart from the blog.** Everything newsletter-specific (its routes,
  request handling, validation, data model and table definition) lives under
  `modules/newsletter/`, and the application loads it as a module. The table
  gets a migration that the project's usual migrate command applies. Nothing
  under `app/` or `routes/` imports anything from `modules/newsletter/`, and
  an architecture rule in the project makes the project's checks fail if any
  file under `app/` or `routes/` ever does.

## Contract (what we will check)

Every request the acceptance run makes is a guest's, with the site's existing
cross-site request protection satisfied the way a browser would, JSON request
bodies, and a `Referer` header naming a page of this site.

- **Storage:** a table named `newsletter_subscriptions` with columns `id`,
  `email` (unique), `token` (unique, at least 16 characters), `confirmed_at`
  (null until confirmed) and `created_at`. Its definition lives in
  `modules/newsletter/db/schema.ts`, not in the root `db/schema.ts`.
- **`POST /newsletter/subscribe`** with `{ email }`: creates one row with a
  null `confirmed_at` and redirects (302 or 303) to the `Referer` page or to
  `/`. An invalid email address (for example an empty one, or `not-an-email`)
  or one that is already subscribed fails the way invalid input fails
  elsewhere on the site (a 422 with the error listed under `email`) and
  leaves the table as it was.
- **`GET /newsletter/confirm/:token`**: sets `confirmed_at` on that row and
  redirects (302 or 303) to `/`. A token we never issued answers **404** and
  changes nothing.
- **`POST /newsletter/unsubscribe`** with `{ email }`: deletes that row and
  redirects (302 or 303) to the `Referer` page or to `/`. Other rows stay.
- **Layout:** `modules/newsletter/index.ts`, a routes file under
  `modules/newsletter/` and `modules/newsletter/db/schema.ts` exist, and
  `src/app.ts` registers the module with the application.
- **Boundary:** no file under `app/` or `routes/` imports from
  `modules/newsletter/`. We will also add a file under `app/` that imports
  `modules/newsletter/index.ts`, and one under `routes/` that imports
  `modules/newsletter/db/schema.ts`, and expect `bunx guren check --arch` to
  report each of them as a failure.
- **Integrity:** `bunx guren check` and `bunx guren check --arch` both report
  no failures (warnings are fine).

The acceptance run reads the table directly. It does not check any message
shown to the visitor, how addresses are capitalised, or what unsubscribing
an address we do not have does.

## Out of scope

The sign-up form on the site's pages, sending the confirmation email, and
any admin view of subscribers.
