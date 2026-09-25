import { beforeEach, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { asUser, freshApp, makeUser } from './_helpers.js'
import { minutesFromNow, postRowByTitle, setPublishedAt } from './_scheduled-db.js'

interface PostProp {
  id: number
  title: string
  publishedAt?: string | null
}

const DAY_MINUTES = 24 * 60

let seq = 0
function payload(extra: Record<string, unknown> = {}) {
  seq += 1
  return { title: `Scheduled post ${seq}`, excerpt: 'A short excerpt', body: 'The body of the post.', ...extra }
}

/** Creates a post through the form endpoint as `client`; returns its row id. */
async function storePost(client: TestApp, data: Record<string, unknown>): Promise<number> {
  const res = await client.post('/posts', data)
  expect([302, 303]).toContain(res.status)
  const row = await postRowByTitle(String(data.title))
  expect(row).not.toBeNull()
  return row!.id
}

/** Stores a post scheduled a day ahead; returns its id and the instant it was scheduled for. */
async function storeScheduled(client: TestApp, title?: string) {
  const at = minutesFromNow(DAY_MINUTES)
  const data = payload({ publishAt: at.toISOString(), ...(title === undefined ? {} : { title }) })
  const id = await storePost(client, data)
  return { id, at, title: String(data.title) }
}

async function inertiaProps<T>(client: TestApp, path: string): Promise<T> {
  const res = await client.withHeaders({ 'X-Inertia': 'true' }).get(path)
  expect(res.status).toBe(200)
  return ((await res.json()) as { props: T }).props
}

async function indexIds(client: TestApp): Promise<number[]> {
  const props = await inertiaProps<{ data?: PostProp[] }>(client, '/posts')
  expect(Array.isArray(props.data)).toBe(true)
  return props.data!.map((post) => post.id)
}

async function searchIds(client: TestApp, keyword: string): Promise<number[]> {
  const res = await client.query('/posts/search', { keywords: [keyword] })
  expect(res.status).toBe(200)
  const body = (await res.json()) as { data?: PostProp[] }
  expect(Array.isArray(body.data)).toBe(true)
  return body.data!.map((post) => post.id)
}

function expectSameInstant(actual: string | null | undefined, expected: Date) {
  expect(typeof actual).toBe('string')
  expect(Date.parse(actual as string)).toBe(expected.getTime())
}

describe('scheduled publishing', () => {
  let http: TestApp

  beforeEach(async () => {
    http = await freshApp()
  })

  it('stores a future publishAt and shows the post page to its author only; others and guests get 404', async () => {
    const author = await makeUser()
    const other = await makeUser()
    const scheduled = await storeScheduled(await asUser(http, author))

    const row = await postRowByTitle(scheduled.title)
    expectSameInstant(row!.published_at, scheduled.at)

    const guest = await http.withCsrf()
    expect((await guest.withHeaders({ 'X-Inertia': 'true' }).get(`/posts/${scheduled.id}`)).status).toBe(404)
    const intruder = await asUser(http, other)
    expect((await intruder.withHeaders({ 'X-Inertia': 'true' }).get(`/posts/${scheduled.id}`)).status).toBe(404)

    const props = await inertiaProps<{ post?: PostProp }>(await asUser(http, author), `/posts/${scheduled.id}`)
    expect(props.post?.id).toBe(scheduled.id)
    expectSameInstant(props.post?.publishedAt, scheduled.at)
  })

  it('leaves a scheduled post out of the list for guests and other users, and lists it with its date for its author', async () => {
    const author = await makeUser()
    const other = await makeUser()
    const authorClient = await asUser(http, author)
    const scheduled = await storeScheduled(authorClient)
    // No publishAt at all: public at once, as posts are today.
    const publicId = await storePost(authorClient, payload())

    for (const viewer of [await http.withCsrf(), await asUser(http, other)]) {
      const ids = await indexIds(viewer)
      expect(ids).toContain(publicId)
      expect(ids).not.toContain(scheduled.id)
    }

    const props = await inertiaProps<{ data?: PostProp[] }>(await asUser(http, author), '/posts')
    const own = props.data?.find((post) => post.id === scheduled.id)
    expect(own).toBeDefined()
    expectSameInstant(own!.publishedAt, scheduled.at)
    expect(props.data!.map((post) => post.id)).toContain(publicId)
  })

  it('leaves a scheduled post out of search for guests and other users', async () => {
    const author = await makeUser()
    const other = await makeUser()
    const authorClient = await asUser(http, author)
    const scheduled = await storeScheduled(authorClient, 'Zephyr launch notes, scheduled')
    const publicId = await storePost(authorClient, payload({ title: 'Zephyr launch notes, public' }))

    for (const viewer of [await http.withCsrf(), await asUser(http, other)]) {
      const ids = await searchIds(viewer, 'Zephyr')
      expect(ids).toContain(publicId)
      expect(ids).not.toContain(scheduled.id)
    }
  })

  it('makes a post public once its published_at has passed, with no further action', async () => {
    const author = await makeUser()
    const scheduled = await storeScheduled(await asUser(http, author), 'Quokka field report')
    const guest = await http.withCsrf()
    expect(await indexIds(guest)).not.toContain(scheduled.id)

    // Time passing is simulated by moving the stored date an hour into the past.
    await setPublishedAt(scheduled.id, new Date(Date.now() - 60 * 60_000).toISOString())

    const props = await inertiaProps<{ post?: PostProp }>(guest, `/posts/${scheduled.id}`)
    expect(props.post?.id).toBe(scheduled.id)
    expect(await indexIds(guest)).toContain(scheduled.id)
    expect(await searchIds(guest, 'Quokka')).toContain(scheduled.id)
    expect(await indexIds(await asUser(http, await makeUser()))).toContain(scheduled.id)
  })

  it('rejects an unparsable publishAt the way an invalid title is rejected, and saves nothing', async () => {
    const author = await makeUser()
    const client = await asUser(http, author)

    const invalidTitle = await client.post('/posts', payload({ title: '' }))
    expect(invalidTitle.status).toBeGreaterThanOrEqual(400)
    expect(invalidTitle.status).toBeLessThan(500)

    for (const publishAt of ['next tuesday', '2026-13-45T25:61:00Z']) {
      const data = payload({ publishAt })
      const res = await client.post('/posts', data)
      expect(res.status).toBe(invalidTitle.status)
      if (res.status === 422) {
        const body = (await res.json()) as { errors?: Record<string, unknown> }
        expect(Object.keys(body.errors ?? {})).toContain('publishAt')
      }
      expect(await postRowByTitle(String(data.title))).toBeNull()
    }
  })
})
