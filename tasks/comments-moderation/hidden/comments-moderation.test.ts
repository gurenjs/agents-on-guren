import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { asUser, freshApp, makePost, makeUser } from './_helpers.js'
import { commentByBody, commentById, commentsOnPost, reportCount } from './_comments-db.js'

interface CommentProp {
  id: number
  body: string
  author: { id: number; name: string }
  createdAt: string
}

let seq = 0
const uniqueBody = (label: string) => `${label} #${++seq} ${Date.now()}`

/** Fetch the post page as Inertia and return its component and props (JSON, not the HTML shell). */
async function postPage(http: TestApp, postId: number): Promise<{ component: string; props: { comments?: CommentProp[] } }> {
  const res = await http.withHeaders({ 'X-Inertia': 'true' }).get(`/posts/${postId}`)
  expect(res.status).toBe(200)
  return (await res.json()) as { component: string; props: { comments?: CommentProp[] } }
}

/** Post a comment as `user` through the pinned route and return its stored row. */
async function comment(http: TestApp, user: { id: number }, postId: number, body = uniqueBody('A comment')) {
  const res = await (await asUser(http, user)).post(`/posts/${postId}/comments`, { body })
  expect([302, 303]).toContain(res.status)
  const row = await commentByBody(body)
  expect(row).toBeDefined()
  return row!
}

/** DELETE /comments/:id as `user`, from the post page (so a redirect "back" and a redirect to the post agree). */
async function deleteComment(http: TestApp, user: { id: number }, commentId: number, postId: number) {
  return (await asUser(http, user)).withHeaders({ Referer: `http://localhost/posts/${postId}` }).delete(`/comments/${commentId}`)
}

async function report(http: TestApp, user: { id: number }, commentId: number) {
  return (await asUser(http, user)).post(`/comments/${commentId}/report`)
}

describe('comments on posts, with community moderation', () => {
  let http: TestApp

  beforeAll(async () => {
    http = await freshApp()
  })

  it('sends a guest who tries to comment to /login and stores nothing', async () => {
    const author = await makeUser()
    const post = await makePost(author.id)

    const guest = await http.withCsrf()
    const res = await guest.post(`/posts/${post.id}/comments`, { body: 'Guest comment' })
    expect([302, 303]).toContain(res.status)
    expect(res.headers.get('location') ?? '').toMatch(/\/login$/)
    expect(await commentsOnPost(post.id)).toHaveLength(0)
  })

  it("stores a signed-in user's comment on someone else's post and lists it on the post page with its author, oldest first", async () => {
    const a = await makeUser()
    const b = await makeUser({ name: 'Bea Commenter' })
    const c = await makeUser({ name: 'Cal Commenter' })
    const post = await makePost(a.id)

    const first = uniqueBody('First!')
    const res = await (await asUser(http, b)).post(`/posts/${post.id}/comments`, { body: first })
    expect([302, 303]).toContain(res.status)
    expect(res.headers.get('location') ?? '').toMatch(new RegExp(`/posts/${post.id}$`))

    const rows = await commentsOnPost(post.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.user_id).toBe(b.id)
    expect(rows[0]!.body).toBe(first)

    // A gap, so an implementation ordering by created_at alone cannot tie.
    await Bun.sleep(15)
    const second = (await comment(http, c, post.id, uniqueBody('Second'))).body

    const { component, props } = await postPage(http, post.id)
    expect(component).toBe('posts/Show')
    expect(Array.isArray(props.comments)).toBe(true)
    expect(props.comments!.map((entry) => entry.body)).toEqual([first, second])

    const shown = props.comments![0]!
    expect(shown.id).toBe(rows[0]!.id)
    expect(shown.author).toMatchObject({ id: b.id, name: 'Bea Commenter' })
    expect(typeof shown.createdAt).toBe('string')
    expect(Number.isNaN(Date.parse(shown.createdAt))).toBe(false)
  })

  it('lets the author of a comment delete it', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const post = await makePost(a.id)
    const row = await comment(http, b, post.id)

    const res = await deleteComment(http, b, row.id, post.id)
    expect([302, 303]).toContain(res.status)
    expect(res.headers.get('location') ?? '').toMatch(new RegExp(`/posts/${post.id}$`))
    expect(await commentById(row.id)).toBeUndefined()
  })

  it("lets the post's author delete someone else's comment on it", async () => {
    const a = await makeUser()
    const b = await makeUser()
    const post = await makePost(a.id)
    const row = await comment(http, b, post.id)

    const res = await deleteComment(http, a, row.id, post.id)
    expect([302, 303]).toContain(res.status)
    expect(await commentById(row.id)).toBeUndefined()
  })

  it('refuses a user who wrote neither the comment nor the post with 403 and keeps the comment', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const c = await makeUser()
    const post = await makePost(a.id)
    const row = await comment(http, b, post.id)

    const res = await deleteComment(http, c, row.id, post.id)
    expect(res.status).toBe(403)
    expect(await commentById(row.id)).toBeDefined()
  })

  it('hides a comment reported by three different users from the post page and keeps it in the database', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const post = await makePost(a.id)
    const hidden = await comment(http, b, post.id, uniqueBody('Spam'))
    const kept = await comment(http, b, post.id, uniqueBody('Fine'))

    const reporters = [await makeUser(), await makeUser()]
    for (const reporter of reporters) {
      expect((await report(http, reporter, hidden.id)).status).toBe(204)
    }
    // Two reports are not enough.
    let page = await postPage(http, post.id)
    expect(page.props.comments!.map((entry) => entry.id)).toContain(hidden.id)

    expect((await report(http, await makeUser(), hidden.id)).status).toBe(204)
    expect(await reportCount(hidden.id)).toBe(3)

    page = await postPage(http, post.id)
    const ids = page.props.comments!.map((entry) => entry.id)
    expect(ids).not.toContain(hidden.id)
    expect(ids).toContain(kept.id)
    expect(await commentById(hidden.id)).toBeDefined()
  })

  it('records one report when the same user reports a comment twice, answering 204 both times', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const reporter = await makeUser()
    const post = await makePost(a.id)
    const row = await comment(http, b, post.id)

    expect((await report(http, reporter, row.id)).status).toBe(204)
    expect((await report(http, reporter, row.id)).status).toBe(204)
    expect(await reportCount(row.id, reporter.id)).toBe(1)
    expect(await reportCount(row.id)).toBe(1)
  })

  it('removes a post’s comments when the post is deleted', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const post = await makePost(a.id)
    await comment(http, b, post.id)
    await comment(http, a, post.id)
    expect(await commentsOnPost(post.id)).toHaveLength(2)

    const res = await (await asUser(http, a)).delete(`/posts/${post.id}`)
    expect([302, 303]).toContain(res.status)
    expect(await commentsOnPost(post.id)).toHaveLength(0)
  })
})
