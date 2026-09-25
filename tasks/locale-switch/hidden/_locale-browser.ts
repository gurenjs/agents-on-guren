// A browser-like client for the locale tests. TestApp keeps no cookie jar:
// withCsrf() captures the Set-Cookie of one priming GET into a fixed Cookie
// header, and a later withHeaders({ Cookie }) would replace that header rather
// than add to it. So this helper keeps its own jar on top of a bare TestApp
// (or http.actingAs(user)): every response's Set-Cookie is merged in (a
// Max-Age=0 or past Expires deletes the cookie), every request sends the whole
// jar, and a mutating request also sends X-XSRF-TOKEN, decoded from the
// XSRF-TOKEN cookie exactly as withCsrf() does. The tests never read a cookie
// by name, so a solution may remember the choice in any cookie, or in the
// session, as long as a browser carrying its cookies sees it next time.
//
// On the baseline the shared Inertia prop `_i18n` is already present on every
// Inertia response: `{ locale, fallbackLocale, messages: { <locale>: { <file>:
// { <key>: string } } } }`, the catalogs keyed by locale, then by lang/ file
// name, then by nested key. messageAt() walks a dot key through that tree.
import type { TestApp } from '@guren/testing'
import { expect } from 'bun:test'

export interface I18nProp {
  locale: string
  fallbackLocale?: string
  messages: Record<string, unknown>
}

export class Browser {
  private readonly jar = new Map<string, string>()

  constructor(private readonly http: TestApp) {}

  private absorb(res: { headers: Headers }): void {
    for (const raw of res.headers.getSetCookie()) {
      const [pair, ...attributes] = raw.split(';')
      const separator = pair!.indexOf('=')
      if (separator <= 0) continue
      const name = pair!.slice(0, separator).trim()
      const value = pair!.slice(separator + 1).trim()
      const expired = attributes.some((attribute) => {
        const [key, rawValue = ''] = attribute.split('=')
        const k = key!.trim().toLowerCase()
        if (k === 'max-age') return Number(rawValue.trim()) <= 0
        if (k === 'expires') return Date.parse(rawValue.trim()) <= Date.now()
        return false
      })
      if (expired) this.jar.delete(name)
      else this.jar.set(name, value)
    }
  }

  private headers(extra: Record<string, string>, mutating: boolean): Record<string, string> {
    const headers: Record<string, string> = { ...extra }
    if (this.jar.size > 0) {
      headers.Cookie = [...this.jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
    }
    const xsrf = this.jar.get('XSRF-TOKEN')
    if (mutating && xsrf !== undefined) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf)
    return headers
  }

  async get(path: string, extra: Record<string, string> = {}): Promise<Response> {
    const res = await this.http.withHeaders(this.headers(extra, false)).get(path)
    this.absorb(res)
    return res
  }

  async post(path: string, body: unknown, extra: Record<string, string> = {}): Promise<Response> {
    if (!this.jar.has('XSRF-TOKEN')) await this.get('/')
    const res = await this.http.withHeaders(this.headers(extra, true)).post(path, body)
    this.absorb(res)
    return res
  }

  /** GET `path` as an Inertia visit and return the shared `_i18n` prop. */
  async i18n(path = '/', extra: Record<string, string> = {}): Promise<I18nProp> {
    const res = await this.get(path, { ...extra, 'X-Inertia': 'true' })
    expect(res.status).toBe(200)
    const page = (await res.json()) as { props: { _i18n?: I18nProp } }
    expect(page.props._i18n).toBeDefined()
    return page.props._i18n!
  }
}

/** The value `key` (dot-separated) resolves to in `locale`'s shared catalog. */
export function messageAt(i18n: I18nProp, locale: string, key: string): unknown {
  let node: unknown = i18n.messages[locale]
  for (const segment of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[segment]
  }
  return node
}

/** Location may be relative or absolute; compare the path only. */
export function locationPath(res: { headers: Headers }): string | null {
  const location = res.headers.get('location')
  return location === null ? null : new URL(location, 'http://localhost').pathname
}
