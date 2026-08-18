# Security report: the login page can send users to another website

**Reported by:** an external security researcher
**Severity:** high (phishing vector)

## What happens

The sign-in page accepts a `redirect` parameter so that, after signing in,
you land back on the page that asked you to log in. That value is used as
the post-login destination without any check on where it points.

Steps to reproduce:

1. Open `/login?redirect=https://evil.example` and sign in with a valid
   account. After the credentials are accepted, the browser is redirected
   to `https://evil.example` — a completely different site.
2. Same with a protocol-relative value: `/login?redirect=//evil.example`
   also lands on `evil.example`.
3. Backslash variants such as `/login?redirect=/\evil.example` are treated
   by browsers as `//evil.example` and have the same effect.

Because the link starts on our own domain, an attacker can mail
`https://<our-site>/login?redirect=https://evil.example` to a user, who
signs in on the real page and is then handed to a look-alike site.

## Expected

- The "return to the page I was on" behaviour must keep working for paths
  inside the app: after signing in with `redirect=/posts/3/edit` the user
  ends up on `/posts/3/edit`.
- The app must never redirect to another origin or to a protocol-relative
  URL. Any redirect value that is not a plain same-app path (absolute URLs
  with a scheme, anything beginning with `//`, backslash variants, and the
  like) must be ignored and the user sent to the default post-login
  destination — the same place a login without any `redirect` value goes.
- Signing in itself is unaffected: a correct password still signs the user
  in (even when the redirect value was rejected), a wrong password still
  fails as it does today and does not create a session.

Please remediate the open redirect.
