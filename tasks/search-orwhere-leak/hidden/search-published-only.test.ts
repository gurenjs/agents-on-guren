import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { Post } from '../../app/Models/Post.js'
import { freshApp, makePost, makeUser } from './_helpers.js'

interface SearchResponse {
  data: Array<{ id: number; title: string }>
}

/** A post that is not published — only ever created here, by direct DB write. */
async function makeDraft(authorId: number, title: string, excerpt = 'draft excerpt') {
  const post = await Post.forceCreate({
    title,
    excerpt,
    body: 'The body of a draft.',
    authorId,
    published: false,
  })
  if (!post) throw new Error('makeDraft: forceCreate returned null')
  return post
}

async function searchIds(http: TestApp, keywords: string[]): Promise<number[]> {
  const res = await http.query('/posts/search', { keywords })
  expect(res.status).toBe(200)
  const json = (await res.json()) as SearchResponse
  return json.data.map((post) => post.id)
}

/** Fetch /posts as Inertia and return the ids of the listed posts. */
async function indexIds(http: TestApp): Promise<number[]> {
  const res = await http.withHeaders({ 'X-Inertia': 'true' }).get('/posts')
  expect(res.status).toBe(200)
  const json = (await res.json()) as { component: string; props: { data: Array<{ id: number }> } }
  expect(json.component).toBe('posts/Index')
  return json.props.data.map((post) => post.id)
}

describe('QUERY /posts/search never returns unpublished posts', () => {
  let http: TestApp
  let authorId: number

  beforeAll(async () => {
    http = await freshApp()
    authorId = (await makeUser()).id
  })

  it('single keyword: returns the published match, never the draft that also matches', async () => {
    const published = await makePost(authorId, { title: 'Zephyrquill field notes', excerpt: 'published' })
    const draft = await makeDraft(authorId, 'Zephyrquill draft', 'unpublished')
    const unrelated = await makePost(authorId, { title: 'Nothing to do with it', excerpt: 'no keyword here' })

    const ids = await searchIds(http, ['zephyrquill'])
    expect(ids).toContain(published.id)
    expect(ids).not.toContain(draft.id)
    expect(ids).not.toContain(unrelated.id)
  })

  it('a keyword only a draft contains returns no results', async () => {
    const draft = await makeDraft(authorId, 'Only in a draft: quokkabrush', 'unpublished')

    const ids = await searchIds(http, ['quokkabrush'])
    expect(ids).toEqual([])
    expect(ids).not.toContain(draft.id)
  })

  it('two keywords: returns every published match for either keyword and no drafts', async () => {
    const pubA = await makePost(authorId, { title: 'Marmalade skies', excerpt: 'published' })
    const pubB = await makePost(authorId, { title: 'Weekend plans', excerpt: 'a tangerine dream, published' })
    const draftA = await makeDraft(authorId, 'Marmalade draft', 'unpublished')
    const draftB = await makeDraft(authorId, 'Draft', 'tangerine, unpublished')

    const ids = await searchIds(http, ['marmalade', 'tangerine'])
    expect(ids).toContain(pubA.id)
    expect(ids).toContain(pubB.id)
    expect(ids).not.toContain(draftA.id)
    expect(ids).not.toContain(draftB.id)
  })

  it('every result matches at least one keyword and is published (checked against the DB)', async () => {
    await makePost(authorId, { title: 'Cobalt harbour', excerpt: 'published' })
    await makeDraft(authorId, 'Cobalt draft', 'unpublished')
    await makePost(authorId, { title: 'Unrelated', excerpt: 'nothing' })

    const ids = await searchIds(http, ['cobalt'])
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      const post = await Post.findOrFail(id)
      expect(Boolean(post.published)).toBe(true)
      const haystack = `${post.title} ${post.excerpt} ${post.body}`.toLowerCase()
      expect(haystack).toContain('cobalt')
    }
  })

  it('the post list still hides drafts and the draft page still 404s', async () => {
    const published = await makePost(authorId, { title: 'Listed post', excerpt: 'published' })
    const draft = await makeDraft(authorId, 'Hidden draft', 'unpublished')

    const listed = await indexIds(http)
    expect(listed).toContain(published.id)
    expect(listed).not.toContain(draft.id)

    const res = await http.withHeaders({ 'X-Inertia': 'true' }).get(`/posts/${draft.id}`)
    expect(res.status).toBe(404)
  })
})
