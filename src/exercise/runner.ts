/**
 * Main-thread side of the test runner: worker lifecycle (pre-warm, ready
 * handshake, hard timeout + terminate/respawn) and run serialization.
 */

import type { RunOutcome, WorkerResponse } from './types'

const TIMEOUT_MS = 2000

class ExerciseRunner {
  private worker!: Worker
  private ready!: Promise<void>
  private nextId = 1
  private chain: Promise<unknown> = Promise.resolve()

  constructor() {
    this.spawn()
  }

  private spawn(): void {
    this.worker = new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module' })
    this.ready = new Promise((resolve) => {
      const onMsg = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.type === 'ready') {
          this.worker.removeEventListener('message', onMsg)
          resolve()
        }
      }
      this.worker.addEventListener('message', onMsg)
    })
  }

  /** Run one exercise's tests. Serialized so timeouts attribute correctly. */
  run(exerciseId: string, code: string): Promise<RunOutcome> {
    const result = this.chain.then(() => this.runNow(exerciseId, code))
    // Keep the chain alive even if a run rejects unexpectedly.
    this.chain = result.catch(() => undefined)
    return result
  }

  private async runNow(exerciseId: string, code: string): Promise<RunOutcome> {
    await this.ready
    const id = this.nextId++
    const worker = this.worker

    return new Promise<RunOutcome>((resolve) => {
      const timer = setTimeout(() => {
        worker.removeEventListener('message', onMsg)
        worker.terminate()
        this.spawn() // fresh worker for the next run
        resolve({ kind: 'timeout' })
      }, TIMEOUT_MS)

      const onMsg = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.type !== 'result' || e.data.id !== id) return
        clearTimeout(timer)
        worker.removeEventListener('message', onMsg)
        resolve(e.data.outcome)
      }
      worker.addEventListener('message', onMsg)
      worker.postMessage({ id, exerciseId, code })
    })
  }
}

/** Singleton, pre-warmed at first import (module pages import this early). */
export const runner = new ExerciseRunner()
