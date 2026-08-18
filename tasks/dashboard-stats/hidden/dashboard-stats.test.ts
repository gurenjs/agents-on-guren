import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { Post } from '../../app/Models/Post.js'
import { asUser, freshApp, makeUser } from './_helpers.js'

interface DashboardProps {
  postCount: number
  recentPosts: Array<{ id: number; title: string }>
}

/**
 * Create `count` posts for `authorId`, each strictly newer than the last, and
 * return them oldest first. Explicit `createdAt` values keep "most recently
 * created" unambiguous whether a solution orders by the timestamp or by id.
 */
async function makePostsFor(authorId: number, count: number, label: string, startAt: number) {
  const created: Array<{ id: number; title: string }> = []
  for (let i = 1; i <= count; i++) {
    const post = await Post.forceCreate({
      title: `${label} post ${i}`,
      excerpt: `Excerpt ${i}`,
      body: `Body ${i}`,
      authorId,
      createdAt: new Date(startAt + i * 60_000).toISOString(),
    })
    if (!post) throw new Error('forceCreate returned null')
    created.push({ id: post.id, title: post.title })
  }
  return created
}

/** Fetch /dashboard as Inertia for `user` and return the page props (JSON, not the HTML shell). */
async function dashboardProps(http: TestApp, user: { id: number }): Promise<DashboardProps> {
  const res = await (await asUser(http, user)).withHeaders({ 'X-Inertia': 'true' }).get('/dashboard')
  expect(res.status).toBe(200)
  const json = (await res.json()) as { component: string; props: DashboardProps }
  expect(json.component).toBe('dashboard/Index')
  return json.props
}

const onlyIdAndTitle = (posts: Array<{ id: number; title: string }>) =>
  posts.map((post) => ({ id: post.id, title: post.title }))

describe('GET /dashboard post stats', () => {
  let http: TestApp
  // A fixed instant well in the past, so fixture timestamps never collide
  // with rows created "now" by anything else.
  const BASE = Date.parse('2024-01-01T00:00:00.000Z')

  beforeAll(async () => {
    http = await freshApp()
  })

  it('reports the total post count and the 5 most recent posts, newest first', async () => {
    const author = await makeUser()
    const mine = await makePostsFor(author.id, 7, 'Mine', BASE)

    const props = await dashboardProps(http, author)

    expect(props.postCount).toBe(7)
    expect(props.recentPosts).toHaveLength(5)
    expect(onlyIdAndTitle(props.recentPosts)).toEqual([...mine].reverse().slice(0, 5))
  })

  it('does not count or list other users\' posts', async () => {
    const author = await makeUser()
    const other = await makeUser()
    const mine = await makePostsFor(author.id, 3, 'Mine', BASE)
    // The other user's posts are newer than every one of the author's — a
    // query that forgets to scope by author would list these first.
    const theirs = await makePostsFor(other.id, 4, 'Theirs', BASE + 60 * 60_000)

    const props = await dashboardProps(http, author)

    expect(props.postCount).toBe(3)
    expect(onlyIdAndTitle(props.recentPosts)).toEqual([...mine].reverse())
    const theirIds = new Set(theirs.map((post) => post.id))
    for (const post of props.recentPosts) {
      expect(theirIds.has(post.id)).toBe(false)
    }

    const otherProps = await dashboardProps(http, other)
    expect(otherProps.postCount).toBe(4)
    expect(onlyIdAndTitle(otherProps.recentPosts)).toEqual([...theirs].reverse())
  })

  it('reports zero posts and an empty list for a user without posts', async () => {
    const author = await makeUser()

    const props = await dashboardProps(http, author)

    expect(props.postCount).toBe(0)
    expect(props.recentPosts).toEqual([])
  })

  it('still keeps the dashboard signed-in only', async () => {
    const res = await http.get('/dashboard')
    expect([302, 303, 401, 403]).toContain(res.status)
    if (res.status === 302 || res.status === 303) {
      expect(res.headers.get('location') ?? '').toContain('/login')
    }
  })
})
