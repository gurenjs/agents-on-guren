import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { asUser, freshApp, makeUser } from './_helpers.js'

// Every fixture is created through the create form's endpoint (POST /posts)
// with the documented `published` field, and every assertion reads the
// documented `published` prop or plain HTTP status codes — nothing here
// depends on how a solution names its column or scopes its queries.

interface PostProps {
  id: number
  title: string
  published?: unknown
}

interface InertiaPage<P> {
  component: string
  props: P
}

const inertia = (http: TestApp) => http.withHeaders({ 'X-Inertia': 'true' })

/** Follow the redirect a successful create/update answers with and return the post id. */
function idFromLocation(res: { status: number; headers: Headers }): number {
  expect([302, 303]).toContain(res.status)
  const location = res.headers.get('location') ?? ''
  const match = /\/posts\/(\d+)/.exec(location)
  if (!match) throw new Error(`expected a redirect to the post page, got Location: ${location}`)
  return Number(match[1])
}

let seq = 0

/**
 * Create a post as `author` through the create form. `published` is omitted
 * from the payload when undefined — the "author left the box alone" case.
 */
async function createPost(
  http: TestApp,
  author: { id: number },
  fields: { title: string; excerpt?: string; body?: string; published?: boolean },
): Promise<{ id: number; title: string }> {
  seq += 1
  const payload: Record<string, unknown> = {
    title: fields.title,
    excerpt: fields.excerpt ?? `excerpt ${seq}`,
    body: fields.body ?? `The body of post ${seq}.`,
  }
  if (fields.published !== undefined) payload.published = fields.published
  const res = await (await asUser(http, author)).post('/posts', payload)
  return { id: idFromLocation(res), title: fields.title }
}

/** Fetch /posts (every page) as Inertia and return the listed posts. */
async function listedPosts(http: TestApp): Promise<PostProps[]> {
  const out: PostProps[] = []
  for (let page = 1; page <= 20; page += 1) {
    const res = await inertia(http).get(`/posts?page=${page}`)
    expect(res.status).toBe(200)
    const json = await res.json<InertiaPage<{ data: PostProps[]; pagination?: { meta?: { lastPage?: number } } }>>()
    expect(json.component).toBe('posts/Index')
    out.push(...json.props.data)
    if (page >= (json.props.pagination?.meta?.lastPage ?? 1)) break
  }
  return out
}

async function listedIds(http: TestApp): Promise<number[]> {
  return (await listedPosts(http)).map((post) => post.id)
}

async function searchIds(http: TestApp, keywords: string[]): Promise<number[]> {
  const res = await http.query('/posts/search', { keywords, limit: 50 })
  expect(res.status).toBe(200)
  const json = await res.json<{ data: PostProps[] }>()
  return json.data.map((post) => post.id)
}

async function showStatus(http: TestApp, id: number): Promise<number> {
  return (await inertia(http).get(`/posts/${id}`)).status
}

