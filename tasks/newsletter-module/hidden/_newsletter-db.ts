// Reads newsletter_subscriptions through the pinned table name, never through a
// model the solution may or may not have created.
import { sql } from 'drizzle-orm'
import { getDatabase } from '../../config/database.js'

export interface SubscriptionRow {
  id: number
  email: string
  token: string | null
  confirmed_at: string | null
  created_at: string | null
}

export async function subscriptionRows(): Promise<SubscriptionRow[]> {
  const db = await getDatabase()
  return db.all<SubscriptionRow>(
    sql`SELECT id, email, token, confirmed_at, created_at FROM newsletter_subscriptions ORDER BY id`,
  )
}

export async function subscriptionsFor(email: string): Promise<SubscriptionRow[]> {
  const db = await getDatabase()
  return db.all<SubscriptionRow>(
    sql`SELECT id, email, token, confirmed_at, created_at FROM newsletter_subscriptions WHERE lower(email) = lower(${email}) ORDER BY id`,
  )
}
