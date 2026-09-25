// Reads api_tokens through the pinned table name, never through a model or
// store the solution may or may not have created. No column is pinned: the
// plain-text check scans every column of every row.
import { sql } from 'drizzle-orm'
import { getDatabase } from '../../config/database.js'

export type ApiTokenRow = Record<string, unknown>

export async function apiTokenRows(): Promise<ApiTokenRow[]> {
  const db = await getDatabase()
  return db.all<ApiTokenRow>(sql`SELECT * FROM api_tokens`)
}

/** Every column value of every api_tokens row, as text. */
export async function apiTokenCells(): Promise<string[]> {
  const rows = await apiTokenRows()
  return rows.flatMap((row) =>
    Object.values(row).map((value) => {
      if (value === null || value === undefined) return ''
      if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8')
      return String(value)
    }),
  )
}
