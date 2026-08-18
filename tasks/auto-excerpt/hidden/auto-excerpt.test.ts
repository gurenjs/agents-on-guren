import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { Post } from '../../app/Models/Post.js'
import { asUser, freshApp, makePost, makeUser } from './_helpers.js'

const ELLIPSIS = '…'
const LIMIT = 140

/**
 * The derivation rule exactly as the statement words it: trim the body; a
 * body within the limit is used whole; otherwise keep the first `LIMIT`
 * characters, and if character LIMIT+1 falls inside a word, back up to the
 * last whitespace before it; trim trailing whitespace; append an ellipsis.
 * Kept independent of the reference solution so the tests assert the
 * statement, not an implementation.
 */
function expectedExcerpt(body: string): string {
  const text = body.trim()
  if (text.length <= LIMIT) return text
  let head = text.slice(0, LIMIT)
  if (!/\s/.test(text.charAt(LIMIT))) {
    const lastSpace = head.search(/\s\S*$/)
    if (lastSpace > 0) head = head.slice(0, lastSpace)
  }
  return `${head.trimEnd()}${ELLIPSIS}`
}

// 300 characters; character 141 falls inside the word "the", so the cut backs
// up to the space after "moves".
const BODY_300 =
  'Every benchmark fixture is written by hand and its length is counted twice before anyone trusts it, because a single stray character moves the boundary. ' +
  'Every benchmark fixture is written by hand and its length is counted twice before anyone trusts it, because a single stray character moves the boun'
const EXCERPT_300 =
  'Every benchmark fixture is written by hand and its length is counted twice before anyone trusts it, because a single stray character moves' + ELLIPSIS

// 170 characters; the first 140 end exactly at the end of "right" and
// character 141 is a space, so all 140 are kept and the ellipsis follows.
const BODY_WORD_BOUNDARY =
  'When a post is saved without an excerpt, the site now writes one for the author by keeping the opening of the body intact and stopping right at a space, then adds a mark.'
const EXCERPT_WORD_BOUNDARY =
  'When a post is saved without an excerpt, the site now writes one for the author by keeping the opening of the body intact and stopping right' + ELLIPSIS

// 139 characters: fits within the limit, used whole, no ellipsis.
const BODY_SHORT =
  'Exactly at the limit this sentence is tuned character by character until the counter reads the round number we need for the boundary check.'

async function reload(id: number) {
  const post = await Post.find(id)
  if (!post) throw new Error(`post ${id} vanished`)
  return post
}

