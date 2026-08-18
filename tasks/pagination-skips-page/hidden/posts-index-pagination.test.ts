import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { Post } from '../../app/Models/Post.js'
import { freshApp, makePost, makeUser } from './_helpers.js'

const PER_PAGE = 10

interface IndexProps {
  data: Array<{ id: number; title: string }>
  pagination: {
    meta: { currentPage: number; lastPage: number; perPage: number; total: number; from: number | null; to: number | null }
    links: Record<string, unknown>
  }
}

/** Fetch /posts as Inertia and return the page props (JSON, not the HTML shell). */
async function indexProps(http: TestApp, query = ''): Promise<IndexProps> {
  const res = await http.withHeaders({ 'X-Inertia': 'true' }).get(`/posts${query}`)
  expect(res.status).toBe(200)
  const json = (await res.json()) as { component: string; props: IndexProps }
  expect(json.component).toBe('posts/Index')
  return json.props
}

describe('GET /posts pagination', () => {
  let http: TestApp
  /** All post ids, newest first — the order the list is expected to walk. */
  let newestFirst: number[]

  beforeAll(async () => {
    http = await freshApp()
    // Own every row: remove whatever the app seeded at boot so the list holds
    // exactly the 25 posts created here.
    for (const existing of await Post.all()) {
      await Post.delete({ id: existing.id })
    }
    const author = await makeUser()
    const ids: number[] = []
    for (let i = 1; i <= 25; i++) {
      const post = await makePost(author.id, { title: `Post ${i}` })
      ids.push(post.id)
    }
    newestFirst = [...ids].sort((a, b) => b - a)
    expect(newestFirst).toHaveLength(25)
  })

  it('shows the 10 newest posts on the first page by default', async () => {
    const props = await indexProps(http)
    expect(props.data.map((post) => post.id)).toEqual(newestFirst.slice(0, PER_PAGE))
  })

  it('treats ?page=1 the same as the default page', async () => {
    const props = await indexProps(http, '?page=1')
    expect(props.data.map((post) => post.id)).toEqual(newestFirst.slice(0, PER_PAGE))
  })

  it('shows posts 11-20 (newest first) on ?page=2', async () => {
    const props = await indexProps(http, '?page=2')
    expect(props.data.map((post) => post.id)).toEqual(newestFirst.slice(PER_PAGE, PER_PAGE * 2))
  })

  it('shows the 5 oldest posts on ?page=3', async () => {
    const props = await indexProps(http, '?page=3')
    expect(props.data.map((post) => post.id)).toEqual(newestFirst.slice(PER_PAGE * 2, PER_PAGE * 3))
    expect(props.data).toHaveLength(5)
  })

  it('reaches every post exactly once across the pages', async () => {
    const seen: number[] = []
    for (const query of ['', '?page=2', '?page=3']) {
      seen.push(...(await indexProps(http, query)).data.map((post) => post.id))
    }
    expect(seen).toEqual(newestFirst)
  })

  it('reports pagination meta that matches the page being shown', async () => {
    const first = await indexProps(http)
    expect(first.pagination.meta).toMatchObject({ currentPage: 1, lastPage: 3, perPage: PER_PAGE, total: 25, from: 1, to: 10 })

    const second = await indexProps(http, '?page=2')
    expect(second.pagination.meta).toMatchObject({ currentPage: 2, lastPage: 3, perPage: PER_PAGE, total: 25, from: 11, to: 20 })

    const third = await indexProps(http, '?page=3')
    expect(third.pagination.meta).toMatchObject({ currentPage: 3, lastPage: 3, perPage: PER_PAGE, total: 25, from: 21, to: 25 })
  })
})
