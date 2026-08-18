import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { asUser, freshApp, makeUser } from './_helpers.js'

interface PostProps {
  id: number
  title: string
  slug?: unknown
}

const PAYLOAD = { excerpt: 'A short excerpt', body: 'The body of the post.' }

/** Path of a Location header, whether it was sent absolute or relative. */
function locationPath(res: { headers: Headers }): string {
  const location = res.headers.get('location') ?? ''
  return new URL(location, 'http://localhost').pathname
}

/** Create a post through the form endpoint and return where the app sent the author afterwards. */
async function createPost(http: TestApp, author: { id: number }, title: string): Promise<{ status: number; path: string }> {
  const res = await (await asUser(http, author)).post('/posts', { title, ...PAYLOAD })
  expect([302, 303]).toContain(res.status)
  return { status: res.status, path: locationPath(res) }
}

/** Fetch a page as Inertia and return its component name and props (JSON, not the HTML shell). */
async function inertiaPage<P>(http: TestApp, path: string): Promise<{ status: number; component: string; props: P }> {
  const res = await http.withHeaders({ 'X-Inertia': 'true' }).get(path)
  if (res.status !== 200) return { status: res.status, component: '', props: {} as P }
  const json = (await res.json()) as { component: string; props: P }
  return { status: 200, ...json }
}

describe('post slugs', () => {
  let http: TestApp
  let author: { id: number }

  beforeAll(async () => {
    http = await freshApp()
    author = await makeUser()
  })

  it('creating "Hello, World!" lands on /posts/hello-world, which serves the post with its slug', async () => {
    const created = await createPost(http, author, 'Hello, World!')
    expect(created.path).toBe('/posts/hello-world')

    const page = await inertiaPage<{ post: PostProps }>(http, '/posts/hello-world')
    expect(page.status).toBe(200)
    expect(page.component).toBe('posts/Show')
    expect(page.props.post.title).toBe('Hello, World!')
    expect(page.props.post.slug).toBe('hello-world')
  })

  it('slugs are lowercase ASCII words joined by hyphens', async () => {
    const created = await createPost(http, author, '  Guren  &  Bun: 2026 Edition!  ')
    expect(created.path).toBe('/posts/guren-bun-2026-edition')

    const page = await inertiaPage<{ post: PostProps }>(http, '/posts/guren-bun-2026-edition')
    expect(page.status).toBe(200)
    expect(page.props.post.slug).toBe('guren-bun-2026-edition')
  })

  it('a repeated title gets -2, then -3, and each slug serves its own post', async () => {
    const first = await createPost(http, author, 'Same Title')
    const second = await createPost(http, author, 'Same Title')
    const third = await createPost(http, author, 'Same Title')
    expect(first.path).toBe('/posts/same-title')
    expect(second.path).toBe('/posts/same-title-2')
    expect(third.path).toBe('/posts/same-title-3')

    const ids = new Set<number>()
    for (const slug of ['same-title', 'same-title-2', 'same-title-3']) {
      const page = await inertiaPage<{ post: PostProps }>(http, `/posts/${slug}`)
      expect(page.status).toBe(200)
      expect(page.props.post.slug).toBe(slug)
      expect(page.props.post.title).toBe('Same Title')
      ids.add(page.props.post.id)
    }
    expect(ids.size).toBe(3)
  })

  it('editing the title keeps the slug', async () => {
    await createPost(http, author, 'Original Name')
    const before = await inertiaPage<{ post: PostProps }>(http, '/posts/original-name')
    expect(before.status).toBe(200)

    const res = await (await asUser(http, author)).put(`/posts/${before.props.post.id}`, {
      title: 'Completely Different Name',
      ...PAYLOAD,
    })
    expect([302, 303]).toContain(res.status)

    const after = await inertiaPage<{ post: PostProps }>(http, '/posts/original-name')
    expect(after.status).toBe(200)
    expect(after.props.post.id).toBe(before.props.post.id)
    expect(after.props.post.title).toBe('Completely Different Name')
    expect(after.props.post.slug).toBe('original-name')

    // The new title's slug was never assigned to anything.
    const res404 = await http.get('/posts/completely-different-name')
    expect(res404.status).toBe(404)
  })

  it('GET /posts/<id> permanently redirects to the slug URL', async () => {
    await createPost(http, author, 'Numeric Address')
    const page = await inertiaPage<{ post: PostProps }>(http, '/posts/numeric-address')
    expect(page.status).toBe(200)

    const res = await http.get(`/posts/${page.props.post.id}`)
    expect(res.status).toBe(301)
    expect(locationPath(res)).toBe('/posts/numeric-address')

    // Following the redirect serves the same post.
    const target = await inertiaPage<{ post: PostProps }>(http, locationPath(res))
    expect(target.status).toBe(200)
    expect(target.props.post.id).toBe(page.props.post.id)
  })

  it('unknown slugs and unknown ids are 404', async () => {
    expect((await http.get('/posts/no-such-post-anywhere')).status).toBe(404)
    expect((await http.get('/posts/999999')).status).toBe(404)
  })

  it('the post list and the home page carry each post\'s slug', async () => {
    const created = await createPost(http, author, 'Listed Everywhere')
    expect(created.path).toBe('/posts/listed-everywhere')

    const index = await inertiaPage<{ data: PostProps[] }>(http, '/posts')
    expect(index.status).toBe(200)
    expect(index.component).toBe('posts/Index')
    const listed = index.props.data.find((post) => post.title === 'Listed Everywhere')
    expect(listed).toBeDefined()
    expect(listed?.slug).toBe('listed-everywhere')
    for (const row of index.props.data) {
      expect(typeof row.slug).toBe('string')
      expect(row.slug).not.toBe('')
    }

    const home = await inertiaPage<{ latest: PostProps[] }>(http, '/')
    expect(home.status).toBe(200)
    const latest = home.props.latest.find((post) => post.title === 'Listed Everywhere')
    expect(latest).toBeDefined()
    expect(latest?.slug).toBe('listed-everywhere')
  })

  it('edit, update and delete still work at their id addresses', async () => {
    await createPost(http, author, 'Managed By Id')
    const page = await inertiaPage<{ post: PostProps }>(http, '/posts/managed-by-id')
    expect(page.status).toBe(200)
    const id = page.props.post.id

    const edit = await (await asUser(http, author)).withHeaders({ 'X-Inertia': 'true' }).get(`/posts/${id}/edit`)
    expect(edit.status).toBe(200)
    expect(((await edit.json()) as { component: string }).component).toBe('posts/Edit')

    const del = await (await asUser(http, author)).delete(`/posts/${id}`)
    expect([302, 303]).toContain(del.status)
    expect((await http.get('/posts/managed-by-id')).status).toBe(404)
  })
})