/** Follow the redirect target `/posts/<id>` back to the created row. */
function createdIdFrom(res: Response): number {
  const location = res.headers.get('location') ?? ''
  const match = /\/posts\/(\d+)(?:[/?#]|$)/.exec(location)
  if (!match) throw new Error(`expected a redirect to /posts/<id>, got ${JSON.stringify(location)}`)
  return Number(match[1])
}

describe('auto-derived excerpt', () => {
  let http: TestApp

  beforeAll(async () => {
    // Fixture sanity: the literals above must be what the statement's rule produces.
    expect(BODY_300).toHaveLength(300)
    expect(expectedExcerpt(BODY_300)).toBe(EXCERPT_300)
    expect(BODY_WORD_BOUNDARY).toHaveLength(170)
    expect(expectedExcerpt(BODY_WORD_BOUNDARY)).toBe(EXCERPT_WORD_BOUNDARY)
    expect(BODY_SHORT.length).toBeLessThanOrEqual(LIMIT)

    http = await freshApp()
  })

  it('creates a post without an excerpt and derives it from a 300-character body', async () => {
    const author = await makeUser()

    const res = await (await asUser(http, author)).post('/posts', {
      title: 'Derived from a long body',
      body: BODY_300,
    })
    expect([302, 303]).toContain(res.status)

    const post = await reload(createdIdFrom(res))
    expect(post.excerpt).toBe(EXCERPT_300)
    expect(post.excerpt).toBe(expectedExcerpt(BODY_300))
    expect(post.body).toBe(BODY_300)
    expect(post.authorId).toBe(author.id)
  })

  it('keeps all 140 characters when character 141 is a space, then appends the ellipsis', async () => {
    const author = await makeUser()

    const res = await (await asUser(http, author)).post('/posts', {
      title: 'Cut lands on a word boundary',
      body: BODY_WORD_BOUNDARY,
    })
    expect([302, 303]).toContain(res.status)

    const post = await reload(createdIdFrom(res))
    expect(post.excerpt).toBe(EXCERPT_WORD_BOUNDARY)
    expect(post.excerpt).toBe(expectedExcerpt(BODY_WORD_BOUNDARY))
  })

  it('uses a body of 140 characters or fewer whole, with no ellipsis', async () => {
    const author = await makeUser()

    const res = await (await asUser(http, author)).post('/posts', {
      title: 'Short body',
      body: BODY_SHORT,
    })
    expect([302, 303]).toContain(res.status)

    const post = await reload(createdIdFrom(res))
    expect(post.excerpt).toBe(BODY_SHORT)
    expect(post.excerpt).not.toContain(ELLIPSIS)
  })

  it('stores an explicit excerpt as given (trimmed) instead of deriving one', async () => {
    const author = await makeUser()

    const res = await (await asUser(http, author)).post('/posts', {
      title: 'Explicit excerpt wins',
      excerpt: '  A hand-written summary.  ',
      body: BODY_300,
    })
    expect([302, 303]).toContain(res.status)

    const post = await reload(createdIdFrom(res))
    expect(post.excerpt).toBe('A hand-written summary.')
  })

  it('treats a whitespace-only excerpt as empty and derives one', async () => {
    const author = await makeUser()

    const res = await (await asUser(http, author)).post('/posts', {
      title: 'Whitespace excerpt',
      excerpt: '   \n\t ',
      body: BODY_300,
    })
    expect([302, 303]).toContain(res.status)

    const post = await reload(createdIdFrom(res))
    expect(post.excerpt).toBe(EXCERPT_300)
  })

  it('re-derives the excerpt from the new body when an update leaves it empty', async () => {
    const author = await makeUser()
    const post = await makePost(author.id, { excerpt: 'The old hand-written excerpt' })

    const res = await (await asUser(http, author)).put(`/posts/${post.id}`, {
      title: 'Updated title',
      excerpt: '',
      body: BODY_300,
    })
    expect([302, 303]).toContain(res.status)

    const after = await reload(post.id)
    expect(after.title).toBe('Updated title')
    expect(after.body).toBe(BODY_300)
    expect(after.excerpt).toBe(EXCERPT_300)
  })

  it('re-derives on update when the excerpt field is omitted and the body is short', async () => {
    const author = await makeUser()
    const post = await makePost(author.id, { excerpt: 'The old hand-written excerpt' })

    const res = await (await asUser(http, author)).put(`/posts/${post.id}`, {
      title: 'Updated title',
      body: BODY_SHORT,
    })
    expect([302, 303]).toContain(res.status)

    const after = await reload(post.id)
    expect(after.excerpt).toBe(BODY_SHORT)
  })

  it('keeps an explicit excerpt on update', async () => {
    const author = await makeUser()
    const post = await makePost(author.id)

    const res = await (await asUser(http, author)).put(`/posts/${post.id}`, {
      title: 'Updated title',
      excerpt: 'Kept as written',
      body: BODY_300,
    })
    expect([302, 303]).toContain(res.status)

    const after = await reload(post.id)
    expect(after.excerpt).toBe('Kept as written')
  })

  it('still rejects an empty title with 422 and creates nothing', async () => {
    const author = await makeUser()
    const before = await Post.newQuery().count()

    const res = await (await asUser(http, author)).post('/posts', {
      title: '',
      body: BODY_300,
    })
    expect(res.status).toBe(422)
    expect(await Post.newQuery().count()).toBe(before)
  })

  it('still rejects an empty body with 422 (there is nothing to derive from)', async () => {
    const author = await makeUser()
    const before = await Post.newQuery().count()

    const res = await (await asUser(http, author)).post('/posts', {
      title: 'No body',
      body: '   ',
    })
    expect(res.status).toBe(422)
    expect(await Post.newQuery().count()).toBe(before)
  })
})
