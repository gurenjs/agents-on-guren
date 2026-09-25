import { describe, expect, it } from 'bun:test'
import { runCli } from './_mcp.js'

// Both commands read the app from disk (routes, controllers, schema) and boot
// nothing; they run as a developer would run them, in the app root.
const TIMEOUT_MS = 120_000

interface DerivedTool {
  toolName: string
  annotations: { readOnlyHint: boolean }
}

describe('bunx guren tool:list --json', () => {
  it('lists exactly posts_search (read-only) and posts_store (not read-only)', async () => {
    const result = await runCli(['bunx', 'guren', 'tool:list', '--json'])
    expect({ code: result.code, stderr: result.code === 0 ? '' : result.stderr }).toEqual({ code: 0, stderr: '' })
    const { tools } = JSON.parse(result.stdout) as { tools: DerivedTool[] }
    expect(tools.map((tool) => [tool.toolName, tool.annotations.readOnlyHint]).sort()).toEqual([
      ['posts_search', true],
      ['posts_store', false],
    ])
  }, TIMEOUT_MS)
})

describe('bunx guren check', () => {
  // Plain `check` is informational and exits 0 whatever it finds, so the verdict is
  // read from its JSON report: warnings are fine, a failing check is not. Among
  // them are the agent-route rules (a nameless or illegally named tool, a
  // mutating tool with no authorization).
  it('reports no failing check', async () => {
    const result = await runCli(['bunx', 'guren', 'check', '--json'])
    expect(result.code).toBe(0)
    const report = JSON.parse(result.stdout) as {
      failCount: number
      checks: Array<{ key: string; status: string; message: string }>
    }
    expect(report.checks.filter((check) => check.status === 'fail')).toEqual([])
    expect(report.failCount).toBe(0)
  }, TIMEOUT_MS)
})
