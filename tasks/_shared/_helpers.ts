// Shared fixture helpers for hidden tests. Copied into tests/hidden/ by the
// harness alongside each task's *.test.ts — never present in the agent's
// worktree. Keep this file free of task-specific logic.
import { TestApp } from '@guren/testing'
import { resetDatabase } from '../../config/database.js'
import { User } from '../../app/Models/User.js'
import { Post } from '../../app/Models/Post.js'
import app from '../../src/app.js'

let booted: TestApp | null = null

/**
 * Boot the app once per process, then reset the test database (migrations
 * re-applied, tables empty). Boot runs first because the app's boot may seed
 * demo rows — resetting afterwards guarantees every test file starts from
 * the same empty state and owns its fixtures.
 */
export async function freshApp(): Promise<TestApp> {
  if (!booted) booted = await TestApp.fromApp(app)
  await resetDatabase()
  return booted
}

let userSeq = 0

export async function makeUser(overrides: { name?: string; email?: string; password?: string } = {}) {
  userSeq += 1
  const user = await User.create({
    name: overrides.name ?? `User ${userSeq}`,
    email: overrides.email ?? `user${userSeq}-${Date.now()}@example.com`,
    password: overrides.password ?? 'secret-password',
  })
  if (!user) throw new Error('makeUser: create returned null')
  return user
}

export async function makePost(authorId: number, overrides: { title?: string; excerpt?: string; body?: string } = {}) {
  const post = await Post.forceCreate({
    title: overrides.title ?? 'A post title',
    excerpt: overrides.excerpt ?? 'A short excerpt',
    body: overrides.body ?? 'The body of the post.',
    authorId,
  })
  if (!post) throw new Error('makePost: forceCreate returned null')
  return post
}

/** A TestApp acting as `user`, with CSRF primed so mutating requests pass the middleware. */
export async function asUser(http: TestApp, user: { id: number }) {
  return http.actingAs(user).withCsrf()
}
