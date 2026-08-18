import { beforeAll, describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { TestApp } from '@guren/testing'
import { Post } from '../../app/Models/Post.js'
import app from '../../src/app.js'
import { freshApp, makeUser } from './_helpers.js'

interface ApiPost {
  id: number
  title: string
  excerpt: string
  createdAt: string
  author?: { id: number; name: string }
}

interface ApiPostsResponse {
  data: ApiPost[]
  meta: { currentPage: number; lastPage: number; perPage: number; total: number }
}

// A fixed instant well in the past, so fixture timestamps never collide with
// rows created "now" by anything else.
const BASE = Date.parse('2024-01-01T00:00:00.000Z')

/**
 * Create 12 posts alternating between two authors, each strictly newer than
 * the last. Explicit `createdAt` values keep "newest first" unambiguous
 * whether a solution orders by the timestamp or by id. Returns the ids in
 * creation order (oldest first).
 */
async function seedTwelvePosts(authorA: { id: number }, authorB: { id: number }) {
  const created: Array<{ id: number; authorId: number }> = []
  for (let i = 1; i <= 12; i++) {
    // Alternate authors, with the newest post also going to A so the two
    // authors end up with different counts (A: 7, B: 5) and A's posts are
    // never simply "the odd rows".
    const authorId = i % 2 === 1 || i === 12 ? authorA.id : authorB.id
    const post = await Post.forceCreate({
      title: `Post ${i}`,
      excerpt: `Excerpt ${i}`,
      body: `Body ${i}`,
      authorId,
      createdAt: new Date(BASE + i * 60_000).toISOString(),
    })
    if (!post) throw new Error('forceCreate returned null')
    created.push({ id: post.id, authorId })
  }
  return created
}

async function getJson(http: TestApp, url: string): Promise<{ status: number; body: ApiPostsResponse }> {
  const res = await http.withHeaders({ Accept: 'application/json' }).get(url)
  const contentType = res.headers.get('content-type') ?? ''
  expect(contentType).toContain('application/json')
  return { status: res.status, body: (await res.json()) as ApiPostsResponse }
}

describe('GET /api/posts', () => {
  let http: TestApp
  let authorA: { id: number; name: string }
  let authorB: { id: number; name: string }
  let created: Array<{ id: number; authorId: number }>

  beforeAll(async () => {
    http = await freshApp()
    authorA = await makeUser({ name: 'Alice Author' })
    authorB = await makeUser({ name: 'Bob Author' })
    created = await seedTwelvePosts(authorA, authorB)
  })

  it('returns the 10 newest posts as JSON with pagination meta, without authentication', async () => {
    const { status, body } = await getJson(http, '/api/posts')
    expect(status).toBe(200)

    const newestTen = [...created].reverse().slice(0, 10).map((p) => p.id)
    expect(body.data.map((p) => p.id)).toEqual(newestTen)

    expect(body.meta).toMatchObject({ currentPage: 1, lastPage: 2, perPage: 10, total: 12 })
  })

  it('serializes each post with the fields the pages receive, including the author', async () => {
    const { body } = await getJson(http, '/api/posts')
    const byId = new Map(created.map((p) => [p.id, p.authorId]))
    const names = new Map([[authorA.id, authorA.name], [authorB.id, authorB.name]])

    for (const post of body.data) {
      expect(typeof post.id).toBe('number')
      expect(typeof post.title).toBe('string')
      expect(post.title.length).toBeGreaterThan(0)
      expect(typeof post.excerpt).toBe('string')
      expect(post.excerpt.length).toBeGreaterThan(0)
      expect(typeof post.createdAt).toBe('string')
      expect(Number.isNaN(Date.parse(post.createdAt))).toBe(false)

      const expectedAuthorId = byId.get(post.id)
      expect(post.author).toBeDefined()
      expect(post.author?.id).toBe(expectedAuthorId)
      expect(post.author?.name).toBe(names.get(expectedAuthorId as number))
    }
  })

  it('serves the remaining posts on page 2', async () => {
    const { status, body } = await getJson(http, '/api/posts?page=2')
    expect(status).toBe(200)

    const oldestTwo = [...created].reverse().slice(10).map((p) => p.id)
    expect(body.data.map((p) => p.id)).toEqual(oldestTwo)
    expect(body.meta).toMatchObject({ currentPage: 2, lastPage: 2, perPage: 10, total: 12 })
  })

  it('filters to a single author with ?author=<id>, newest first, with meta for the filtered set', async () => {
    const { status, body } = await getJson(http, `/api/posts?author=${authorA.id}`)
    expect(status).toBe(200)

    const mine = created.filter((p) => p.authorId === authorA.id).map((p) => p.id).reverse()
    expect(mine).toHaveLength(7)
    expect(body.data.map((p) => p.id)).toEqual(mine)
    for (const post of body.data) {
      expect(post.author?.id).toBe(authorA.id)
    }
    expect(body.meta).toMatchObject({ currentPage: 1, lastPage: 1, perPage: 10, total: 7 })
  })

  it('combines the author filter with paging', async () => {
    const { status, body } = await getJson(http, `/api/posts?author=${authorB.id}&page=1`)
    expect(status).toBe(200)

    const theirs = created.filter((p) => p.authorId === authorB.id).map((p) => p.id).reverse()
    expect(theirs).toHaveLength(5)
    expect(body.data.map((p) => p.id)).toEqual(theirs)
    expect(body.meta).toMatchObject({ currentPage: 1, lastPage: 1, perPage: 10, total: 5 })
  })

  it('returns an empty page for an author with no posts', async () => {
    const nobody = await makeUser({ name: 'No Posts' })
    const { status, body } = await getJson(http, `/api/posts?author=${nobody.id}`)
    expect(status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.meta).toMatchObject({ currentPage: 1, total: 0 })
  })

  it('rejects invalid query parameters with 422', async () => {
    for (const url of ['/api/posts?page=0', '/api/posts?page=abc', '/api/posts?author=abc', '/api/posts?author=0']) {
      const res = await http.withHeaders({ Accept: 'application/json' }).get(url)
      expect(res.status).toBe(422)
    }
  })
})

describe('api.posts.index is part of the typed API surface', () => {
  beforeAll(async () => {
    await freshApp()
  })

  it('is registered under the name api.posts.index with its query contract declared on the route', () => {
    const def = app.router.definitions().find((d) => d.name === 'api.posts.index')
    expect(def).toBeDefined()
    expect(def?.method).toBe('GET')
    expect(def?.path).toBe('/api/posts')

    // The accepted query parameters are declared on the route itself (not only
    // checked inside the handler), so tooling can see them. Query values
    // arrive as strings.
    const query = def?.schemas?.query
    expect(query).toBeDefined()
    expect(query?.safeParse({}).success).toBe(true)
    expect(query?.safeParse({ page: '2', author: '3' }).success).toBe(true)
    expect(query?.safeParse({ page: '0' }).success).toBe(false)
    expect(query?.safeParse({ author: 'abc' }).success).toBe(false)
  })

  it('appears in the generated API client with a typed response', () => {
    // The harness runs `bun run codegen` before these tests, so the generated
    // artifacts reflect the solution under test.
    const clientPath = resolve(import.meta.dir, '../../.guren/api-client.gen.ts')
    const manifestPath = resolve(import.meta.dir, '../../.guren/routes.gen.ts')
    const client = existsSync(clientPath) ? readFileSync(clientPath, 'utf8') : ''
    const manifest = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : ''

    expect(client.includes("'api.posts.index'") || manifest.includes("'api.posts.index'")).toBe(true)

    // The client entry for the route carries a response type, so `json()` on
    // the returned Response is typed for callers.
    const start = client.indexOf("'api.posts.index': {")
    expect(start).toBeGreaterThan(-1)
    const end = client.indexOf('\n  }', start)
    const entry = client.slice(start, end === -1 ? undefined : end)
    expect(entry).toMatch(/\bresponse:/)
    expect(entry).toMatch(/method: 'GET'/)
    expect(entry).toMatch(/path: '\/api\/posts'/)
  })
})
