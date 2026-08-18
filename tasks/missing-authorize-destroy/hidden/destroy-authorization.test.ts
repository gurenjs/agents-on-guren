import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { Post } from '../../app/Models/Post.js'
import { asUser, freshApp, makePost, makeUser } from './_helpers.js'

describe('DELETE /posts/:id authorization', () => {
  let http: TestApp

  beforeAll(async () => {
    http = await freshApp()
  })

  it('refuses a signed-in non-author with 403 and keeps the post', async () => {
    const author = await makeUser()
    const other = await makeUser()
    const post = await makePost(author.id)

    const res = await (await asUser(http, other)).delete(`/posts/${post.id}`)
    expect(res.status).toBe(403)
    expect(await Post.find(post.id)).not.toBeNull()
  })

  it('refuses a guest and keeps the post', async () => {
    const author = await makeUser()
    const post = await makePost(author.id)

    const guest = await http.withCsrf()
    const res = await guest.delete(`/posts/${post.id}`)
    expect([302, 401, 403]).toContain(res.status)
    expect(await Post.find(post.id)).not.toBeNull()
  })

  it('still lets the author delete their own post', async () => {
    const author = await makeUser()
    const post = await makePost(author.id)

    const res = await (await asUser(http, author)).delete(`/posts/${post.id}`)
    expect([302, 303]).toContain(res.status)
    expect(await Post.find(post.id)).toBeNull()
  })
})
