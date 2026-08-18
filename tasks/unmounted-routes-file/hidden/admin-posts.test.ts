import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { Post } from '../../app/Models/Post.js'
import { asUser, freshApp, makePost, makeUser } from './_helpers.js'

interface AdminPostRow {
  id: number
  title: string
  author?: { id?: number; name?: string }
}

describe('GET /admin/posts', () => {
  let http: TestApp

  beforeAll(async () => {
    http = await freshApp()
  })

  it('returns 200 JSON listing every post with its author name for a signed-in user', async () => {
    const alice = await makeUser({ name: 'Alice Author' })
    const bob = await makeUser({ name: 'Bob Blogger' })
    const p1 = await makePost(alice.id, { title: 'First by Alice' })
    const p2 = await makePost(bob.id, { title: 'Second by Bob' })
    const p3 = await makePost(alice.id, { title: 'Third by Alice' })

    const res = await (await asUser(http, bob)).get('/admin/posts')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type') ?? '').toContain('application/json')

    const body = (await res.json()) as { data: AdminPostRow[] }
    expect(Array.isArray(body.data)).toBe(true)

    // "Every post": the list matches the table exactly, including whatever the
    // seeders put there — not just the rows this test created.
    const rows = body.data
    const ids = rows.map((row) => row.id).sort((a, b) => a - b)
    const expectedIds = (await Post.all()).map((post) => post.id).sort((a, b) => a - b)
    expect(ids).toEqual(expectedIds)
    expect(ids).toEqual(expect.arrayContaining([p1.id, p2.id, p3.id]))

    const byId = new Map(rows.map((row) => [row.id, row]))
    expect(byId.get(p1.id)?.title).toBe('First by Alice')
    expect(byId.get(p1.id)?.author?.name).toBe('Alice Author')
    expect(byId.get(p2.id)?.title).toBe('Second by Bob')
    expect(byId.get(p2.id)?.author?.name).toBe('Bob Blogger')
    expect(byId.get(p3.id)?.author?.name).toBe('Alice Author')
  })

  it('refuses a guest (redirect to login, 401 or 403 — never a 404 or the list)', async () => {
    const author = await makeUser()
    await makePost(author.id)

    const res = await http.get('/admin/posts')
    expect([302, 303, 401, 403]).toContain(res.status)
    if (res.status === 302 || res.status === 303) {
      expect(res.headers.get('location') ?? '').toContain('/login')
    }
  })

  it('leaves the public post list working', async () => {
    const author = await makeUser()
    await makePost(author.id, { title: 'Still public' })

    const res = await http.get('/posts')
    expect(res.status).toBe(200)
  })
})
