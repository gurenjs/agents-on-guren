import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'

// The ticket pins where the feature lives (modules/newsletter/), that the blog's
// app/ and routes/ import nothing from it, that an architecture rule enforces
// that, and that the project's integrity check passes. The check runs as the
// CLI the project ships, in this worktree.

const ROOT = join(import.meta.dir, '..', '..')
const MODULE = join(ROOT, 'modules', 'newsletter')
const CLI_TIMEOUT_MS = 120_000

// Probes import the module's public entry points, which the built-in module
// boundary rule allows, so only a rule the solution declared can reject them.
const PROBES = [
  { path: join(ROOT, 'app', 'NewsletterArchProbe.ts'), source: "import { newsletterModule } from '../modules/newsletter/index.js'\nexport const probe = newsletterModule\n" },
  { path: join(ROOT, 'routes', 'newsletter-arch-probe.ts'), source: "import * as newsletterTables from '../modules/newsletter/db/schema.js'\nexport const probe = newsletterTables\n" },
]

interface CheckResult {
  key: string
  status: 'pass' | 'warn' | 'fail' | string
  message?: string
  filePath?: string
}

interface CheckReport {
  checks: CheckResult[]
  failCount: number
}

let runSeq = 0

/** `guren check --json [...]`; stdout goes to a file, not a pipe. */
async function guren(args: string[]): Promise<{ exitCode: number; report: CheckReport | null; raw: string }> {
  runSeq += 1
  const out = join(tmpdir(), `newsletter-check-${process.pid}-${runSeq}.json`)
  const err = join(tmpdir(), `newsletter-check-${process.pid}-${runSeq}.err`)
  const proc = Bun.spawn(['bunx', 'guren', 'check', '--json', ...args], {
    cwd: ROOT,
    env: { ...process.env },
    stdout: Bun.file(out),
    stderr: Bun.file(err),
  })
  const exitCode = await proc.exited
  const raw = existsSync(out) ? readFileSync(out, 'utf8') : ''
  rmSync(out, { force: true })
  rmSync(err, { force: true })
  let report: CheckReport | null = null
  try {
    report = JSON.parse(raw) as CheckReport
  } catch {
    report = null
  }
  return { exitCode, report, raw }
}

function failures(report: CheckReport | null): CheckResult[] {
  return (report?.checks ?? []).filter((check) => check.status === 'fail')
}

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full))
    else if (/\.(ts|tsx|js|jsx|mts|mjs)$/.test(entry)) found.push(full)
  }
  return found
}

function removeProbes() {
  for (const probe of PROBES) rmSync(probe.path, { force: true })
}

describe('newsletter module wiring', () => {
  afterEach(removeProbes)

  it('lives in modules/newsletter with its own entry point, routes file and schema', () => {
    expect(existsSync(join(MODULE, 'index.ts'))).toBe(true)
    const routesFile = existsSync(join(MODULE, 'routes.ts'))
    const routesDir = existsSync(join(MODULE, 'routes')) && sourceFiles(join(MODULE, 'routes')).length > 0
    expect(routesFile || routesDir).toBe(true)
    expect(existsSync(join(MODULE, 'db', 'schema.ts'))).toBe(true)
  })

  it('declares newsletter_subscriptions in the module schema, not in the root schema', () => {
    const moduleSchema = readFileSync(join(MODULE, 'db', 'schema.ts'), 'utf8')
    expect(moduleSchema).toContain('newsletter_subscriptions')
    const rootSchema = readFileSync(join(ROOT, 'db', 'schema.ts'), 'utf8')
    expect(rootSchema).not.toMatch(/['"`]newsletter_subscriptions['"`]/)
  })

  it('registers the module with the application in src/app.ts', () => {
    const app = readFileSync(join(ROOT, 'src', 'app.ts'), 'utf8')
    expect(app).toMatch(/from\s+['"][^'"]*modules\/newsletter(\/index(\.[jt]s)?)?['"]/)
    expect(app).toMatch(/\bmodules\s*:/)
  })

  it('the blog code in app/ and routes/ imports nothing from the module', () => {
    const probePaths = new Set(PROBES.map((probe) => probe.path))
    const importsModule = /(from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)['"`][^'"`]*modules\/newsletter[^'"`]*['"`]/
    const offenders = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'routes'))]
      .filter((file) => !probePaths.has(file))
      .filter((file) => importsModule.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file))
    expect(offenders).toEqual([])
  })

  it('the integrity check passes with no failures', async () => {
    const { exitCode, report, raw } = await guren([])
    expect(report, raw.slice(0, 2000)).not.toBeNull()
    expect(failures(report)).toEqual([])
    expect(exitCode).toBe(0)
  }, CLI_TIMEOUT_MS)

  it('the architecture check passes with no failures', async () => {
    const { exitCode, report, raw } = await guren(['--arch'])
    expect(report, raw.slice(0, 2000)).not.toBeNull()
    expect(failures(report)).toEqual([])
    expect(exitCode).toBe(0)
  }, CLI_TIMEOUT_MS)

  for (const probe of PROBES) {
    const where = relative(ROOT, probe.path)
    it(`the architecture check rejects ${where} importing the module`, async () => {
      try {
        writeFileSync(probe.path, probe.source)
        const { exitCode, report, raw } = await guren(['--arch'])
        expect(report, raw.slice(0, 2000)).not.toBeNull()
        const blamed = failures(report).filter((check) =>
          check.filePath === where || (check.message ?? '').includes(where) || check.key.includes(where),
        )
        expect(blamed.length).toBeGreaterThan(0)
        expect(exitCode).not.toBe(0)
      } finally {
        removeProbes()
      }
    }, CLI_TIMEOUT_MS)
  }
})
