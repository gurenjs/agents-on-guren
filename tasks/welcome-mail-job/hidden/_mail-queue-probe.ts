// Observation seam for the welcome-mail task. Copied into tests/hidden/ next to
// the test file; never present in the agent's worktree.
//
// It observes two things without depending on how the solution is structured:
//
//   1. Background work. The framework routes every job dispatch through one
//      process-wide queue driver, so swapping that driver for a *holding*
//      driver (records the job, runs nothing) shows what a registration hands
//      off, and lets the test run it later the way a worker would. If the app
//      also bound a queue manager in the container, its default driver is
//      pointed at the same holding driver, so a solution that resolves the
//      driver lazily lands here too.
//
//   2. Mail. Every message the framework mailer sends is resolved through
//      `MailManager.prototype.transport()`, whatever manager instance, transport
//      name, or mailable class the solution used. The probe wraps that method
//      so the *real* transport still runs (a misconfigured mailer still throws,
//      the log transport still logs) while every message handed to it is
//      recorded for assertions.
import { FakeQueueDriver } from '@guren/testing'
import {
  MailManager,
  getQueueDriver,
  processJob,
  setQueueDriver,
  type MailMessage,
  type MailTransport,
  type QueueDriver,
} from '@guren/core'
import app from '../../src/app.js'

export interface MailQueueProbe {
  /** Jobs handed to the queue since the last `clear()`, none of them run yet. */
  readonly queue: FakeQueueDriver
  /** Messages handed to a mail transport since the last `clear()`. */
  sent(): MailMessage[]
  /** Run every job currently waiting (any queue name), like a worker would, until none is left. */
  drain(): Promise<void>
  /** Forget recorded jobs and messages. */
  clear(): Promise<void>
  /** Put the original queue driver and mailer behaviour back. */
  restore(): void
}

type QueueManagerLike = {
  getDefaultDriverName(): string
  registerDriver(name: string, factory: () => QueueDriver): void
  setDefaultDriver(name: string): void
}

function isQueueManagerLike(value: unknown): value is QueueManagerLike {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.getDefaultDriverName === 'function' &&
    typeof candidate.registerDriver === 'function' &&
    typeof candidate.setDefaultDriver === 'function'
  )
}

/** Install the probe. Call after the app has booted (its providers may set the queue driver during boot). */
export function probeMailAndQueue(): MailQueueProbe {
  const queue = new FakeQueueDriver()
  const messages: MailMessage[] = []

  // --- queue -------------------------------------------------------------
  const previousDriver = getQueueDriver()
  setQueueDriver(queue)

  const container = app.container
  if (container.has('queue')) {
    try {
      const manager: unknown = container.make('queue')
      if (isQueueManagerLike(manager)) {
        const name = manager.getDefaultDriverName()
        manager.registerDriver(name, () => queue)
        manager.setDefaultDriver(name)
      }
    } catch {
      // A queue binding that cannot be resolved is the solution's problem to
      // surface, not the probe's — the global driver above still records.
    }
  }
  // setDefaultDriver() above re-points the global driver; make sure it is ours.
  setQueueDriver(queue)

  // --- mail --------------------------------------------------------------
  const originalTransport = MailManager.prototype.transport
  MailManager.prototype.transport = function (this: MailManager, name?: string): MailTransport {
    const real = originalTransport.call(this, name)
    return {
      name: real.name,
      send: async (message: MailMessage) => {
        messages.push(message)
        return real.send(message)
      },
    }
  }

  return {
    queue,
    sent: () => [...messages],
    async drain() {
      // A job may enqueue further work while it runs (a mailable queued from
      // inside a job, a retry); keep going until the queue is quiet, with a
      // ceiling so a job that re-queues itself forever cannot hang the suite.
      for (let round = 0; round < 25; round++) {
        const [next] = queue.getJobs()
        if (!next) return
        await processJob(queue, next.options.queue)
      }
      throw new Error('drain(): the queue never emptied — a job keeps re-queueing itself')
    },
    async clear() {
      await queue.clear()
      messages.length = 0
    },
    restore() {
      MailManager.prototype.transport = originalTransport
      if (previousDriver) setQueueDriver(previousDriver)
    },
  }
}
