import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { Post } from '../../app/Models/Post.js'
import { asUser, freshApp, makeUser } from './_helpers.js'
import { apiTokenCells, apiTokenRows } from './_api-tokens-db.js'

interface CreatedToken {
  id: string | number
  name: string
  token: string
}

interface ApiPost {
  id: number
  title: string
  excerpt: string
  authorId: number
  createdAt: string
}

// The statement promises that every call the acceptance run makes asks for JSON.
const JSON_ACCEPT = { Accept: 'application/json' }

// A fixed instant in the past, so fixture timestamps never tie with rows the
// requests under test create "now".
const BASE = Date.parse('2024-01-01T00:00:00.000Z')

function isJson(res: { headers: Headers }): boolean {
  return (res.headers.get('content-type') ?? '').includes('application/json')
}

/** Location may be relative or absolute; compare the path only. */
function locationPath(res: { headers: Headers }): string | null {
  const location = res.headers.get('location')
  return location === null ? null : new URL(location, 'http://localhost').pathname
}

async function postToken(http: TestApp, user: { id: number }, name: unknown) {
  const client = await asUser(http, user)
  return client.withHeaders(JSON_ACCEPT).post('/profile/tokens', { name })
}

async function createToken(http: TestApp, user: { id: number }, name = 'deploy script'): Promise<CreatedToken> {
  const res = await postToken(http, user, name)
  expect(res.status).toBe(201)
  expect(isJson(res)).toBe(true)
  const body = (await res.json()) as CreatedToken
  expect(typeof body.token).toBe('string')
  expect(body.token.length).toBeGreaterThanOrEqual(16)
  expect(body.id === undefined || body.id === null).toBe(false)
  return body
}

/**
 * A client carrying only the bearer header: no session cookie and no signed-in
 * user, so the token is the only thing that can authenticate the request.
 */
function bearer(http: TestApp, token: string): TestApp {
  return http.withHeaders({ ...JSON_ACCEPT, Authorization: `Bearer ${token}` })
}

async function revoke(http: TestApp, user: { id: number }, id: string | number) {
  const client = await asUser(http, user)
  return client.withHeaders(JSON_ACCEPT).delete(`/profile/tokens/${encodeURIComponent(String(id))}`)
}

// One database reset for the whole file. Rate-limit buckets outlive a reset,
// so ids a reset would hand out again (users, autoincrement token ids) could
// otherwise start a later test inside a bucket an earlier one filled.
let http: TestApp

beforeAll(async () => {
  http = await freshApp()
})

async function postCount(): Promise<number> {
  return (await Post.all()).length
}

