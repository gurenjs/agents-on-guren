// Reads the pinned tables (`comments`, `comment_reports`) with plain SQL, so the
// hidden suite never depends on the model classes a solution may or may not
// have written. Copied into tests/hidden/ next to the test file.
import { sql, type SQL } from 'drizzle-orm'
import { getDatabase } from '../../config/database.js'

export interface CommentRow {
  id: number
  post_id: number
  user_id: number
  body: string
}

async function all<T>(query: SQL): Promise<T[]> {
  const db = (await getDatabase()) as { all(query: SQL): Promise<unknown[]> | unknown[] }
  return (await db.all(query)) as T[]
}

export async function commentsOnPost(postId: number): Promise<CommentRow[]> {
  return all<CommentRow>(sql`SELECT id, post_id, user_id, body FROM comments WHERE post_id = ${postId} ORDER BY id`)
}

export async function commentById(id: number): Promise<CommentRow | undefined> {
  const rows = await all<CommentRow>(sql`SELECT id, post_id, user_id, body FROM comments WHERE id = ${id}`)
  return rows[0]
}

export async function commentByBody(body: string): Promise<CommentRow | undefined> {
  const rows = await all<CommentRow>(sql`SELECT id, post_id, user_id, body FROM comments WHERE body = ${body}`)
  return rows[0]
}

export async function reportCount(commentId: number, userId?: number): Promise<number> {
  const rows =
    userId === undefined
      ? await all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ${commentId}`)
      : await all<{ n: number }>(
          sql`SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ${commentId} AND user_id = ${userId}`,
        )
  return Number(rows[0]?.n ?? 0)
}
