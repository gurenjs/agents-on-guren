import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { Post } from '../../app/Models/Post.js'
import { asUser, freshApp, makePost, makeUser } from './_helpers.js'

const validPayload = {
  title: 'Renamed title',
  excerpt: 'Renamed excerpt',
  body: 'Renamed body.',
}

async function reload(id: number) {
  const post = await Post.find(id)
  if (!post) throw new Error(`post ${id} vanished`)
  return post
}

describe('PUT /posts/:id mass assignment', () => {
  let http: TestApp

  beforeAll(async () => {
    http = await freshApp()
  })

  it('never lets the request body change the author, even when the rest is valid', async () => {
    const author = await makeUser()
    const other = await makeUser()
    const post = await makePost(author.id)

    const res = await (await asUser(http, author)).put(`/posts/${post.id}`, {
      ...validPayload,
      authorId: other.id,
    })
    expect(res.status).toBeLessThan(500)

    const after = await reload(post.id)
    expect(after.authorId).toBe(author.id)

    if (res.status === 422) {
      // Rejecting the whole request because of the foreign field is acceptable
      // too — as long as nothing was written.
      expect(after.title).toBe(post.title)
    } else {
      expect([302, 303]).toContain(res.status)
      expect(after.title).toBe(validPayload.title)
    }
  })

  it('applies the edit form validation again: an empty title is refused and nothing changes', async () => {
    const author = await makeUser()
    const post = await makePost(author.id)

    const res = await (await asUser(http, author)).put(`/posts/${post.id}`, {
      ...validPayload,
      title: '',
    })
    expect(res.status).toBe(422)

    const after = await reload(post.id)
    expect(after.title).toBe(post.title)
    expect(after.excerpt).toBe(post.excerpt)
    expect(after.body).toBe(post.body)
  })

  it('does not persist a field the edit form does not own', async () => {
    const author = await makeUser()
    const post = await makePost(author.id)
    const forged = '2000-01-01T00:00:00.000Z'
    expect(post.createdAt).not.toBe(forged)

    const res = await (await asUser(http, author)).put(`/posts/${post.id}`, {
      ...validPayload,
      createdAt: forged,
    })
    expect(res.status).toBeLessThan(500)

    const after = await reload(post.id)
    expect(after.createdAt).toBe(post.createdAt)

    if (res.status === 422) {
      expect(after.title).toBe(post.title)
    } else {
      expect([302, 303]).toContain(res.status)
      expect(after.title).toBe(validPayload.title)
    }
  })

  it('still lets the author save an ordinary edit', async () => {
    const author = await makeUser()
    const post = await makePost(author.id)

    const res = await (await asUser(http, author)).put(`/posts/${post.id}`, validPayload)
    expect([302, 303]).toContain(res.status)

    const after = await reload(post.id)
    expect(after.title).toBe(validPayload.title)
    expect(after.excerpt).toBe(validPayload.excerpt)
    expect(after.body).toBe(validPayload.body)
    expect(after.authorId).toBe(author.id)
  })

  it('still refuses a non-author', async () => {
    const author = await makeUser()
    const other = await makeUser()
    const post = await makePost(author.id)

    const res = await (await asUser(http, other)).put(`/posts/${post.id}`, validPayload)
    expect(res.status).toBe(403)

    const after = await reload(post.id)
    expect(after.title).toBe(post.title)
    expect(after.authorId).toBe(author.id)
  })
})
