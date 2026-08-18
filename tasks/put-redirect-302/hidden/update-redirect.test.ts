import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { Post } from '../../app/Models/Post.js'
import { asUser, freshApp, makePost, makeUser } from './_helpers.js'

const payload = {
  title: 'Updated title',
  excerpt: 'Updated excerpt',
  body: 'Updated body of the post.',
}

/** Location may be relative or absolute; compare the path only. */
function locationPath(res: { headers: Headers }): string | null {
  const location = res.headers.get('location')
  return location === null ? null : new URL(location, 'http://localhost').pathname
}

describe('PUT /posts/:id redirect', () => {
  let http: TestApp

  beforeAll(async () => {
    http = await freshApp()
  })

  it('answers a successful edit with 303 See Other pointing at the post page', async () => {
    const author = await makeUser()
    const post = await makePost(author.id)

    const res = await (await asUser(http, author)).put(`/posts/${post.id}`, payload)
    // 303 is the only redirect a browser follows with GET after a PUT: 301/302
    // keep the method for PUT (only POST is rewritten), and 307/308 keep it by
    // definition — so anything else makes the client re-send the PUT to the
    // post page instead of loading it.
    expect(res.status).toBe(303)
    expect(locationPath(res)).toBe(`/posts/${post.id}`)
  })

  it('persists the edit and the post page it points at shows the new title', async () => {
    const author = await makeUser()
    const post = await makePost(author.id, { title: 'Original title' })

    const client = await asUser(http, author)
    const res = await client.put(`/posts/${post.id}`, payload)
    expect(res.status).toBe(303)

    const updated = await Post.find(post.id)
    expect(updated?.title).toBe('Updated title')

    const next = locationPath(res)
    expect(next).toBe(`/posts/${post.id}`)
    await client
      .withHeaders({ 'X-Inertia': 'true' })
      .get(next!)
      .assertOk()
      .assertInertia('posts/Show')
      .assertJsonPath('props.post.title', 'Updated title')
  })

  it('still rejects an invalid payload with 422 and saves nothing', async () => {
    const author = await makeUser()
    const post = await makePost(author.id, { title: 'Original title' })

    const res = await (await asUser(http, author)).put(`/posts/${post.id}`, { title: '', excerpt: '', body: '' })
    expect(res.status).toBe(422)
    expect((await Post.find(post.id))?.title).toBe('Original title')
  })
})
