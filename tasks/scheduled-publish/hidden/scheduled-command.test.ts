import { beforeEach, describe, expect, it } from 'bun:test'
import { resolve } from 'node:path'
import { freshApp, makePost, makeUser } from './_helpers.js'
import { minutesFromNow, scheduledRows, setPublishedAt } from './_scheduled-db.js'

// The command runs as ops would run it: `bun run console posts:scheduled` in the
// app root, as a child process. It reaches the rows seeded here because both sides
// resolve the database the same way: config/database.ts picks TEST_DATABASE_URL
// (default ./data/guren.test.db, relative to the app root) whenever NODE_ENV is
// 'test'. `bun test` sets NODE_ENV=test in this process; the child gets it
// explicitly, along with any TEST_DATABASE_URL the run was given, and runs with
// the app root as its cwd. freshApp() has applied every migration by then, so the
// child's boot has none to report on stdout. Its boot also runs the seeders, which may
// add demo posts (scheduled ones included, if a solution seeds some), so the expected
// lines are read back from the database after the command has run.
const APP_ROOT = resolve(import.meta.dir, '../..')
const TIMEOUT_MS = 60_000

async function runScheduledCommand(): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = Bun.spawn(['bun', 'run', 'console', 'posts:scheduled'], {
    cwd: APP_ROOT,
    env: { ...process.env, NODE_ENV: 'test' },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  // Drain both pipes while waiting: a child blocked on a full stderr pipe never exits.
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { code, stdout, stderr }
}

/** stdout as lines, ignoring blank ones (a trailing newline or none are both fine). */
function lines(stdout: string): string[] {
  return stdout.split(/\r?\n/).filter((line) => line.trim() !== '')
}

/** Runs the report and checks stdout is exactly the scheduled rows, soonest first; returns the rows. */
async function expectReportOfScheduledRows() {
  const before = new Date().toISOString()
  const result = await runScheduledCommand()
  expect({ code: result.code, stderr: result.code === 0 ? '' : result.stderr }).toEqual({ code: 0, stderr: '' })
  const rows = await scheduledRows(before)
  const printed = lines(result.stdout)
  const expected = rows.map((row) => `${row.id}\t${row.title}\t${row.published_at}`)
  // The same lines, and in time order; the order of two posts due at the same instant is free.
  expect([...printed].sort()).toEqual([...expected].sort())
  const times = printed.map((line) => Date.parse(line.split('\t')[2] ?? ''))
  expect(times).toEqual([...times].sort((a, b) => a - b))
  return rows
}

describe('bun run console posts:scheduled', () => {
  beforeEach(async () => {
    await freshApp()
  })

  it('prints one tab-separated line per scheduled post, soonest first, and nothing else', async () => {
    const author = await makeUser()
    const later = await makePost(author.id, { title: 'Later launch' })
    const sooner = await makePost(author.id, { title: 'Sooner launch' })
    const past = await makePost(author.id, { title: 'Already public' })
    const unscheduled = await makePost(author.id, { title: 'Never scheduled' })

    // Inserted later-first, so "soonest first" differs from id order.
    const laterAt = minutesFromNow(3 * 24 * 60).toISOString()
    const soonerAt = minutesFromNow(24 * 60).toISOString()
    await setPublishedAt(later.id, laterAt)
    await setPublishedAt(sooner.id, soonerAt)
    await setPublishedAt(past.id, new Date(Date.now() - 60 * 60_000).toISOString())
    expect(unscheduled.id).toBeGreaterThan(0)

    const rows = await expectReportOfScheduledRows()
    const ours = rows.filter((row) => row.author_id === author.id)
    expect(ours.map((row) => [row.id, row.title, row.published_at])).toEqual([
      [sooner.id, 'Sooner launch', soonerAt],
      [later.id, 'Later launch', laterAt],
    ])
  }, TIMEOUT_MS)

  it('lists no post that is public, whether it never had a date or its date has passed', async () => {
    const author = await makeUser()
    const past = await makePost(author.id, { title: 'Already public' })
    await makePost(author.id, { title: 'Never scheduled' })
    await setPublishedAt(past.id, new Date(Date.now() - 60 * 60_000).toISOString())

    const rows = await expectReportOfScheduledRows()
    expect(rows.filter((row) => row.author_id === author.id)).toEqual([])
  }, TIMEOUT_MS)
})
