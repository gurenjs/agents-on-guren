import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { User } from '../../app/Models/User.js'
import { asUser, freshApp, makeUser } from './_helpers.js'

/** Field-keyed errors from a JSON 422 body (`{ errors: { email: [...] } }`); empty when the body is not JSON. */
async function fieldErrors(res: { json<T>(): Promise<T> }): Promise<Record<string, unknown>> {
  const body = await res.json<{ errors?: Record<string, unknown> }>().catch(() => ({}) as { errors?: Record<string, unknown> })
  return body.errors ?? {}
}

describe('PUT /profile input validation', () => {
  let http: TestApp

  beforeAll(async () => {
    http = await freshApp()
  })

  it('rejects a badly formatted email with 422 and leaves the account unchanged', async () => {
    const user = await makeUser({ name: 'Original Name' })

    const res = await (await asUser(http, user)).put('/profile', {
      name: 'Original Name',
      email: 'not-an-email',
      password: '',
    })
    expect(res.status).toBe(422)
    expect(await fieldErrors(res)).toHaveProperty('email')

    const after = await User.find(user.id)
    expect(after?.email).toBe(user.email)
    expect(after?.name).toBe('Original Name')
  })

  it('rejects an empty name with 422 and leaves the account unchanged', async () => {
    const user = await makeUser({ name: 'Original Name' })

    const res = await (await asUser(http, user)).put('/profile', {
      name: '',
      email: user.email,
      password: '',
    })
    expect(res.status).toBe(422)
    expect(await fieldErrors(res)).toHaveProperty('name')

    const after = await User.find(user.id)
    expect(after?.name).toBe('Original Name')
  })

  it('still saves a valid update', async () => {
    const user = await makeUser()

    const res = await (await asUser(http, user)).put('/profile', {
      name: 'Renamed User',
      email: 'renamed@example.com',
      password: '',
    })
    expect([200, 302, 303]).toContain(res.status)

    const after = await User.find(user.id)
    expect(after?.name).toBe('Renamed User')
    expect(after?.email).toBe('renamed@example.com')
    expect(after?.passwordHash).toBe(user.passwordHash)
  })

  it('ignores fields that are not part of the profile form', async () => {
    const user = await makeUser()

    const res = await (await asUser(http, user)).put('/profile', {
      name: 'Renamed User',
      email: 'renamed-extra@example.com',
      password: '',
      passwordHash: 'not-a-real-hash',
      role: 'admin',
    })
    expect([200, 302, 303]).toContain(res.status)

    const after = await User.find(user.id)
    expect(after?.name).toBe('Renamed User')
    expect(after?.email).toBe('renamed-extra@example.com')
    expect(after?.passwordHash).toBe(user.passwordHash)
  })

  it('never lets the request change the account id', async () => {
    const user = await makeUser()

    const res = await (await asUser(http, user)).put('/profile', {
      id: 999_999,
      name: 'Renamed User',
      email: 'renamed-id@example.com',
      password: '',
    })
    expect([200, 302, 303]).toContain(res.status)

    const after = await User.find(user.id)
    expect(after).not.toBeNull()
    expect(after?.email).toBe('renamed-id@example.com')
    expect(await User.find(999_999)).toBeNull()
  })
})