describe('personal API tokens', () => {
  it('creates a token as JSON, shows the plain text once, and stores only a hash of it', async () => {
    const user = await makeUser()
    const before = (await apiTokenRows()).length

    const res = await postToken(http, user, 'deploy script')
    expect(res.status).toBe(201)
    expect(isJson(res)).toBe(true)
    const created = (await res.json()) as CreatedToken
    expect(created.name).toBe('deploy script')
    expect(typeof created.token).toBe('string')
    expect(created.token.length).toBeGreaterThanOrEqual(16)
    expect(created.id === undefined || created.id === null).toBe(false)

    expect((await apiTokenRows()).length).toBe(before + 1)

    // A token may carry a public selector before a `|` (the selector may be
    // stored as is); the secret after it, and the whole token, must not be.
    const secret = created.token.split('|').pop() ?? created.token
    expect(secret.length).toBeGreaterThanOrEqual(16)
    for (const cell of await apiTokenCells()) {
      expect(cell.includes(created.token)).toBe(false)
      expect(cell.includes(secret)).toBe(false)
    }

    const listed = await bearer(http, created.token).get('/api/posts')
    expect(listed.status).toBe(200)
  })

  it('refuses a token name that is missing, empty or longer than 50 characters', async () => {
    const user = await makeUser()
    const before = (await apiTokenRows()).length

    for (const name of [undefined, '', 'x'.repeat(51)]) {
      const res = await postToken(http, user, name)
      expect(res.status).toBe(422)
    }
    expect((await apiTokenRows()).length).toBe(before)

    const longest = await createToken(http, user, 'y'.repeat(50))
    expect(longest.name).toBe('y'.repeat(50))
  })

  it('does not let a guest create a token', async () => {
    const before = (await apiTokenRows()).length
    const guest = await http.withCsrf()
    const res = await guest.withHeaders(JSON_ACCEPT).post('/profile/tokens', { name: 'sneaky' })

    expect([302, 303, 401]).toContain(res.status)
    if (res.status !== 401) expect(locationPath(res)).toBe('/login')
    expect((await apiTokenRows()).length).toBe(before)
  })

  it('revokes a token with 204, after which it is refused while the owner\'s other tokens keep working', async () => {
    const user = await makeUser()
    const doomed = await createToken(http, user, 'old laptop')
    const kept = await createToken(http, user, 'ci')
    expect((await bearer(http, doomed.token).get('/api/posts')).status).toBe(200)

    const res = await revoke(http, user, doomed.id)
    expect(res.status).toBe(204)

    const refused = await bearer(http, doomed.token).get('/api/posts')
    expect(refused.status).toBe(401)
    expect(isJson(refused)).toBe(true)
    expect((await bearer(http, kept.token).get('/api/posts')).status).toBe(200)
  })

  it('answers 404 when revoking another user\'s token, and that token keeps working', async () => {
    const owner = await makeUser()
    const intruder = await makeUser()
    const token = await createToken(http, owner, 'owner token')

    const res = await revoke(http, intruder, token.id)
    expect(res.status).toBe(404)

    expect((await bearer(http, token.token).get('/api/posts')).status).toBe(200)
  })
})

