# Security hardening: throttle login attempts

**Requested by:** security review
**Severity:** medium (credential stuffing / brute force)

## What happens today

`POST /login` accepts an unlimited number of attempts. A script can submit
thousands of email/password guesses per minute against one account and the
app answers every one of them the same way it answers a single typo. There
is nothing slowing an attacker down.

Steps to reproduce:

1. Open `/login` and submit a wrong password for an existing account.
2. Repeat as fast as you like — 5, 20, 200 times.
3. Every submission is processed and refused with the usual "Invalid
   credentials." response; nothing ever changes.

## What we want

Throttle the login form per client:

- **Limit:** a client may submit `POST /login` **5 times per minute**.
  Every submission counts as an attempt, whether or not the credentials
  were right — a successful login does not clear the count.
- **Over the limit:** the 6th and any further submissions from that client
  within the same one-minute window are refused with **HTTP 429** and a
  **`Retry-After`** header telling the client when it may try again
  (delay in seconds or an HTTP-date, either is fine). This applies to any
  submission while throttled, including one with the correct password.
- **After the window passes**, the client may submit again.
- **"Same client" means the same client IP address.** The app is not
  behind a proxy in development, so the connection's own address is the
  right identity; do not trust forwarded-for style headers. If the address
  cannot be determined for a request, still count it (as one shared
  client) rather than letting it through unthrottled — fail closed.
- Keep the counters **in memory** — this is a single-process app; nothing
  needs to survive a restart.

## Unchanged

- A correct login within the limit works exactly as it does today
  (redirect to the dashboard, session opened).
- Wrong credentials within the limit are still refused the way they are
  today.
- Only the login submission is throttled. Rendering the login form
  (`GET /login`), registration, and every other page and endpoint must be
  unaffected — a throttled client can still load `/login`, `/posts`, or `/`.
