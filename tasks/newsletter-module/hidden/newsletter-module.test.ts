import { beforeEach, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { freshApp } from './_helpers.js'
import { subscriptionRows, subscriptionsFor } from './_newsletter-db.js'

// The ticket pins the table newsletter_subscriptions (id, email, token,
// confirmed_at, created_at) and three public routes. Every visitor here is a
// guest; mutating requests carry the CSRF token a browser would.

const REFERER_PATH = '/posts'

let seq = 0
function address(): string {
  seq += 1
  return `reader${seq}-${Date.now()}@example.com`
}

/** Location may be relative or absolute; compare the path only. */
function locationPath(res: { headers: Headers }): string | null {
  const location = res.headers.get('location')
  return location === null ? null : new URL(location, 'http://localhost').pathname
}

/** Back to the page in Referer, or to the home page: both are allowed. */
function expectRedirectBack(res: { status: number; headers: Headers }) {
  expect([302, 303]).toContain(res.status)
  expect([REFERER_PATH, '/']).toContain(locationPath(res))
}

async function visitor(http: TestApp): Promise<TestApp> {
  const guest = await http.withCsrf()
  return guest.withHeaders({ Referer: `http://localhost${REFERER_PATH}` })
}

async function subscribe(client: TestApp, email: string) {
  return await client.post('/newsletter/subscribe', { email })
}

async function expectValidationFailure(res: { status: number; json: () => Promise<unknown> }) {
  expect(res.status).toBe(422)
  const body = (await res.json()) as { errors?: Record<string, unknown> }
  expect(Object.keys(body.errors ?? {}).some((key) => key.startsWith('email'))).toBe(true)
}

describe('newsletter subscriptions', () => {
  let http: TestApp

  beforeEach(async () => {
    http = await freshApp()
  })

  it('subscribing stores a pending row with an unguessable token and sends the visitor back', async () => {
    const client = await visitor(http)
    const email = address()

    const res = await subscribe(client, email)
    expectRedirectBack(res)

    const rows = await subscriptionsFor(email)
    expect(rows).toHaveLength(1)
    const [row] = rows
    expect(row.confirmed_at).toBeNull()
    expect(typeof row.token).toBe('string')
    expect((row.token ?? '').length).toBeGreaterThanOrEqual(16)
    expect(row.created_at).not.toBeNull()

    const other = address()
    expectRedirectBack(await subscribe(client, other))
    const [otherRow] = await subscriptionsFor(other)
    expect(otherRow.token).not.toBe(row.token)
  })

  it('confirming with the token sets confirmed_at and redirects to the home page', async () => {
    const client = await visitor(http)
    const email = address()
    const pendingEmail = address()
    expectRedirectBack(await subscribe(client, email))
    expectRedirectBack(await subscribe(client, pendingEmail))
    const [row] = await subscriptionsFor(email)

    const res = await http.get(`/newsletter/confirm/${encodeURIComponent(row.token ?? '')}`)
    expect([302, 303]).toContain(res.status)
    expect(locationPath(res)).toBe('/')

    const [confirmed] = await subscriptionsFor(email)
    expect(confirmed.confirmed_at).not.toBeNull()
    expect(String(confirmed.confirmed_at).length).toBeGreaterThan(0)
    const [stillPending] = await subscriptionsFor(pendingEmail)
    expect(stillPending.confirmed_at).toBeNull()
  })

  it('an unknown confirmation token answers 404 and confirms nothing', async () => {
    const client = await visitor(http)
    const email = address()
    expectRedirectBack(await subscribe(client, email))

    const res = await http.get('/newsletter/confirm/this-token-was-never-issued-0123456789')
    expect(res.status).toBe(404)

    const [row] = await subscriptionsFor(email)
    expect(row.confirmed_at).toBeNull()
  })

  it('an invalid email address fails validation and stores nothing', async () => {
    const client = await visitor(http)

    await expectValidationFailure(await subscribe(client, 'not-an-email'))
    await expectValidationFailure(await subscribe(client, ''))

    expect(await subscriptionRows()).toHaveLength(0)
  })

  it('subscribing an address twice fails validation and keeps the first subscription as it was', async () => {
    const client = await visitor(http)
    const email = address()
    expectRedirectBack(await subscribe(client, email))
    const [first] = await subscriptionsFor(email)

    await expectValidationFailure(await subscribe(client, email))

    const rows = await subscriptionsFor(email)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(first.id)
    expect(rows[0].token).toBe(first.token)
  })

  it('unsubscribing removes the row and sends the visitor back', async () => {
    const client = await visitor(http)
    const leaving = address()
    const staying = address()
    expectRedirectBack(await subscribe(client, leaving))
    expectRedirectBack(await subscribe(client, staying))

    const res = await client.post('/newsletter/unsubscribe', { email: leaving })
    expectRedirectBack(res)

    expect(await subscriptionsFor(leaving)).toHaveLength(0)
    expect(await subscriptionsFor(staying)).toHaveLength(1)
  })
})
