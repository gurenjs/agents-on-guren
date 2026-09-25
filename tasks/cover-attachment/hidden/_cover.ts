// Upload fixtures and storage probes for the cover tests. Images are built in
// memory, each carrying a random comment so its bytes are unique: a stored
// file is then found by content alone, wherever under storage/ a solution
// keeps it and whatever it names it, and files left by earlier runs never
// match. All three formats decode (Bun.Image accepts the GIF too), so a GIF is
// refused only by a rule that looks at the type.
import { expect } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { sql, type SQL } from 'drizzle-orm'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { getDatabase } from '../../config/database.js'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** A valid 2x2 RGB PNG; `padding` bytes of comment text make it as large as needed. */
export function pngBytes(padding = 0): Uint8Array {
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, 2)
  view.setUint32(4, 2)
  ihdr[8] = 8
  ihdr[9] = 2
  const pixels = new Uint8Array([0, 255, 0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 255])
  const text = new TextEncoder().encode(`Comment\0${crypto.randomUUID()}${'x'.repeat(padding)}`)
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('tEXt', text),
    pngChunk('IDAT', new Uint8Array(deflateSync(pixels))),
    pngChunk('IEND', new Uint8Array()),
  ])
}

// A 2x2 baseline JPEG (encoded once from the PNG above); a COM segment is added per upload.
const JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkz' +
  'ODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2Nj' +
  'Y2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAACAAIDASIA' +
  'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA' +
  'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3' +
  'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm' +
  'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEA' +
  'AwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSEx' +
  'BhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElK' +
  'U1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3' +
  'uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDrNFtb' +
  'd9EsGeCJma2jJJQEk7RRRRXnT+Jnk1Pjfqf/2Q==' +
  ''

export function jpegBytes(): Uint8Array {
  const base = new Uint8Array(Buffer.from(JPEG_BASE64, 'base64'))
  const note = new TextEncoder().encode(crypto.randomUUID())
  const length = note.length + 2
  return concat([new Uint8Array([0xff, 0xd8, 0xff, 0xfe, length >> 8, length & 0xff]), note, base.subarray(2)])
}

// A 1x1 GIF89a with a comment extension after its global color table.
const GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export function gifBytes(): Uint8Array {
  const base = new Uint8Array(Buffer.from(GIF_BASE64, 'base64'))
  const note = new TextEncoder().encode(crypto.randomUUID())
  return concat([base.subarray(0, 19), new Uint8Array([0x21, 0xfe, note.length]), note, new Uint8Array([0]), base.subarray(19)])
}

export function upload(bytes: Uint8Array, name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

export function form(fields: Record<string, string | File>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

function sameBytes(path: string, bytes: Uint8Array): boolean {
  const content = readFileSync(path)
  return content.length === bytes.length && Buffer.compare(content, Buffer.from(bytes)) === 0
}

function filesUnder(root: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return []
  }
  const found: string[] = []
  for (const entry of entries) {
    const path = join(root, entry)
    const stat = statSync(path, { throwIfNoEntry: false })
    if (!stat) continue
    if (stat.isDirectory()) found.push(...filesUnder(path))
    else if (stat.isFile()) found.push(path)
  }
  return found
}

/** Files under the project's `<dir>/` whose content is exactly `bytes`. */
export function copiesIn(dir: 'storage' | 'public', bytes: Uint8Array): string[] {
  return filesUnder(join(process.cwd(), dir)).filter((path) => statSync(path).size === bytes.length && sameBytes(path, bytes))
}

async function rows<T>(query: SQL): Promise<T[]> {
  const db = (await getDatabase()) as { all: (query: SQL) => T[] | Promise<T[]> }
  return await db.all(query)
}

export async function countRows(table: 'posts' | 'attachments'): Promise<number> {
  const found = await rows<{ n: number }>(sql.raw(`select count(*) as n from ${table}`))
  return Number(found[0]!.n)
}

export async function postIdByTitle(title: string): Promise<number | null> {
  const found = await rows<{ id: number }>(sql`select id from posts where title = ${title}`)
  return found.length === 1 ? Number(found[0]!.id) : null
}

export interface PostProps {
  id: number
  title: string
  coverUrl?: unknown
}

export async function inertiaProps<T>(http: TestApp, path: string, component: string): Promise<T> {
  const res = await http.withHeaders({ 'X-Inertia': 'true' }).get(path)
  expect(res.status).toBe(200)
  const json = (await res.json()) as { component: string; props: T }
  expect(json.component).toBe(component)
  return json.props
}

export async function showCoverUrl(http: TestApp, id: number): Promise<unknown> {
  const props = await inertiaProps<{ post: PostProps }>(http, `/posts/${id}`, 'posts/Show')
  expect(Object.hasOwn(props.post, 'coverUrl')).toBe(true)
  return props.post.coverUrl
}

export async function indexCoverUrl(http: TestApp, id: number): Promise<unknown> {
  const props = await inertiaProps<{ data: PostProps[] }>(http, '/posts', 'posts/Index')
  const post = props.data.find((candidate) => candidate.id === id)
  expect(post).toBeDefined()
  expect(Object.hasOwn(post!, 'coverUrl')).toBe(true)
  return post!.coverUrl
}

/** GET a cover URL the app handed out (relative or absolute) and return status, type and bytes. */
export async function fetchCover(http: TestApp, url: string): Promise<{ status: number; type: string; bytes: Uint8Array }> {
  const target = new URL(url, 'http://localhost')
  const res = await http.get(`${target.pathname}${target.search}`)
  return {
    status: res.status,
    type: res.headers.get('content-type') ?? '',
    bytes: new Uint8Array(await res.raw.clone().arrayBuffer()),
  }
}
