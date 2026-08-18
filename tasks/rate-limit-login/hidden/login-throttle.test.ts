import { beforeAll, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import { freshApp, makeUser } from './_helpers.js'

// The throttle is keyed by client IP and lives in memory for the life of the
// process. TestApp drives the app in-process, so every request in this file
// arrives from the same (unknown) client and lands in ONE bucket that nothing
// here can reset. The tests below therefore run in declaration order and share
// a running attempt count — the numbering in each test's comments is the
// running total of POST /login submissions since the process started. Keep the
// order, and keep every submission accounted for.

const PASSWORD = 'correct-horse-battery'
const WRONG = 'not-the-password'

function cookieHeader(res: Response): string {
  const pairs: string[] = []
  for (const setCookie of res.headers.getSetCookie()) {
    const [pair] = setCookie.split(';')
    if (pair && pair.includes('=')) pairs.push(pair.trim())
  }
  return pairs.join('; ')
}

/** Submit the login form once, from a fresh CSRF-primed session. */
async function submitLogin(http: TestApp, email: string, password: string) {
  const client = await http.withCsrf('/login')
  return client.post('/login', { email, password })
}

/** Whether the login response opened a session that can reach /dashboard. */
async function signedIn(http: TestApp, loginResponse: Response): Promise<boolean> {
  const res = await http.withHeaders({ Cookie: cookieHeader(loginResponse) }).get('/dashboard')
  return res.status === 200
}

/** A refused-but-not-throttled attempt: the usual validation failure or redirect-back. */
function expectRefused(res: Response) {
  expect(res.status).not.toBe(429)
  expect([302, 303, 422]).toContain(res.status)
}

/** Retry-After may be delay-seconds or an HTTP-date; either must be well-formed. */
function expectRetryAfter(res: Response) {
  const value = res.headers.get('retry-after')
  expect(value).not.toBeNull()
  const seconds = Number(value)
  const isDelaySeconds = /^\d+$/.test(value ?? '') && seconds >= 0
  const isHttpDate = !Number.isNaN(Date.parse(value ?? ''))
  expect(isDelaySeconds || isHttpDate).toBe(true)
}

describe('POST /login throttling', () => {
  let http: TestApp
  let email: string

  beforeAll(async () => {
    http = await freshApp()
    const user = await makeUser({ password: PASSWORD })
    email = user.email
  })

  it('lets a correct password through within the first 5 attempts', async () => {
    // Attempt 1: wrong password — refused the ordinary way, no session.
    const wrong = await submitLogin(http, email, WRONG)
    expectRefused(wrong)
    expect(await signedIn(http, wrong)).toBe(false)

    // Attempt 2: right password — signs in exactly as before the change.
    const right = await submitLogin(http, email, PASSWORD)
    expect([302, 303]).toContain(right.status)
    expect(await signedIn(http, right)).toBe(true)
  })

  it('answers the 6th attempt within the window with 429 and Retry-After', async () => {
    // Attempts 3, 4, 5: still within the limit, refused the ordinary way.
    for (let attempt = 3; attempt <= 5; attempt++) {
      const res = await submitLogin(http, email, WRONG)
      expectRefused(res)
    }

    // Attempt 6: over the limit.
    const sixth = await submitLogin(http, email, WRONG)
    expect(sixth.status).toBe(429)
    expectRetryAfter(sixth)

    // Attempt 7: stays throttled until the window passes.
    const seventh = await submitLogin(http, email, WRONG)
    expect(seventh.status).toBe(429)
    expectRetryAfter(seventh)
  })

  it('keeps refusing while throttled, even with the right password', async () => {
    // Attempt 8: a correct guess after the limit must not open a session.
    const res = await submitLogin(http, email, PASSWORD)
    expect(res.status).toBe(429)
    expectRetryAfter(res)
    expect(await signedIn(http, res)).toBe(false)
  })

  it('does not throttle rendering the login form or the rest of the site', async () => {
    // Still throttled on POST, yet GET /login and unrelated pages are unaffected.
    expect((await http.get('/login')).status).toBe(200)
    expect((await http.get('/posts')).status).toBe(200)
    expect((await http.get('/')).status).toBe(200)
  })
})
