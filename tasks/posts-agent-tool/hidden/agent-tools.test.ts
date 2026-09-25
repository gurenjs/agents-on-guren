import { beforeEach, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { freshApp, makePost, makeUser } from './_helpers.js'
import { postRowsByTitle } from './_posts-agent-db.js'

// Tools are called through the test app's agent surface, which derives them from
// the app's routes exactly as the MCP endpoint does and dispatches each call back
// into the app as a request. `{ as: user }` authenticates the call as that user.
// Mutating calls go through withCsrf(): a dispatched call carries no cookie, so
// without it the site's cross-site request protection answers 403 before any
// authentication or policy is consulted, and the anonymous case would pass for
// the wrong reason.

let http: TestApp

beforeEach(async () => {
  http = await freshApp()
})

/** Not an error result; on failure the diff shows what the app answered. */
function expectSuccess(result: { isError: boolean; status: number; text: string }) {
  expect({ isError: result.isError, answer: result.isError ? `${result.status} ${result.text}` : '' }).toEqual({
    isError: false,
    answer: '',
  })
}

function toolPayload(result: { structuredContent?: Record<string, unknown>; json<T>(): T }): unknown {
  return result.structuredContent ?? result.json()
}

describe('posts_search tool', () => {
  it('returns the matching posts in the same shape the search request answers with', async () => {
    const author = await makeUser()
    const first = await makePost(author.id, { title: 'Bun runtime notes' })
    await makePost(author.id, { title: 'Gardening in spring', excerpt: 'Tomatoes and beans' })
    const second = await makePost(author.id, { title: 'Why we like it', excerpt: 'A bun story' })

    const result = await http.agent().call('posts_search', { keywords: ['bun'] })
    expectSuccess(result)
    const payload = toolPayload(result) as { data: Array<{ id: number }> }

    const direct = await http.query('/posts/search', { keywords: ['bun'] })
    expect(direct.status).toBe(200)
    expect(payload).toEqual(await direct.json())
    expect(payload.data.map((post) => post.id).sort()).toEqual([first.id, second.id].sort())
  })

  it('answers a guest caller too, since searching changes nothing', async () => {
    const author = await makeUser()
    const post = await makePost(author.id, { title: 'Agents and blogs' })
    const result = await http.agent().call('posts_search', { keywords: ['agents'] })
    expectSuccess(result)
    const payload = toolPayload(result) as { data: Array<{ id: number; title: string }> }
    expect(payload.data.map((row) => [row.id, row.title])).toEqual([[post.id, 'Agents and blogs']])
  })
})

describe('posts_store tool', () => {
  it('creates a post authored by the calling user, whatever authorId the input carries', async () => {
    const caller = await makeUser()
    const other = await makeUser()
    const client = await http.withCsrf()

    const result = await client.agent().call(
      'posts_store',
      { title: 'Drafted by my assistant', excerpt: 'An excerpt', body: 'A body', authorId: other.id },
      { as: caller },
    )
    expectSuccess(result)
    const rows = await postRowsByTitle('Drafted by my assistant')
    expect(rows.map((row) => row.author_id)).toEqual([caller.id])
  })

  it('rejects input the web form would reject, and creates nothing', async () => {
    const caller = await makeUser()
    const client = await http.withCsrf()
    const result = await client.agent().call('posts_store', { title: '', excerpt: 'An excerpt', body: 'A body' }, { as: caller })
    expect(result.isError).toBe(true)
    expect(result.status).toBe(422)
    expect(await postRowsByTitle('')).toEqual([])
  })

  it('refuses a caller that is not signed in, and creates nothing', async () => {
    const client = await http.withCsrf()
    const result = await client.agent().call('posts_store', { title: 'Anonymous draft', excerpt: 'An excerpt', body: 'A body' })

    // Either an explicit refusal, or the web form's own answer to a guest (a
    // redirect to /login); never a success that created something.
    const location = result.response.headers.get('location')
    const toLogin =
      result.status >= 300 && result.status < 400 && location !== null && new URL(location, 'http://localhost').pathname === '/login'
    expect({ status: result.status, refused: [401, 403].includes(result.status) || toLogin }).toEqual({
      status: result.status,
      refused: true,
    })
    expect(await postRowsByTitle('Anonymous draft')).toEqual([])
  })
})
