import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { Post } from '../../app/Models/Post.js'
import { freshApp, makeUser } from './_helpers.js'

async function makePostAt(authorId: number, createdAt: string, title: string) {
  const post = await Post.forceCreate({
    title,
    excerpt: `${title} excerpt`,
    body: `${title} body`,
    authorId,
    createdAt,
  })
  if (!post) throw new Error('makePostAt: forceCreate returned null')
  return post
}

// The ids of every post whose (UTC) creation time starts with `prefix`
// ("2026-08" or "2026"), read straight from the database — independent of the
// seeder, which inserts posts stamped "now".
async function idsCreatedIn(prefix: string): Promise<number[]> {
  const all = await Post.all()
  return all
    .filter((post) => new Date(post.createdAt as string | Date).toISOString().startsWith(prefix))
    .map((post) => post.id as number)
    .sort((a, b) => a - b)
}

async function archiveIds(http: TestApp, path: string): Promise<number[]> {
  const res = await http.get(path)
  expect(res.status).toBe(200)
  const json = (await res.json()) as { data: Array<{ id: number; title: string }> }
  expect(Array.isArray(json.data)).toBe(true)
  for (const entry of json.data) {
    expect(typeof entry.id).toBe('number')
    expect(typeof entry.title).toBe('string')
  }
  return json.data.map((entry) => entry.id)
}

const sortedAsc = (ids: number[]) => [...ids].sort((a, b) => a - b)

describe('GET /posts/archive/<year>[/<month>]', () => {
  let http: TestApp
  let augustIds: number[]
  let julyId: number
  let lastAugustId: number
  let nextYearId: number

  beforeAll(async () => {
    http = await freshApp()
    const author = await makeUser()
    const a1 = await makePostAt(author.id, '2026-08-03T09:00:00.000Z', 'August one')
    const a2 = await makePostAt(author.id, '2026-08-21T18:30:00.000Z', 'August two')
    julyId = (await makePostAt(author.id, '2026-07-31T23:59:59.000Z', 'July one')).id
    lastAugustId = (await makePostAt(author.id, '2025-08-10T12:00:00.000Z', 'Last August')).id
    nextYearId = (await makePostAt(author.id, '2027-01-01T00:00:00.000Z', 'Next year')).id
    augustIds = [a1.id, a2.id]
  })

  it('lists exactly the posts created in that month for /posts/archive/2026/08', async () => {
    const ids = await archiveIds(http, '/posts/archive/2026/08')
    expect(sortedAsc(ids)).toEqual(await idsCreatedIn('2026-08'))
    for (const id of augustIds) expect(ids).toContain(id)
    expect(ids).not.toContain(julyId)
    expect(ids).not.toContain(lastAugustId)
  })

  it('returns the archive newest first', async () => {
    const ids = await archiveIds(http, '/posts/archive/2026/08')
    expect(ids).toEqual([...ids].sort((a, b) => b - a))
    expect(ids.indexOf(augustIds[1])).toBeLessThan(ids.indexOf(augustIds[0]))
  })

  it('accepts a month without a leading zero (/posts/archive/2026/8)', async () => {
    const ids = await archiveIds(http, '/posts/archive/2026/8')
    expect(sortedAsc(ids)).toEqual(await idsCreatedIn('2026-08'))
  })

  it('lists a whole year for /posts/archive/2026', async () => {
    const ids = await archiveIds(http, '/posts/archive/2026')
    expect(sortedAsc(ids)).toEqual(await idsCreatedIn('2026'))
    for (const id of [...augustIds, julyId]) expect(ids).toContain(id)
    expect(ids).not.toContain(lastAugustId)
    expect(ids).not.toContain(nextYearId)
  })

  it('lists a different year and month independently', async () => {
    expect(await archiveIds(http, '/posts/archive/2025/08')).toEqual([lastAugustId])
    expect(await archiveIds(http, '/posts/archive/2027')).toEqual([nextYearId])
  })

  it('returns an empty list for a period with no posts', async () => {
    expect(await archiveIds(http, '/posts/archive/2024/02')).toEqual([])
    expect(await archiveIds(http, '/posts/archive/2019')).toEqual([])
  })

  it('rejects a month that is not 1-12 with a 4xx', async () => {
    const res = await http.get('/posts/archive/2026/13')
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })
})

describe('unrelated post routes are unaffected', () => {
  let http: TestApp
  let postId: number

  beforeAll(async () => {
    http = await freshApp()
    const author = await makeUser()
    postId = (await makePostAt(author.id, '2026-08-03T09:00:00.000Z', 'Still readable')).id
  })

  it('still lists posts at /posts', async () => {
    await http.get('/posts').assertOk()
  })

  it('still shows a single post at /posts/:id', async () => {
    await http.get(`/posts/${postId}`).assertOk()
  })

  it('still 404s an unknown post id', async () => {
    const res = await http.get('/posts/999999')
    expect(res.status).toBe(404)
  })
})
