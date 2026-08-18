import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import type { TestApp } from '@guren/testing'
import type { MailMessage } from '@guren/core'
import { User } from '../../app/Models/User.js'
import { freshApp, makeUser } from './_helpers.js'
import { probeMailAndQueue, type MailQueueProbe } from './_mail-queue-probe.js'

// The statement fixes the subject as "Welcome to <APP_NAME>, <name>!" with the
// app name taken from APP_NAME in .env — "Guren" in this app.
const APP_NAME = process.env.APP_NAME?.trim() || 'Guren'
const FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS?.trim() || 'hello@example.com'
const PASSWORD = 'correct-horse-battery'

let seq = 0
function newcomer() {
  seq += 1
  return {
    name: `Ada Lovelace ${seq}`,
    email: `ada${seq}-${Date.now()}@example.com`,
  }
}

/** Submit the registration form once, from a fresh CSRF-primed guest session. */
async function register(http: TestApp, who: { name: string; email: string }) {
  const guest = await http.withCsrf('/register')
  return guest.post('/register', {
    name: who.name,
    email: who.email,
    password: PASSWORD,
    passwordConfirmation: PASSWORD,
  })
}

function recipients(message: MailMessage): string[] {
  return message.to.map((address) => address.email.toLowerCase())
}

function bodyOf(message: MailMessage): string {
  return `${message.text ?? ''}\n${message.html ?? ''}`
}

describe('welcome mail after registration', () => {
  let http: TestApp
  let probe: MailQueueProbe

  beforeAll(async () => {
    http = await freshApp()
    probe = probeMailAndQueue()
  })

  beforeEach(async () => {
    await probe.clear()
  })

  afterAll(() => {
    probe?.restore()
  })

  it('registers as before and hands the mail off to the queue instead of sending inline', async () => {
    const who = newcomer()

    const res = await register(http, who)
    expect([302, 303]).toContain(res.status)
    expect(res.headers.get('location') ?? '').toMatch(/\/dashboard$/)

    const created = await User.where({ email: who.email })
    expect(created).toHaveLength(1)

    // The response is back; nothing may have gone out yet …
    expect(probe.sent()).toHaveLength(0)
    // … and exactly one unit of background work is waiting for a worker.
    expect(probe.queue.getJobs()).toHaveLength(1)
  })

  it('delivers exactly one welcome mail to the new user when the queued work runs', async () => {
    const who = newcomer()
    const res = await register(http, who)
    expect([302, 303]).toContain(res.status)
    expect(probe.queue.getJobs()).toHaveLength(1)

    await probe.drain()

    const failed = await probe.queue.getFailedJobs()
    expect(failed.map((job) => `${job.name}: ${job.error}`)).toEqual([])

    const sent = probe.sent()
    expect(sent).toHaveLength(1)
    const [message] = sent

    expect(recipients(message)).toEqual([who.email.toLowerCase()])
    expect(message.subject).toBe(`Welcome to ${APP_NAME}, ${who.name}!`)
    expect(bodyOf(message)).toContain(who.name)
    expect(message.from?.email.toLowerCase()).toBe(FROM_ADDRESS.toLowerCase())
  })

  it('queues nothing and sends nothing when registration is refused', async () => {
    const taken = await makeUser({ password: PASSWORD })

    // Duplicate email — refused by the existing check.
    const duplicate = await register(http, { name: 'Someone Else', email: taken.email })
    expect(duplicate.status).not.toBe(500)
    expect([302, 303, 422]).toContain(duplicate.status)

    // Password mismatch — refused by validation.
    const guest = await http.withCsrf('/register')
    const mismatch = await guest.post('/register', {
      name: 'Grace Hopper',
      email: `grace-${Date.now()}@example.com`,
      password: PASSWORD,
      passwordConfirmation: 'something-else',
    })
    expect(mismatch.status).not.toBe(500)
    expect([302, 303, 422]).toContain(mismatch.status)

    expect(probe.queue.getJobs()).toHaveLength(0)
    expect(probe.sent()).toHaveLength(0)
  })
})
