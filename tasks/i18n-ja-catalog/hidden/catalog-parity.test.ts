import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * The app keeps its translation catalogs under lang/<locale>/*.json (nested
 * objects; dot-joined keys). A Japanese catalog must exist and mirror the
 * English one key for key, and every interpolation placeholder in an English
 * string must survive into its Japanese counterpart — otherwise some page
 * silently falls back to English (or renders a broken placeholder) for a
 * Japanese visitor.
 */
const LANG_DIR = join(import.meta.dir, '..', '..', 'lang')

type Catalog = Record<string, string>

function readCatalog(locale: string): Catalog {
  const root = join(LANG_DIR, locale)
  const flat: Catalog = {}
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.endsWith('.json')) continue
      // lang/ja/auth.json → namespace "auth"; lang/ja/x/y.json → "x.y"
      const namespace = relative(root, full).replace(/\.json$/, '').split('/').join('.')
      const parsed = JSON.parse(readFileSync(full, 'utf8')) as unknown
      flatten(parsed, namespace, flat)
    }
  }
  walk(root)
  return flat
}

function flatten(value: unknown, prefix: string, into: Catalog): void {
  if (typeof value === 'string') {
    into[prefix] = value
    return
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, into)
    }
  }
}

/** `:name` and `{name}` placeholders in a message. */
function placeholders(message: string): string[] {
  const found = new Set<string>()
  for (const match of message.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)|\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) {
    found.add(match[1] ?? match[2]!)
  }
  return [...found].sort()
}

describe('translation catalogs', () => {
  it('ship a Japanese catalog next to the English one', () => {
    const locales = readdirSync(LANG_DIR).filter((entry) => statSync(join(LANG_DIR, entry)).isDirectory())
    expect(locales).toContain('en')
    expect(locales).toContain('ja')
  })

  it('cover the login and register copy in English', () => {
    const en = readCatalog('en')
    const values = Object.values(en)
    // The page copy must come from the catalog, not be hard-coded in the page.
    for (const text of ['Sign in', 'Email', 'Password', 'Create an account', 'Name', 'Confirm password']) {
      expect(values).toContain(text)
    }
  })

  it('cover the login and register copy in Japanese', () => {
    const ja = readCatalog('ja')
    const values = Object.values(ja)
    for (const text of [
      'ログイン',
      'メールアドレス',
      'パスワード',
      'ログイン状態を保持する',
      'アカウント登録',
      '名前',
      'パスワード（確認）',
      '登録',
    ]) {
      expect(values).toContain(text)
    }
  })

  it('have exactly the same keys in Japanese as in English', () => {
    const en = readCatalog('en')
    const ja = readCatalog('ja')
    expect(Object.keys(en).length).toBeGreaterThan(0)

    const enKeys = Object.keys(en).sort()
    const jaKeys = Object.keys(ja).sort()
    const missingInJa = enKeys.filter((key) => !(key in ja))
    const missingInEn = jaKeys.filter((key) => !(key in en))
    expect(missingInJa).toEqual([])
    expect(missingInEn).toEqual([])
  })

  it('keep every placeholder of an English string in its Japanese translation', () => {
    const en = readCatalog('en')
    const ja = readCatalog('ja')
    for (const [key, message] of Object.entries(en)) {
      const jaMessage = ja[key]
      if (jaMessage === undefined) continue // reported by the parity test
      expect({ key, placeholders: placeholders(jaMessage) }).toEqual({ key, placeholders: placeholders(message) })
    }
  })

  it('translate the pre-existing welcome message', () => {
    const en = readCatalog('en')
    const ja = readCatalog('ja')
    // messages.welcome existed in English before this change; its Japanese
    // counterpart must exist and keep the :name placeholder.
    expect(en['messages.welcome']).toBeDefined()
    expect(ja['messages.welcome']).toBeDefined()
    expect(ja['messages.welcome']).not.toBe(en['messages.welcome'])
    expect(placeholders(ja['messages.welcome']!)).toEqual(['name'])
  })
})
