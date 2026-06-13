/**
 * Test-runner Web Worker. Only { id, exerciseId, code } crosses the boundary
 * in, and structured-clone-safe results come back out. The main thread holds
 * a kill switch: if we don't answer within the timeout (user wrote an
 * infinite loop), it terminates us and spawns a fresh worker.
 */

import type { WorkerRequest, WorkerResponse, RunOutcome } from './types'
import { compileUserCode, executeTests, CompileError } from './compile'
import { getExercise } from './registry'

const post = (msg: WorkerResponse) => self.postMessage(msg)

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, exerciseId, code } = e.data
  let outcome: RunOutcome
  try {
    const spec = getExercise(exerciseId)
    const fns = compileUserCode(spec, code)
    const results = executeTests(spec, fns)
    outcome = { kind: results.every((r) => r.pass) ? 'pass' : 'fail', results }
  } catch (err) {
    outcome = {
      kind: 'compile-error',
      message: err instanceof CompileError ? err.message : `Unexpected error: ${String(err)}`,
    }
  }
  post({ type: 'result', id, outcome })
}

// Ready handshake — the main thread starts its timeout clock only after this,
// so a cold module load never masquerades as an infinite loop.
post({ type: 'ready' })