describe('JSON posts API', () => {
  it('lists every author\'s posts newest first with the pinned fields', async () => {
    const alice = await makeUser({ name: 'Alice' })
    const bob = await makeUser({ name: 'Bob' })
    const seeded: Array<{ id: number; title: string; excerpt: string; authorId: number; createdAt: string }> = []
    for (let i = 1; i <= 3; i++) {
      const createdAt = new Date(BASE + i * 60_000).toISOString()
      const authorId = i === 2 ? bob.id : alice.id
      const post = await Post.forceCreate({ title: `Post ${i}`, excerpt: `Excerpt ${i}`, body: `Body ${i}`, authorId, createdAt })
      if (!post) throw new Error('forceCreate returned null')
      seeded.push({ id: post.id, title: `Post ${i}`, excerpt: `Excerpt ${i}`, authorId, createdAt })
    }
    const { token } = await createToken(http, alice)

    const res = await bearer(http, token).get('/api/posts')
    expect(res.status).toBe(200)
    expect(isJson(res)).toBe(true)
    const body = (await res.json()) as { data: ApiPost[] }
    expect(Array.isArray(body.data)).toBe(true)

    const seededIds = new Set(seeded.map((post) => post.id))
    const listed = body.data.filter((post) => seededIds.has(post.id))
    expect(listed.map((post) => post.id)).toEqual([...seeded].reverse().map((post) => post.id))

    for (const post of listed) {
      const expected = seeded.find((candidate) => candidate.id === post.id)!
      expect(post.title).toBe(expected.title)
      expect(post.excerpt).toBe(expected.excerpt)
      expect(post.authorId).toBe(expected.authorId)
      expect(typeof post.createdAt).toBe('string')
      expect(Date.parse(post.createdAt)).toBe(Date.parse(expected.createdAt))
    }
  })

  it('creates a post as the token\'s owner and answers 201 with the post', async () => {
    const owner = await makeUser()
    const other = await makeUser()
    const { token } = await createToken(http, owner)

    const res = await bearer(http, token).post('/api/posts', {
      title: 'From a script',
      excerpt: 'Posted over the API',
      body: 'Written by a cron job.',
      authorId: other.id,
    })
    expect(res.status).toBe(201)
    expect(isJson(res)).toBe(true)
    const { data } = (await res.json()) as { data: ApiPost }
    expect(typeof data.id).toBe('number')
    expect(data.title).toBe('From a script')
    expect(data.excerpt).toBe('Posted over the API')
    expect(data.authorId).toBe(owner.id)
    expect(Number.isNaN(Date.parse(data.createdAt))).toBe(false)

    const stored = await Post.find(data.id)
    expect(stored?.title).toBe('From a script')
    expect(stored?.body).toBe('Written by a cron job.')
    expect(stored?.authorId).toBe(owner.id)
  })

  it('rejects an invalid post with 422 JSON and creates nothing', async () => {
    const owner = await makeUser()
    const { token } = await createToken(http, owner)
    const before = await postCount()

    for (const payload of [
      { title: '', excerpt: 'An excerpt', body: 'A body.' },
      { title: 'No body', excerpt: 'An excerpt' },
    ]) {
      const res = await bearer(http, token).post('/api/posts', payload)
      expect(res.status).toBe(422)
      expect(isJson(res)).toBe(true)
    }
    expect(await postCount()).toBe(before)
  })

  it('answers 401 JSON to a missing, malformed, unknown or tampered token and creates nothing', async () => {
    const owner = await makeUser()
    const { token } = await createToken(http, owner)
    const before = await postCount()
    const tampered = `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`
    const payload = { title: 'Nope', excerpt: 'Nope', body: 'Nope.' }

    const bearerClients: TestApp[] = [
      bearer(http, 'not-a-real-token'),
      bearer(http, '123|0123456789abcdef0123456789abcdef'),
      bearer(http, tampered),
    ]
    for (const client of bearerClients) {
      const read = await client.get('/api/posts')
      expect(read.status).toBe(401)
      expect(isJson(read)).toBe(true)
      const write = await client.post('/api/posts', payload)
      expect(write.status).toBe(401)
      expect(isJson(write)).toBe(true)
    }

    // No bearer credential at all. A read is a 401; a write may instead be
    // stopped earlier by the app's cross-site request protection (403), which
    // the statement allows. Either way nothing is created.
    const credentialless: TestApp[] = [
      http.withHeaders(JSON_ACCEPT),
      http.withHeaders({ ...JSON_ACCEPT, Authorization: `Basic ${btoa('user:pass')}` }),
    ]
    for (const client of credentialless) {
      const read = await client.get('/api/posts')
      expect(read.status).toBe(401)
      expect(isJson(read)).toBe(true)
      const write = await client.post('/api/posts', payload)
      expect([401, 403]).toContain(write.status)
    }
    expect(await postCount()).toBe(before)
  })
})

describe('API rate limit', () => {
  // Assumes a one-minute window that the 61 requests fit inside: they take a
  // few seconds. Starting early in a wall-clock minute keeps a window aligned
  // to clock minutes from splitting the burst, so both kinds of limiter are
  // judged on the same 61 requests.
  it('allows 60 requests per minute per token, answers the 61st with 429 and Retry-After, and keeps each token\'s own budget', async () => {
    const intoMinute = Date.now() % 60_000
    if (intoMinute > 40_000) await Bun.sleep(60_000 - intoMinute + 250)

    const user = await makeUser()
    const first = await createToken(http, user, 'busy script')
    const second = await createToken(http, user, 'quiet script')

    for (let i = 1; i <= 60; i++) {
      const res = await bearer(http, first.token).get('/api/posts')
      if (res.status !== 200) throw new Error(`request ${i} of 60 answered ${res.status}`)
    }

    const limited = await bearer(http, first.token).get('/api/posts')
    expect(limited.status).toBe(429)
    const retryAfter = limited.headers.get('retry-after')
    expect(retryAfter).not.toBeNull()
    const value = (retryAfter ?? '').trim()
    if (/^\d+$/.test(value)) {
      expect(Number(value)).toBeLessThanOrEqual(60)
    } else {
      expect(Number.isNaN(Date.parse(value))).toBe(false)
    }

    // Same account, different token: its own bucket.
    const other = await bearer(http, second.token).get('/api/posts')
    expect(other.status).toBe(200)
  }, 60_000)
})
