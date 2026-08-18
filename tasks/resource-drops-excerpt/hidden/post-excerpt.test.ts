import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { asUser, freshApp, makePost, makeUser } from './_helpers.js'

interface PostProps {
  id: number
  title: string
  excerpt?: unknown
}

/** Fetch a page as Inertia and return its component name and props (JSON, not the HTML shell). */
async function inertiaPage<P>(http: TestApp, path: string): Promise<{ component: string; props: P }> {
  const res = await http.withHeaders({ 'X-Inertia': 'true' }).get(path)
  expect(res.status).toBe(200)
  return (await res.json()) as { component: string; props: P }
}

describe('post excerpts are shown to readers', () => {
  let http: TestApp
  let author: { id: number }
  const seeded: Array<{ id: number; excerpt: string }> = []

  beforeAll(async () => {
    http = await freshApp()
    author = await makeUser()
    for (const excerpt of ['Bees remember faces', 'Octopus arms taste what they touch', 'Honey never spoils']) {
      const post = await makePost(author.id, { title: `About: ${excerpt}`, excerpt })
      seeded.push({ id: post.id, excerpt })
    }
  })

  it('GET /posts lists each post with its stored excerpt', async () => {
    const { component, props } = await inertiaPage<{ data: PostProps[] }>(http, '/posts')
    expect(component).toBe('posts/Index')

    for (const { id, excerpt } of seeded) {
      const row = props.data.find((post) => post.id === id)
      expect(row).toBeDefined()
      expect(row?.excerpt).toBe(excerpt)
    }
  })

  it('GET /posts/:id shows the stored excerpt', async () => {
    for (const { id, excerpt } of seeded) {
      const { component, props } = await inertiaPage<{ post: PostProps }>(http, `/posts/${id}`)
      expect(component).toBe('posts/Show')
      expect(props.post.id).toBe(id)
      expect(props.post.excerpt).toBe(excerpt)
    }
  })

  it('GET /posts/:id/edit pre-fills the form with the stored excerpt', async () => {
    const { id, excerpt } = seeded[0]!
    const res = await (await asUser(http, author)).withHeaders({ 'X-Inertia': 'true' }).get(`/posts/${id}/edit`)
    expect(res.status).toBe(200)
    const { component, props } = (await res.json()) as { component: string; props: { post: PostProps } }
    expect(component).toBe('posts/Edit')
    expect(props.post.excerpt).toBe(excerpt)
  })
})
