# Ops request: `/health` must actually verify the database

**Requested by:** platform / operations
**Priority:** high (a bad deploy stays in rotation)

## Background

The deployment platform probes `GET /health` and keeps a deploy in the
load-balancer pool as long as the probe answers 2xx. Today the endpoint
answers `200 {"status":"ok"}` unconditionally. Last week a deploy shipped
with an unreachable database: every page 500'd, and the probe kept saying
"ok" the whole time, so traffic was never drained from it.

## What we want

`GET /health` should report the real state of the app's dependencies. For
now the only dependency we care about is **the database** — keep it to that
one check.

1. **The database check must touch the database.** A trivial round trip
   (any cheap query is fine) on every probe — not a cached flag, and not a
   static literal.
2. **HTTP status drives routing.** `200` when every check passes, `503`
   when the database check fails (the query throws, times out, or the
   connection cannot be opened). A failed check must never surface as a
   500 or as a 200.
3. **JSON body for the dashboard.** The response is JSON with:
   - a top-level `status`: `"ok"` (or `"healthy"`) when everything passes,
     `"error"` (or `"unhealthy"`) when the database check fails;
   - a `checks` breakdown that includes the database check, named `db` or
     `database`, carrying its own `status` with the same vocabulary. Either
     the object form `checks: { db: { status: "ok" } }` or the list form
     `checks: [{ name: "db", status: "ok" }]` is fine — our dashboard reads
     both. Extra fields (timestamps, durations, messages) are welcome.

The vocabulary and the object-vs-list choice are up to you; the HTTP status
codes and the presence of a per-check status for the database are not.

## Unchanged

- The endpoint stays at `GET /health`, unauthenticated, and keeps working
  under the existing host-authorization exemption.
- Nothing else on the site should change.
