import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { freshApp, makeUser } from './_helpers.js'
import { Browser, locationPath, messageAt } from './_locale-browser.js'

// The contract's nine keys and their Japanese values, verbatim from the ticket.
const PINNED_JA: Record<string, string> = {
  'nav.home': 'ホーム',
  'nav.posts': '記事',
  'nav.dashboard': 'ダッシュボード',
  'posts.new': '新規投稿',
  'posts.edit': '編集',
  'posts.delete': '削除',
  'posts.search': '検索',
  'auth.login': 'ログイン',
  'auth.logout': 'ログアウト',
}

describe('language switch', () => {
  let http: TestApp

  beforeAll(async () => {
    http = await freshApp()
  })

  it('switches a visitor to Japanese, redirects back to the Referer, and later pages are Japanese', async () => {
    const browser = new Browser(http)
    expect((await browser.i18n('/')).locale).toBe('en')

    const res = await browser.post('/locale', { locale: 'ja' }, { Referer: 'http://localhost/posts' })
    expect([302, 303]).toContain(res.status)
    expect(locationPath(res)).toBe('/posts')

    const i18n = await browser.i18n('/')
    expect(i18n.locale).toBe('ja')
    expect(messageAt(i18n, 'ja', 'nav.posts')).toBe('記事')
  })

  it('redirects to / when the request carries no Referer', async () => {
    const browser = new Browser(http)
    const res = await browser.post('/locale', { locale: 'ja' })
    expect([302, 303]).toContain(res.status)
    expect(locationPath(res)).toBe('/')
    expect((await browser.i18n('/')).locale).toBe('ja')
  })

  it('lets a signed-in user switch as well, sending them back where they were', async () => {
    const user = await makeUser()
    const browser = new Browser(http.actingAs(user))

    const res = await browser.post('/locale', { locale: 'ja' }, { Referer: 'http://localhost/posts' })
    expect([302, 303]).toContain(res.status)
    expect(locationPath(res)).toBe('/posts')

    const i18n = await browser.i18n('/dashboard')
    expect(i18n.locale).toBe('ja')
    expect(messageAt(i18n, 'ja', 'nav.dashboard')).toBe('ダッシュボード')
  })

  it('shares every pinned key with its Japanese value once Japanese is chosen', async () => {
    const browser = new Browser(http)
    await browser.post('/locale', { locale: 'ja' })
    const i18n = await browser.i18n('/posts')
    expect(i18n.locale).toBe('ja')
    const shared = Object.fromEntries(Object.keys(PINNED_JA).map((key) => [key, messageAt(i18n, 'ja', key)]))
    expect(shared).toEqual(PINNED_JA)
  })

  it('has real English text for the same keys', async () => {
    const i18n = await new Browser(http).i18n('/posts')
    expect(i18n.locale).toBe('en')
    for (const [key, japanese] of Object.entries(PINNED_JA)) {
      const english = messageAt(i18n, 'en', key)
      expect({ key, isText: typeof english === 'string' && english.trim().length > 0 }).toEqual({ key, isText: true })
      expect({ key, english }).not.toEqual({ key, english: japanese })
    }
  })

  it('rejects an unsupported language the way an invalid post title is rejected, and keeps the current choice', async () => {
    const browser = new Browser(http)
    await browser.post('/locale', { locale: 'ja' })

    // A plain (non-Inertia) form post: the baseline answers an invalid post title with 422.
    const res = await browser.post('/locale', { locale: 'fr' }, { Referer: 'http://localhost/posts' })
    expect(res.status).toBe(422)
    expect((await browser.i18n('/')).locale).toBe('ja')

    const fresh = new Browser(http)
    expect((await fresh.post('/locale', { locale: 'fr' })).status).toBe(422)
    expect((await fresh.i18n('/')).locale).toBe('en')
  })

  it("follows the browser's Accept-Language when no language was chosen", async () => {
    const browser = new Browser(http)
    const ja = await browser.i18n('/', { 'Accept-Language': 'ja' })
    expect(ja.locale).toBe('ja')
    expect(messageAt(ja, 'ja', 'nav.posts')).toBe('記事')

    expect((await browser.i18n('/', { 'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7' })).locale).toBe('ja')
    expect((await browser.i18n('/', { 'Accept-Language': 'en-US,en;q=0.9' })).locale).toBe('en')
    expect((await browser.i18n('/')).locale).toBe('en')
  })

  it("keeps an explicit choice over the browser's Accept-Language", async () => {
    const browser = new Browser(http)
    const res = await browser.post('/locale', { locale: 'en' }, { 'Accept-Language': 'ja' })
    expect([302, 303]).toContain(res.status)
    expect((await browser.i18n('/', { 'Accept-Language': 'ja' })).locale).toBe('en')
  })
})
