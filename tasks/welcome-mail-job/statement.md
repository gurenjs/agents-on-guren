# Product request: welcome email after sign-up (without slowing sign-up down)

**Requested by:** product / growth
**Priority:** high — first release of onboarding mail

## What we want

Right now a new user registers, lands on the dashboard, and never hears from
us. Send every newly registered account a welcome email.

- **Recipient:** the address the user registered with.
- **Subject:** exactly `Welcome to <app name>, <name>!` — e.g.
  `Welcome to Guren, Ada Lovelace!`. The app name is whatever `APP_NAME` in
  `.env` says (currently `Guren`); do not hard-code it. `<name>` is the name
  the user typed into the registration form.
- **Body:** a short plain-text greeting that addresses the user by name
  (HTML is welcome too, but plain text alone is fine).
- **Sender:** the address configured by `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME`
  in `.env`.

## The important part: registration must not wait for the mail

Our mail provider has been slow and occasionally down. Sending the message
inside the registration request would make sign-up hang or fail with it, and
we won't accept that. The request must **hand the sending off to the app's
background job queue** and return as it does today; the actual delivery
happens when that queued work runs — after the response, in a worker.

`.env` already carries the two settings this depends on:

- `QUEUE_CONNECTION=sync` — in development, queued work runs immediately in
  the same process, so you'll see the effect right away with nothing else
  running. Production will point this at Redis and run a separate worker
  process; the code must not care which.
- `MAIL_MAILER=log` — in development the message is written to the server
  output instead of being delivered (you should see the To / Subject / body
  in the terminal after registering). Production will switch this to a real
  provider. Again, no code change for that.

Neither setting is wired up in the app yet — registration is the first thing
that needs a queue or a mailer, so bring both up in whatever way this project
structures such things.

## Boundaries

- A registration that is **refused** (validation error, email already taken)
  must queue nothing and send nothing.
- Registration itself is otherwise unchanged: same validation, the user is
  created and signed in, and the response redirects to `/dashboard` as
  before.
- No other page, route or flow changes.

## How this will be checked

The acceptance run drives the app in-process with the app's queue pointed at a
holding queue (work is recorded, not run) and its mailer at a recording
transport, the way this project's tests can. It registers a user and expects:
the redirect to `/dashboard` as today; **no** message delivered yet; **exactly
one** unit of background work waiting. It then runs the waiting work the way a
worker would and expects **exactly one** message — addressed to the new user,
with the subject and greeting above, from the configured sender. A refused
registration must leave nothing waiting and nothing sent.
