import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { freshApp, makeUser } from './_helpers.js'

const PASSWORD = 'correct-horse-battery'

function cookieHeader(res: Response): string {
  const pairs: string[] = []
  for (const setCookie of res.headers.getSetCookie()) {
    const [pair] = setCookie.split(';')
    if (pair && pair.includes('=')) pairs.push(pair.trim())
  }
  return pairs.join('; ')
}

/** Submit the login form; the redirect target travels both in the query and the body. */
async function login(http: TestApp, email: string, password: string, redirect?: string) {
  const client = await http.withCsrf('/login')
  const path = redirect === undefined ? '/login' : `/login?redirect=${encodeURIComponent(redirect)}`
  const body: Record<string, string> = { email, password }
  if (redirect !== undefined) body.redirect = redirect
  return client.post(path, body)
}

/** A follow-up request carrying the cookies the login response set. */
async function dashboardWith(http: TestApp, loginResponse: Response) {
  return http.withHeaders({ Cookie: cookieHeader(loginResponse) }).get('/dashboard')
}

describe('POST /login redirect handling', () => {
  let http: TestApp
  let email: string
  let defaultLocation: string

  beforeAll(async () => {
    http = await freshApp()
    const user = await makeUser({ password: PASSWORD })
    email = user.email

    const res = await login(http, email, PASSWORD)
    expect([302, 303]).toContain(res.status)
    defaultLocation = res.headers.get('location') ?? ''
    expect(defaultLocation.startsWith('/')).toBe(true)
    expect(defaultLocation.startsWith('//')).toBe(false)
  })

  it.each(['/posts', '/posts/3/edit'])('honours a same-app path %s', async (target) => {
    const res = await login(http, email, PASSWORD, target)
    expect([302, 303]).toContain(res.status)
    expect(res.headers.get('location')).toBe(target)
    expect((await dashboardWith(http, res)).status).toBe(200)
  })

  it.each([
    'https://evil.example',
    'https://evil.example/login',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
  ])('falls back to the default destination for %s and still signs the user in', async (target) => {
    const res = await login(http, email, PASSWORD, target)
    expect([302, 303]).toContain(res.status)

    const location = res.headers.get('location') ?? ''
    expect(location).not.toContain('evil.example')
    expect(location.startsWith('/')).toBe(true)
    expect(location.startsWith('//')).toBe(false)
    expect(location).not.toContain('\\')
    expect(location).toBe(defaultLocation)

    expect((await dashboardWith(http, res)).status).toBe(200)
  })

  it('still rejects a wrong password without creating a session', async () => {
    const res = await login(http, email, 'not-the-password', 'https://evil.example')
    expect([302, 303, 422]).toContain(res.status)
    expect(res.headers.get('location') ?? '').not.toContain('evil.example')

    const followUp = await dashboardWith(http, res)
    expect(followUp.status).not.toBe(200)
  })
})
