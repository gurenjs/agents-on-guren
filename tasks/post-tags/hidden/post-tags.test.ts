import { beforeEach, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { sql, type SQL } from 'drizzle-orm'
import { getDatabase } from '../../config/database.js'
import { asUser, freshApp, makePost, makeUser } from './_helpers.js'

// The ticket pins the tables `tags` (id, name) and `post_tags` (post_id,
// tag_id), the `tags` form field, `?tag=` on the posts list and `tags:
// string[]` on every post handed to posts/Index and posts/Show. DB state is
// read by table name, never through a model the solution may not have.

interface PostProps {
  id: number
  title: string
  tags?: unknown
}

interface IndexProps {
  data: PostProps[]
  pagination?: { meta?: { total?: number } }
}

async function rows<T>(query: SQL): Promise<T[]> {
  const db = (await getDatabase()) as { all: (query: SQL) => T[] | Promise<T[]> }
  return await db.all(query)
}

async function tagNames(): Promise<string[]> {
  const found = await rows<{ name: string }>(sql`select name from tags order by name`)
  return found.map((row) => row.name)
}

async function tagsOfPost(postId: number): Promise<string[]> {
  const found = await rows<{ name: string }>(
    sql`select t.name as name from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = ${postId} order by t.name`,
  )
  return found.map((row) => row.name)
}

async function postIdByTitle(title: string): Promise<number | null> {
  const found = await rows<{ id: number }>(sql`select id from posts where title = ${title}`)
  return found.length === 1 ? Number(found[0].id) : null
}

async function countRows(table: 'posts' | 'tags' | 'post_tags'): Promise<number> {
  const found = await rows<{ n: number }>(sql.raw(`select count(*) as n from ${table}`))
  return Number(found[0].n)
}

async function inertiaProps<T>(http: TestApp, path: string, component: string): Promise<T> {
  const res = await http.withHeaders({ 'X-Inertia': 'true' }).get(path)
  expect(res.status).toBe(200)
  const json = (await res.json()) as { component: string; props: T }
  expect(json.component).toBe(component)
  return json.props
}

let seq = 0
function payload(tags?: string) {
  seq += 1
  return {
    title: `Tagged post ${seq}`,
    excerpt: 'A short excerpt',
    body: 'The body of the post.',
    ...(tags === undefined ? {} : { tags }),
  }
}

/** Create a post through the form endpoint; returns its id. */
async function storePost(client: TestApp, tags: string): Promise<number> {
  const data = payload(tags)
  const res = await client.post('/posts', data)
  expect([302, 303]).toContain(res.status)
  const id = await postIdByTitle(data.title)
  expect(id).not.toBeNull()
  return id as number
}

/** The failure an invalid title produces today — the ticket asks tags to fail the same way. */
async function invalidTitleStatus(client: TestApp): Promise<number> {
  const res = await client.post('/posts', { ...payload(), title: '' })
  expect(res.status).toBeGreaterThanOrEqual(400)
  expect(res.status).toBeLessThan(500)
  return res.status
}

async function expectRejectedLikeTitle(client: TestApp, tags: string) {
  const expected = await invalidTitleStatus(client)
  // What the baseline answers an empty title with (a JSON request, no X-Inertia).
  expect(expected).toBe(422)
  const data = payload(tags)
  const res = await client.post('/posts', data)
  expect(res.status).toBe(expected)
  const body = (await res.json()) as { errors?: Record<string, unknown> }
  expect(Object.keys(body.errors ?? {}).some((key) => key.startsWith('tags'))).toBe(true)
  expect(await postIdByTitle(data.title)).toBeNull()
}

describe('post tags', () => {
  let http: TestApp

  beforeEach(async () => {
    http = await freshApp()
  })

  it('stores "bun, webdev" as two tags of the new post and the post page shows them', async () => {
    const author = await makeUser()
    const client = await asUser(http, author)

    const id = await storePost(client, 'bun, webdev')

    expect(await tagNames()).toEqual(['bun', 'webdev'])
    expect(await tagsOfPost(id)).toEqual(['bun', 'webdev'])

    const props = await inertiaProps<{ post: PostProps }>(http, `/posts/${id}`, 'posts/Show')
    expect(props.post.tags).toEqual(['bun', 'webdev'])
  })

  it('editing the field down to "bun" disassociates webdev from the post', async () => {
    const author = await makeUser()
    const client = await asUser(http, author)
    const id = await storePost(client, 'bun, webdev')

    const res = await client.put(`/posts/${id}`, { ...payload('bun') })
    expect([302, 303]).toContain(res.status)

    expect(await tagsOfPost(id)).toEqual(['bun'])
    const props = await inertiaProps<{ post: PostProps }>(http, `/posts/${id}`, 'posts/Show')
    expect(props.post.tags).toEqual(['bun'])
  })

  it('?tag=bun lists only the posts carrying bun, an unknown tag lists none, and every listed post carries its tags', async () => {
    const author = await makeUser()
    const client = await asUser(http, author)
    const bunPost = await storePost(client, 'bun')
    const webdevPost = await storePost(client, 'webdev')
    const untagged = await makePost(author.id, { title: 'No tags here' })

    const all = await inertiaProps<IndexProps>(http, '/posts', 'posts/Index')
    const byId = new Map(all.data.map((post) => [post.id, post]))
    expect(byId.get(bunPost)?.tags).toEqual(['bun'])
    expect(byId.get(webdevPost)?.tags).toEqual(['webdev'])
    expect(byId.get(untagged.id)?.tags).toEqual([])

    const filtered = await inertiaProps<IndexProps>(http, '/posts?tag=bun', 'posts/Index')
    expect(filtered.data.map((post) => post.id)).toEqual([bunPost])
    expect(filtered.data[0].tags).toEqual(['bun'])
    if (filtered.pagination?.meta?.total !== undefined) expect(filtered.pagination.meta.total).toBe(1)

    const other = await inertiaProps<IndexProps>(http, '/posts?tag=no-such-tag', 'posts/Index')
    expect(other.data).toEqual([])
  })

  it('rejects six tags the same way an invalid title is rejected and saves nothing', async () => {
    const author = await makeUser()
    const client = await asUser(http, author)

    await expectRejectedLikeTitle(client, 'one, two, three, four, five, six')
    expect(await countRows('tags')).toBe(0)
    expect(await countRows('post_tags')).toBe(0)
  })

  it('rejects a 31-character tag name and accepts a 30-character one', async () => {
    const author = await makeUser()
    const client = await asUser(http, author)

    await expectRejectedLikeTitle(client, `bun, ${'x'.repeat(31)}`)
    expect(await countRows('post_tags')).toBe(0)

    const id = await storePost(client, 'y'.repeat(30))
    expect(await tagsOfPost(id)).toEqual(['y'.repeat(30)])
  })

  it('collapses " bun ,bun" into the single tag bun', async () => {
    const author = await makeUser()
    const client = await asUser(http, author)

    const id = await storePost(client, ' bun ,bun')

    expect(await tagNames()).toEqual(['bun'])
    expect(await countRows('post_tags')).toBe(1)
    const props = await inertiaProps<{ post: PostProps }>(http, `/posts/${id}`, 'posts/Show')
    expect(props.post.tags).toEqual(['bun'])
  })
})
