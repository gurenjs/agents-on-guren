// The acceptance run's side of the agent protocol: a credential issued through
// the token store the app itself configured (the one its MCP endpoint verifies
// bearers against), JSON-RPC over POST /mcp, and the app's CLI as a child process.
import { resolve } from 'node:path'
import { createApiToken, type ApiTokenStore } from '@guren/core'
import type { TestApp } from '@guren/testing'
import app from '../../src/app.js'

export const APP_ROOT = resolve(import.meta.dir, '../..')

interface TokenAuth {
  getApiTokenStore(): ApiTokenStore | undefined
}

/** A bearer credential for `userId` granting every tool, as an operator would issue one. */
export async function issueCredential(userId: number): Promise<string> {
  const store = (app.auth as unknown as TokenAuth).getApiTokenStore()
  if (!store) throw new Error('The app configures no API token store, so no credential can be issued for /mcp.')
  const { plainTextToken } = await createApiToken(store, { name: 'assistant', userId, abilities: ['tools:*'] })
  return plainTextToken
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: Record<string, unknown>
  error?: { code: number; message: string }
}

let rpcId = 0

/** One JSON-RPC request to /mcp; the answer may come as plain JSON or as one SSE message. */
export async function mcp(http: TestApp, token: string, method: string, params: Record<string, unknown> = {}) {
  rpcId += 1
  const id = rpcId
  const res = await http
    .withHeaders({
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    })
    .post('/mcp', { jsonrpc: '2.0', id, method, params })
  const text = await res.text()
  const messages: JsonRpcResponse[] = []
  if ((res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    for (const line of text.split(/\r?\n/)) {
      if (line.startsWith('data:')) messages.push(JSON.parse(line.slice(5).trim()) as JsonRpcResponse)
    }
  } else if (text.trim() !== '') {
    const parsed = JSON.parse(text) as JsonRpcResponse | JsonRpcResponse[]
    messages.push(...(Array.isArray(parsed) ? parsed : [parsed]))
  }
  return { status: res.status, message: messages.find((m) => m.id === id) ?? null, raw: text }
}

export interface McpTool {
  name: string
  annotations?: { readOnlyHint?: boolean }
}

/** Tool names the server adds on its own (guren_preflight and the like) are not the app's tools. */
export function appTools<T extends { name?: string; toolName?: string }>(tools: T[]): T[] {
  return tools.filter((tool) => !(tool.name ?? tool.toolName ?? '').startsWith('guren_'))
}

/** Runs a CLI command in the app root, draining both pipes while waiting. */
export async function runCli(argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = Bun.spawn(argv, {
    cwd: APP_ROOT,
    env: { ...process.env, NODE_ENV: 'test' },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { code, stdout, stderr }
}