describe('drafts: visibility matrix', () => {
  let http: TestApp
  let author: { id: number }
  let other: { id: number }
  let draft: { id: number; title: string }
  let published: { id: number; title: string }

  beforeAll(async () => {
    http = await freshApp()
    author = await makeUser()
    other = await makeUser()
    published = await createPost(http, author, { title: 'Lanternfish public notes', published: true })
    draft = await createPost(http, author, { title: 'Lanternfish private draft', published: false })
  })

  it('guest: /posts lists the published post and not the draft', async () => {
    const ids = await listedIds(http)
    expect(ids).toContain(published.id)
    expect(ids).not.toContain(draft.id)
  })

  it('guest: every listed post carries `published: true`', async () => {
    const posts = await listedPosts(http)
    expect(posts.length).toBeGreaterThan(0)
    for (const post of posts) {
      expect(post.published).toBe(true)
    }
  })

  it('guest: search never returns the draft, even when it matches the keyword', async () => {
    const ids = await searchIds(http, ['lanternfish'])
    expect(ids).toContain(published.id)
    expect(ids).not.toContain(draft.id)
  })

  it('guest: a keyword only a draft contains yields no results', async () => {
    await createPost(http, author, { title: 'Only a draft mentions quokkabrush', published: false })
    expect(await searchIds(http, ['quokkabrush'])).toEqual([])
  })

  it('guest: the draft page is 404, the published page is 200', async () => {
    expect(await showStatus(http, draft.id)).toBe(404)
    expect(await showStatus(http, published.id)).toBe(200)
  })

  it('other signed-in user: draft absent from /posts and search, draft page 404', async () => {
    const asOther = await asUser(http, other)
    const ids = await listedIds(asOther)
    expect(ids).toContain(published.id)
    expect(ids).not.toContain(draft.id)
    expect(await searchIds(asOther, ['lanternfish'])).not.toContain(draft.id)
    expect(await showStatus(asOther, draft.id)).toBe(404)
    expect(await showStatus(asOther, published.id)).toBe(200)
  })

  it('author: can open their own draft page and it reports published: false', async () => {
    const res = await inertia(await asUser(http, author)).get(`/posts/${draft.id}`)
    expect(res.status).toBe(200)
    const json = await res.json<InertiaPage<{ post: PostProps }>>()
    expect(json.component).toBe('posts/Show')
    expect(json.props.post.id).toBe(draft.id)
    expect(json.props.post.published).toBe(false)
  })

  it('author: the published post page reports published: true', async () => {
    const res = await inertia(await asUser(http, author)).get(`/posts/${published.id}`)
    expect(res.status).toBe(200)
    const json = await res.json<InertiaPage<{ post: PostProps }>>()
    expect(json.props.post.published).toBe(true)
  })

  it('author: can open the edit page of their own draft', async () => {
    const res = await inertia(await asUser(http, author)).get(`/posts/${draft.id}/edit`)
    expect(res.status).toBe(200)
    const json = await res.json<InertiaPage<{ post: PostProps }>>()
    expect(json.component).toBe('posts/Edit')
    expect(json.props.post.id).toBe(draft.id)
  })

  it("other signed-in user: still cannot open the edit page of someone else's draft", async () => {
    const res = await inertia(await asUser(http, other)).get(`/posts/${draft.id}/edit`)
    expect([403, 404]).toContain(res.status)
  })
})

describe('drafts: create and publish through the forms', () => {
  let http: TestApp
  let author: { id: number }

  beforeAll(async () => {
    http = await freshApp()
    author = await makeUser()
  })

  it('a new post without the flag is a draft: hidden from guests, open to its author', async () => {
    const { id } = await createPost(http, author, { title: 'Untitled thoughts', excerpt: 'not ready yet' })

    expect(await showStatus(http, id)).toBe(404)
    expect(await listedIds(http)).not.toContain(id)
    expect(await searchIds(http, ['untitled'])).not.toContain(id)

    const asAuthor = await asUser(http, author)
    const res = await inertia(asAuthor).get(`/posts/${id}`)
    expect(res.status).toBe(200)
    const json = await res.json<InertiaPage<{ post: PostProps }>>()
    expect(json.props.post.published).toBe(false)
  })

  it('a new post with published: true is visible to guests everywhere', async () => {
    const { id } = await createPost(http, author, { title: 'Kelpwood field guide', published: true })

    expect(await showStatus(http, id)).toBe(200)
    expect(await listedIds(http)).toContain(id)
    expect(await searchIds(http, ['kelpwood'])).toContain(id)
  })

  it('the author publishes a draft from the edit form and it appears for guests', async () => {
    const draft = await createPost(http, author, { title: 'Marmalade sunrise, drafted' })
    expect(await showStatus(http, draft.id)).toBe(404)

    const res = await (await asUser(http, author)).put(`/posts/${draft.id}`, {
      title: draft.title,
      excerpt: 'now public',
      body: 'Edited and published.',
      published: true,
    })
    expect([302, 303]).toContain(res.status)

    expect(await showStatus(http, draft.id)).toBe(200)
    expect(await listedIds(http)).toContain(draft.id)
    expect(await searchIds(http, ['marmalade'])).toContain(draft.id)
  })

  it('the author unpublishes a post from the edit form and it disappears for guests', async () => {
    const post = await createPost(http, author, { title: 'Cobalt harbour, once public', published: true })
    expect(await showStatus(http, post.id)).toBe(200)

    const asAuthor = await asUser(http, author)
    const res = await asAuthor.put(`/posts/${post.id}`, {
      title: post.title,
      excerpt: 'pulled back',
      body: 'Back to draft.',
      published: false,
    })
    expect([302, 303]).toContain(res.status)

    expect(await showStatus(http, post.id)).toBe(404)
    expect(await listedIds(http)).not.toContain(post.id)
    expect(await searchIds(http, ['cobalt'])).not.toContain(post.id)
    expect(await showStatus(asAuthor, post.id)).toBe(200)
  })
})
