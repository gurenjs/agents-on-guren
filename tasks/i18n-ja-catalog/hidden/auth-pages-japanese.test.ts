import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import type { InertiaSsrContext } from '@guren/core'
import renderSsr from '../../resources/js/ssr.js'
import { freshApp } from './_helpers.js'

/**
 * Fetch `path` (optionally with an Accept-Language header), then render the
 * page the way the app's own server-side renderer does — the real React
 * component with the real props the server sent. Assertions run against the
 * resulting markup (head + body), so they see exactly what a visitor would.
 *
 * All matchers below are structural (`<tag>text</tag>` / `>text<`) rather
 * than plain substring checks: the SSR body embeds the page props as JSON
 * (which may legitimately carry both language catalogs), so only text that
 * actually renders as markup may count.
 */
async function renderPage(http: TestApp, path: string, acceptLanguage?: string) {
  const headers: Record<string, string> = { 'X-Inertia': 'true' }
  if (acceptLanguage !== undefined) headers['Accept-Language'] = acceptLanguage
  const res = await http.withHeaders(headers).get(path)
  expect(res.status).toBe(200)
  const page = (await res.json()) as InertiaSsrContext['page']
  const out = await renderSsr({ page })
  return [...out.head, out.body].join('\n')
}

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** `<tag ...>text</tag>` with optional surrounding whitespace, any attributes. */
const element = (tag: string, text: string) =>
  new RegExp(`<${tag}\\b[^>]*>\\s*${escapeRe(text)}\\s*</${tag}>`)

/** A rendered text node that is exactly `text` (label copy, list text, …). */
const textNode = (text: string) => new RegExp(`>\\s*${escapeRe(text)}\\s*<`)

function expectJapaneseLogin(html: string) {
  expect(html).toMatch(element('title', 'ログイン'))
  expect(html).toMatch(element('h1', 'ログイン'))
  expect(html).toMatch(textNode('メールアドレス'))
  expect(html).toMatch(textNode('パスワード'))
  expect(html).toMatch(textNode('ログイン状態を保持する'))
  expect(html).toMatch(element('button', 'ログイン'))
  // No half-translated page: the old English copy must not render anywhere.
  expect(html).not.toMatch(element('h1', 'Sign in'))
  expect(html).not.toMatch(element('button', 'Sign in'))
  expect(html).not.toMatch(textNode('Email'))
  expect(html).not.toMatch(textNode('Password'))
  expect(html).not.toMatch(textNode('Remember me'))
}

function expectEnglishLogin(html: string) {
  expect(html).toMatch(element('h1', 'Sign in'))
  expect(html).toMatch(textNode('Email'))
  expect(html).toMatch(textNode('Password'))
  expect(html).toMatch(textNode('Remember me'))
  expect(html).not.toMatch(element('h1', 'ログイン'))
  expect(html).not.toMatch(textNode('メールアドレス'))
  expect(html).not.toMatch(textNode('パスワード'))
}

function expectJapaneseRegister(html: string) {
  expect(html).toMatch(element('title', 'アカウント登録'))
  expect(html).toMatch(element('h1', 'アカウント登録'))
  expect(html).toMatch(textNode('名前'))
  expect(html).toMatch(textNode('メールアドレス'))
  expect(html).toMatch(textNode('パスワード'))
  expect(html).toMatch(textNode('パスワード（確認）'))
  expect(html).toMatch(element('button', '登録'))
  expect(html).not.toMatch(element('h1', 'Create an account'))
  expect(html).not.toMatch(element('button', 'Create account'))
  expect(html).not.toMatch(textNode('Name'))
  expect(html).not.toMatch(textNode('Email'))
  expect(html).not.toMatch(textNode('Password'))
  expect(html).not.toMatch(textNode('Confirm password'))
}

function expectEnglishRegister(html: string) {
  expect(html).toMatch(element('h1', 'Create an account'))
  expect(html).toMatch(textNode('Name'))
  expect(html).toMatch(textNode('Email'))
  expect(html).toMatch(textNode('Password'))
  expect(html).toMatch(textNode('Confirm password'))
  expect(html).not.toMatch(element('h1', 'アカウント登録'))
  expect(html).not.toMatch(textNode('名前'))
  expect(html).not.toMatch(textNode('メールアドレス'))
}

describe('login and register pages honour Accept-Language', () => {
  let http: TestApp

  beforeAll(async () => {
    http = await freshApp()
  })

  describe('GET /login', () => {
    it('renders Japanese title, heading, labels and button for Accept-Language: ja', async () => {
      expectJapaneseLogin(await renderPage(http, '/login', 'ja'))
    })

    it('renders Japanese for a browser-style header that prefers Japanese', async () => {
      expectJapaneseLogin(await renderPage(http, '/login', 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'))
    })

    it('stays English without an Accept-Language header', async () => {
      expectEnglishLogin(await renderPage(http, '/login'))
    })

    it('stays English when the browser prefers English or an unsupported language', async () => {
      expectEnglishLogin(await renderPage(http, '/login', 'en-US,en;q=0.9'))
      expectEnglishLogin(await renderPage(http, '/login', 'fr-FR,fr;q=0.9'))
    })

    it('renders English when English outranks Japanese in the header', async () => {
      expectEnglishLogin(await renderPage(http, '/login', 'en-US,en;q=0.9,ja;q=0.5'))
    })
  })

  describe('GET /register', () => {
    it('renders Japanese title, heading, labels and button for Accept-Language: ja', async () => {
      expectJapaneseRegister(await renderPage(http, '/register', 'ja'))
    })

    it('renders Japanese for a browser-style header that prefers Japanese', async () => {
      expectJapaneseRegister(await renderPage(http, '/register', 'ja-JP,ja;q=0.9,en;q=0.8'))
    })

    it('stays English without an Accept-Language header', async () => {
      expectEnglishRegister(await renderPage(http, '/register'))
    })

    it('stays English when the browser prefers English', async () => {
      expectEnglishRegister(await renderPage(http, '/register', 'en-US,en;q=0.9'))
    })
  })
})
