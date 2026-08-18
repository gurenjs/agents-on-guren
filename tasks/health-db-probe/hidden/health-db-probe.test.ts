import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TestApp } from '@guren/testing'
import { closeDatabase, configureOrm } from '../../config/database.js'
import { freshApp } from './_helpers.js'

// The statement leaves the vocabulary open: `ok`/`healthy` for a passing
// check, `error`/`unhealthy` for a failing one, and the checks either keyed
// by name or listed with a `name` field. Everything below accepts both forms.
const HEALTHY = ['ok', 'healthy']
const UNHEALTHY = ['error', 'unhealthy']
const DB_NAMES = ['db', 'database']

type CheckEntry = { status?: unknown; name?: unknown }

function findDbCheck(body: Record<string, unknown>): CheckEntry | null {
  const checks = body.checks
  if (Array.isArray(checks)) {
    const hit = checks.find(
      (entry) => entry && typeof entry === 'object' && DB_NAMES.includes(String((entry as CheckEntry).name)),
    )
    return (hit as CheckEntry | undefined) ?? null
  }
  if (checks && typeof checks === 'object') {
    for (const name of DB_NAMES) {
      const entry = (checks as Record<string, unknown>)[name]
      if (entry && typeof entry === 'object') return entry as CheckEntry
    }
  }
  return null
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  expect(res.headers.get('content-type') ?? '').toContain('application/json')
  const body = (await res.json()) as unknown
  expect(body && typeof body === 'object' && !Array.isArray(body)).toBe(true)
  return body as Record<string, unknown>
}

describe('GET /health', () => {
  let http: TestApp

  beforeAll(async () => {
    http = await freshApp()
  })

  it('answers 200 with an overall status and a healthy database check', async () => {
    const res = await http.get('/health')
    expect(res.status).toBe(200)

    const body = await readJson(res)
    expect(HEALTHY).toContain(String(body.status).toLowerCase())

    const db = findDbCheck(body)
    expect(db).not.toBeNull()
    expect(HEALTHY).toContain(String(db!.status).toLowerCase())
  })

  it('reports the same shape on a second probe (no one-shot state)', async () => {
    const first = await readJson(await http.get('/health'))
    const second = await readJson(await http.get('/health'))
    expect(HEALTHY).toContain(String(second.status).toLowerCase())
    expect(findDbCheck(first)).not.toBeNull()
    expect(findDbCheck(second)).not.toBeNull()
  })

  describe('when the database is unreachable', () => {
    const originalTestUrl = process.env.TEST_DATABASE_URL
    let brokenPath = ''

    beforeAll(async () => {
      // Point the app's SQLite file at a directory (SQLite cannot open one as
      // a database) and drop the live connection, so both a connection
      // resolved per request and the ORM's configured handle fail on the next
      // query. `config/database.ts` reads TEST_DATABASE_URL on every resolve.
      brokenPath = mkdtempSync(join(tmpdir(), 'aog-health-broken-'))
      process.env.TEST_DATABASE_URL = brokenPath
      await closeDatabase()
    })

    afterAll(async () => {
      if (originalTestUrl === undefined) delete process.env.TEST_DATABASE_URL
      else process.env.TEST_DATABASE_URL = originalTestUrl
      await closeDatabase().catch(() => {})
      await configureOrm()
      rmSync(brokenPath, { recursive: true, force: true })
    })

    it('answers 503 with an error status and a failing database check', async () => {
      const res = await http.get('/health')
      expect(res.status).toBe(503)

      const body = await readJson(res)
      expect(UNHEALTHY).toContain(String(body.status).toLowerCase())

      const db = findDbCheck(body)
      expect(db).not.toBeNull()
      expect(UNHEALTHY).toContain(String(db!.status).toLowerCase())
    })
  })
})
