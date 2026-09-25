// Reads posts through the pinned table and column names, never through a model
// property the solution may or may not have changed.
import { sql, type SQL } from 'drizzle-orm'
import { getDatabase } from '../../config/database.js'

export interface PostRow {
  id: number
  title: string
  author_id: number
}

export async function postRowsByTitle(title: string): Promise<PostRow[]> {
  const db = (await getDatabase()) as { all<T>(query: SQL): Promise<T[]> }
  return db.all<PostRow>(sql`SELECT id, title, author_id FROM posts WHERE title = ${title} ORDER BY id`)
}
