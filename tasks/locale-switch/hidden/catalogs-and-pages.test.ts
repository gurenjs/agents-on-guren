import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const APP_ROOT = join(import.meta.dir, '..', '..')
const PAGES = join(APP_ROOT, 'resources', 'js', 'pages')

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

// Route names share the posts.* namespace (posts.search, posts.edit): the
// baseline already spells them in route('posts.edit', …) and
// api.request('posts.search', …). Those uses are removed before looking.
const ROUTE_NAME_USES = [/\b(route|request)\(\s*['"`][\w.]+['"`]/g, /\broute=\{?\s*['"`][\w.]+['"`]/g]

/** A quoted occurrence of `key` ('…', "…" or `…`) that is not a route name, the way t('…') spells it. */
function referencesKey(source: string, key: string): boolean {
  const withoutRouteNames = ROUTE_NAME_USES.reduce((text, pattern) => text.replace(pattern, ''), source)
  const escaped = key.replace(/\./g, '\\.')
  return new RegExp(`['"\`]${escaped}['"\`]`).test(withoutRouteNames)
}

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full))
    else if (/\.(tsx?|jsx?)$/.test(entry)) found.push(full)
  }
  return found
}

describe('translation catalogs', () => {
  it('ship a Japanese catalog next to the English one', () => {
    const ja = join(APP_ROOT, 'lang', 'ja')
    expect(existsSync(ja)).toBe(true)
    expect(readdirSync(ja).filter((entry) => entry.endsWith('.json')).length).toBeGreaterThan(0)
  })

  it('pass the project catalog check (every key in both languages)', () => {
    const proc = Bun.spawnSync(['bunx', 'guren', 'check', '--i18n'], {
      cwd: APP_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    })
    const output = `${proc.stdout.toString()}\n${proc.stderr.toString()}`
    expect({ exitCode: proc.exitCode, output }).toEqual({ exitCode: 0, output })
  }, 60_000)
})

describe('posts pages read their labels from the catalogs', () => {
  it('the posts list page uses posts.search', () => {
    expect(referencesKey(read(join(PAGES, 'posts', 'Index.tsx')), 'posts.search')).toBe(true)
  })

  it('the post page uses posts.edit and posts.delete', () => {
    const show = read(join(PAGES, 'posts', 'Show.tsx'))
    expect(referencesKey(show, 'posts.edit')).toBe(true)
    expect(referencesKey(show, 'posts.delete')).toBe(true)
  })

  it('no page or component hard-codes 記事', () => {
    const offenders = sourceFiles(join(APP_ROOT, 'resources', 'js'))
      .filter((file) => read(file).includes('記事'))
      .map((file) => relative(APP_ROOT, file))
    expect(offenders).toEqual([])
  })
})
