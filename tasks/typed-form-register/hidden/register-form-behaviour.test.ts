import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { route } from '../../.guren/routes.gen.js'
import { User } from '../../app/Models/User.js'
import { freshApp } from './_helpers.js'

/** Field-keyed errors from a JSON 422 body (`{ errors: { email: [...] } }`); empty when the body is not JSON. */
async function fieldErrors(res: { json<T>(): Promise<T> }): Promise<Record<string, unknown>> {
  const body = await res.json<{ errors?: Record<string, unknown> }>().catch(() => ({}) as { errors?: Record<string, unknown> })
  return body.errors ?? {}
}

// The page must keep working exactly as before: it renders, a valid
// submission to the `register.store` route creates the account and redirects,
// and validation failures come back as 422 keyed by the field the server
// rejected — that is what the page shows under each input.
describe('registration form behaviour', () => {
  let http: TestApp
  const registerPath = route('register.store')

  beforeAll(async () => {
    http = await freshApp()
  })

  it('still resolves the register.store route to the registration endpoint', () => {
    expect(registerPath).toBe('/register')
  })

  it('renders the registration page for guests', async () => {
    await http.withHeaders({ 'X-Inertia': 'true' }).get('/register').assertOk().assertInertia('auth/Register')
  })

  it('creates the account and redirects when the submitted fields are valid', async () => {
    const email = `typed-form-${Date.now()}@example.com`
    const guest = await http.withCsrf()
    const res = await guest.post(registerPath, {
      name: 'Typed Form',
      email,
      password: 'secret-password',
      passwordConfirmation: 'secret-password',
    })

    expect([302, 303]).toContain(res.status)
    expect(res.headers.get('location') ?? '').toContain('/dashboard')

    const created = await User.where({ email })
    expect(created).toHaveLength(1)
    expect(created[0]?.name).toBe('Typed Form')
  })

  it('returns 422 keyed by passwordConfirmation when the confirmation does not match', async () => {
    const email = `mismatch-${Date.now()}@example.com`
    const guest = await http.withCsrf()
    const res = await guest.post(registerPath, {
      name: 'Typed Form',
      email,
      password: 'secret-password',
      passwordConfirmation: 'something-else',
    })

    expect(res.status).toBe(422)
    expect(await fieldErrors(res)).toHaveProperty('passwordConfirmation')
    expect(await User.where({ email })).toHaveLength(0)
  })

  it('returns 422 keyed by the missing field when a required field is blank', async () => {
    const email = `blank-name-${Date.now()}@example.com`
    const guest = await http.withCsrf()
    const res = await guest.post(registerPath, {
      name: '',
      email,
      password: 'secret-password',
      passwordConfirmation: 'secret-password',
    })

    expect(res.status).toBe(422)
    expect(await fieldErrors(res)).toHaveProperty('name')
    expect(await User.where({ email })).toHaveLength(0)
  })
})
