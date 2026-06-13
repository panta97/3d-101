/**
 * Exercise system types. IMPORTANT: everything reachable from an ExerciseSpec
 * must stay DOM-free — specs are imported by the test-runner Web Worker and
 * by node-side vitest. Widgets live elsewhere (src/content/widgets/).
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- learner code and the
   reference lib are called with arbitrary shapes from test definitions. */
export type UserFns = Record<string, (...args: any[]) => any>

/** The reference library handed to test `run` functions and injected via `provides`. */
export type Lib = Record<string, any>

export interface TestCase {
  /** Display string, e.g. "add((1,2), (3,4))". */
  name: string
  /**
   * Execute the learner's exports and return the value to compare.
   * `lib` is the full reference library (for property tests that need
   * known-good functions alongside the learner's).
   */
  run(fns: UserFns, lib: Lib): unknown
  /** Expected value; compared with the deep ε-comparator (ε = 1e-6). */
  expect: unknown
  /** Shown only when this test fails. */
  hint?: string
}

export interface ExerciseSpec {
  /** Stable id, e.g. "01/add". Used for storage keys and widget linking. */
  id: string
  title: string
  /** TypeScript signature(s) shown read-only above the editor. */
  signature: string
  /** Initial editor contents — plain JavaScript function declarations. */
  starter: string
  /** Reference solution; must pass all tests (enforced by solutions.test.ts). */
  solution: string
  /** Function names the learner must define. */
  exports: string[]
  /** Reference-library names injected into the learner's scope. */
  provides?: string[]
  tests: TestCase[]
  /** Bump when starter/tests change incompatibly; keys old saved code aside. */
  codeVersion: number
}

export interface TestResult {
  name: string
  pass: boolean
  /** Failure detail ("got …, expected …" or a thrown error). */
  message?: string
  hint?: string
}

export type RunOutcome =
  | { kind: 'pass'; results: TestResult[] }
  | { kind: 'fail'; results: TestResult[] }
  | { kind: 'compile-error'; message: string }
  | { kind: 'timeout' }

/** Messages crossing the worker boundary (structured-clone-safe only). */
export type WorkerRequest = { id: number; exerciseId: string; code: string }
export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; id: number; outcome: RunOutcome }
