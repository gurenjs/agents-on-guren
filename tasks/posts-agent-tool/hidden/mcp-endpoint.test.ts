import { beforeEach, describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { TestApp } from '@guren/testing'
import { freshApp, makePost, makeUser } from './_helpers.js'
import { postRowsByTitle } from './_posts-agent-db.js'
import { APP_ROOT, appTools, issueCredential, mcp, type McpTool } from './_mcp.js'

let http: TestApp

beforeEach(async () => {
  http = await freshApp()
})

describe('POST /mcp', () => {
  it('refuses a caller with no credential with 401', async () => {
    const res = await http
      .withHeaders({ Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' })
      .post('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    expect(res.status).toBe(401)
  })

  it('lists exactly the two post tools to an authenticated assistant, with their read-only hints', async () => {
    const user = await makeUser()
    const token = await issueCredential(user.id)
    const { status, message } = await mcp(http, token, 'tools/list')
    expect(status).toBe(200)
    expect(message?.error).toBeUndefined()
    const tools = appTools((message?.result?.tools ?? []) as McpTool[])
    expect(tools.map((tool) => [tool.name, tool.annotations?.readOnlyHint]).sort()).toEqual([
      ['posts_search', true],
      ['posts_store', false],
    ])
  })

  it('searches and creates posts as the credential\'s user', async () => {
    const user = await makeUser()
    const other = await makeUser()
    const existing = await makePost(other.id, { title: 'Protocol notes' })
    const token = await issueCredential(user.id)

    const search = await mcp(http, token, 'tools/call', { name: 'posts_search', arguments: { keywords: ['protocol'] } })
    expect(search.status).toBe(200)
    const searchResult = search.message?.result as { isError?: boolean; structuredContent?: unknown; content?: Array<{ text?: string }> }
    expect(searchResult?.isError ?? false).toBe(false)
    const payload = (searchResult.structuredContent ?? JSON.parse(searchResult.content?.[0]?.text ?? 'null')) as {
      data: Array<{ id: number }>
    }
    expect(payload.data.map((post) => post.id)).toEqual([existing.id])

    const store = await mcp(http, token, 'tools/call', {
      name: 'posts_store',
      arguments: { title: 'Written over MCP', excerpt: 'An excerpt', body: 'A body', authorId: other.id },
    })
    expect(store.status).toBe(200)
    expect((store.message?.result as { isError?: boolean } | undefined)?.isError ?? false).toBe(false)
    expect((await postRowsByTitle('Written over MCP')).map((row) => row.author_id)).toEqual([user.id])
  })
})

// The ticket asks for the framework's own supported MCP serving, not a hand-written
// protocol handler; for this framework that is @guren/plugin-mcp's mcpPlugin()
// registered with the app. Accepted anywhere in the app's own source.
function sourceFiles(dir: string): string[] {
  const root = join(APP_ROOT, dir)
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return []
  }
  return entries.flatMap((entry) => {
    const path = join(root, entry)
    if (statSync(path).isDirectory()) return sourceFiles(join(dir, entry))
    return /\.(ts|tsx|js|mjs)$/.test(entry) ? [path] : []
  })
}

describe('the MCP endpoint', () => {
  it('is served by the framework\'s MCP plugin, declared as a dependency and registered in the app', () => {
    const manifest = JSON.parse(readFileSync(join(APP_ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    expect(Object.keys(manifest.dependencies ?? {})).toContain('@guren/plugin-mcp')
    const registering = ['src', 'app', 'config', 'routes']
      .flatMap(sourceFiles)
      .filter((file) => {
        const text = readFileSync(file, 'utf8')
        return /from\s+['"]@guren\/plugin-mcp['"]/.test(text) && /\bmcpPlugin\s*\(/.test(text)
      })
    expect(registering.length).toBeGreaterThan(0)
  })
})
