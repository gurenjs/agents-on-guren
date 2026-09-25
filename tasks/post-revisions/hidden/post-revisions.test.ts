import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { Post } from '../../app/Models/Post.js'
import { asUser, freshApp, makePost, makeUser } from './_helpers.js'
import { revisionRows } from './_revisions-db.js'

interface RevisionProp {
  id: number
  title: string
  createdAt: string
}

// Each edit pair sleeps over a second; the cross-post case makes three pairs.
const TIMEOUT_MS = 20_000

const ORIGINAL = { title: 'First title', excerpt: 'First excerpt', body: 'First body.' }
const SECOND = { title: 'Second title', excerpt: 'Second excerpt', body: 'Second body.' }
const THIRD = { title: 'Third title', excerpt: 'Third excerpt', body: 'Third body.' }

/** Location may be relative or absolute; compare the path only. */
function locationPath(res: { headers: Headers }): string | null {
  const location = res.headers.get('location')
  return location === null ? null : new URL(location, 'http://localhost').pathname
}

function contentOf(post: { title: string; excerpt: string; body: string } | null) {
  return post === null ? null : { title: post.title, excerpt: post.excerpt, body: post.body }
}

/** Edit `postId` twice as its author (First → Second → Third), leaving two revisions. */
async function editTwice(client: TestApp, postId: number) {
  const first = await client.put(`/posts/${postId}`, SECOND)
  expect([302, 303]).toContain(first.status)
  // Over a second apart, so "newest first" is not a tie whether a solution
  // orders by id or by a created_at stored at millisecond or second precision.
  await Bun.sleep(1100)
  const second = await client.put(`/posts/${postId}`, THIRD)
  expect([302, 303]).toContain(second.status)
}

async function revisionsProps(client: TestApp, postId: number): Promise<RevisionProp[]> {
  const res = await client.withHeaders({ 'X-Inertia': 'true' }).get(`/posts/${postId}/revisions`)
  expect(res.status).toBe(200)
  const json = (await res.json()) as { props: { revisions?: RevisionProp[] } }
  expect(Array.isArray(json.props.revisions)).toBe(true)
  return json.props.revisions!
}

