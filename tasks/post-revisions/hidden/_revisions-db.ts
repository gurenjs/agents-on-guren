// Reads post_revisions through the pinned table name, never through a model the
// solution may or may not have created.
import { sql } from 'drizzle-orm'
import { getDatabase } from '../../config/database.js'

export interface RevisionRow {
  id: number
  post_id: number
  title: string
  excerpt: string
  body: string
  created_at: string
}

export async function revisionRows(postId: number): Promise<RevisionRow[]> {
  const db = await getDatabase()
  return db.all<RevisionRow>(
    sql`SELECT id, post_id, title, excerpt, body, created_at FROM post_revisions WHERE post_id = ${postId} ORDER BY id`,
  )
}
