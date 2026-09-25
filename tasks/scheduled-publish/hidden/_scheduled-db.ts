// Reads and writes posts.published_at through the pinned table and column names,
// never through a model property the solution may or may not have declared.
import { sql } from 'drizzle-orm'
import { getDatabase } from '../../config/database.js'

export interface PostRow {
  id: number
  title: string
  author_id: number
  published_at: string | null
}

export async function postRowByTitle(title: string): Promise<PostRow | null> {
  const db = await getDatabase()
  const rows = await db.all<PostRow>(
    sql`SELECT id, title, author_id, published_at FROM posts WHERE title = ${title} ORDER BY id`,
  )
  return rows[0] ?? null
}

/** Sets published_at directly, as ops would with a database console. */
export async function setPublishedAt(postId: number, value: string | null): Promise<void> {
  const db = await getDatabase()
  await db.run(sql`UPDATE posts SET published_at = ${value} WHERE id = ${postId}`)
}

/** A time `minutes` from now, on a whole minute so storage at minute precision still compares equal. */
export function minutesFromNow(minutes: number): Date {
  const MINUTE = 60_000
  return new Date(Math.ceil((Date.now() + minutes * MINUTE) / MINUTE) * MINUTE)
}

/** Every post scheduled after `nowIso`, soonest first, as the report is expected to list them. */
export async function scheduledRows(nowIso: string): Promise<PostRow[]> {
  const db = await getDatabase()
  return db.all<PostRow>(
    sql`SELECT id, title, author_id, published_at FROM posts
        WHERE published_at IS NOT NULL AND published_at > ${nowIso}
        ORDER BY published_at, id`,
  )
}