describe('post revisions', () => {
  let http: TestApp

  beforeAll(async () => {
    http = await freshApp()
  }, TIMEOUT_MS)

  it('keeps the previous version on every edit and lists revisions newest first', async () => {
    const author = await makeUser()
    const post = await makePost(author.id, ORIGINAL)
    const client = await asUser(http, author)

    expect(await revisionRows(post.id)).toHaveLength(0)
    await editTwice(client, post.id)

    const rows = await revisionRows(post.id)
    expect(rows).toHaveLength(2)
    expect(rows.map(contentOf)).toEqual(expect.arrayContaining([ORIGINAL, SECOND]))

    const revisions = await revisionsProps(client, post.id)
    expect(revisions).toHaveLength(2)
    expect(revisions.map((revision) => revision.title)).toEqual([SECOND.title, ORIGINAL.title])
    for (const revision of revisions) {
      expect(rows.map((row) => row.id)).toContain(revision.id)
      expect(rows.find((row) => row.id === revision.id)?.title).toBe(revision.title)
      expect(typeof revision.createdAt).toBe('string')
      expect(Number.isNaN(Date.parse(revision.createdAt))).toBe(false)
    }
  }, TIMEOUT_MS)

  it('restores a revision, redirects to the post, and keeps the pre-restore state as a revision', async () => {
    const author = await makeUser()
    const post = await makePost(author.id, ORIGINAL)
    const client = await asUser(http, author)
    await editTwice(client, post.id)

    const original = (await revisionRows(post.id)).find((row) => row.title === ORIGINAL.title)
    expect(original).toBeDefined()

    const res = await client.post(`/posts/${post.id}/revisions/${original!.id}/restore`)
    expect([302, 303]).toContain(res.status)
    expect(locationPath(res)).toBe(`/posts/${post.id}`)

    expect(contentOf(await Post.find(post.id))).toEqual(ORIGINAL)
    const rows = await revisionRows(post.id)
    expect(rows).toHaveLength(3)
    expect(rows.map(contentOf)).toEqual(expect.arrayContaining([ORIGINAL, SECOND, THIRD]))
  }, TIMEOUT_MS)

  it('refuses another signed-in user with 403, both for the list and for a restore', async () => {
    const author = await makeUser()
    const other = await makeUser()
    const post = await makePost(author.id, ORIGINAL)
    await editTwice(await asUser(http, author), post.id)
    const revision = (await revisionRows(post.id))[0]!

    const intruder = await asUser(http, other)
    const list = await intruder.withHeaders({ 'X-Inertia': 'true' }).get(`/posts/${post.id}/revisions`)
    expect(list.status).toBe(403)

    const restore = await intruder.post(`/posts/${post.id}/revisions/${revision.id}/restore`)
    expect(restore.status).toBe(403)
    expect(contentOf(await Post.find(post.id))).toEqual(THIRD)
    expect(await revisionRows(post.id)).toHaveLength(2)
  }, TIMEOUT_MS)

  it('sends a guest to the login page, both for the list and for a restore', async () => {
    const author = await makeUser()
    const post = await makePost(author.id, ORIGINAL)
    await editTwice(await asUser(http, author), post.id)
    const revision = (await revisionRows(post.id))[0]!

    const guest = await http.withCsrf()
    const list = await guest.get(`/posts/${post.id}/revisions`)
    expect([302, 303]).toContain(list.status)
    expect(locationPath(list)).toBe('/login')

    const restore = await guest.post(`/posts/${post.id}/revisions/${revision.id}/restore`)
    expect([302, 303]).toContain(restore.status)
    expect(locationPath(restore)).toBe('/login')
    expect(contentOf(await Post.find(post.id))).toEqual(THIRD)
    expect(await revisionRows(post.id)).toHaveLength(2)
  }, TIMEOUT_MS)

  it('answers 404 for a revision id that belongs to another post, and changes nothing', async () => {
    const author = await makeUser()
    const client = await asUser(http, author)
    const target = await makePost(author.id, ORIGINAL)
    const sibling = await makePost(author.id, { title: 'Sibling title', excerpt: 'Sibling excerpt', body: 'Sibling body.' })
    await editTwice(client, target.id)
    await editTwice(client, sibling.id)
    const siblingRevision = (await revisionRows(sibling.id))[0]!

    // Same author owns both posts, so only the post/revision mismatch can refuse this.
    const res = await client.post(`/posts/${target.id}/revisions/${siblingRevision.id}/restore`)
    expect(res.status).toBe(404)
    expect(contentOf(await Post.find(target.id))).toEqual(THIRD)
    expect(await revisionRows(target.id)).toHaveLength(2)
    expect(await revisionRows(sibling.id)).toHaveLength(2)

    // Another user's revision must never be copied onto the author's post either.
    const stranger = await makeUser()
    const theirs = await makePost(stranger.id, { title: 'Stranger title', excerpt: 'Stranger excerpt', body: 'Stranger body.' })
    await editTwice(await asUser(http, stranger), theirs.id)
    const theirRevision = (await revisionRows(theirs.id))[0]!
    const crossUser = await client.post(`/posts/${target.id}/revisions/${theirRevision.id}/restore`)
    expect([403, 404]).toContain(crossUser.status)
    expect(contentOf(await Post.find(target.id))).toEqual(THIRD)
    expect(await revisionRows(target.id)).toHaveLength(2)
  }, TIMEOUT_MS)

  it('removes a post\'s revisions when the post is deleted', async () => {
    const author = await makeUser()
    const client = await asUser(http, author)
    const post = await makePost(author.id, ORIGINAL)
    const kept = await makePost(author.id, ORIGINAL)
    await editTwice(client, post.id)
    await editTwice(client, kept.id)
    expect(await revisionRows(post.id)).toHaveLength(2)

    const res = await client.delete(`/posts/${post.id}`)
    expect([302, 303]).toContain(res.status)
    expect(await Post.find(post.id)).toBeNull()
    expect(await revisionRows(post.id)).toHaveLength(0)
    expect(await revisionRows(kept.id)).toHaveLength(2)
  }, TIMEOUT_MS)
})
