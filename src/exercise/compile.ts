/**
 * The single compile path for learner code — used identically by the test
 * worker, the main-thread visualization hookup, and node-side solution tests.
 *
 * Learner code is plain JS function declarations. We wrap it as:
 *
 *   new Function('lib', '"use strict";
 *     const { dot, normalize } = lib;   // spec.provides
 *     <learner code>
 *     return { isInFov: … };            // spec.exports
 *   ')
 *
 * Note: requires an environment without a restrictive CSP (no 'unsafe-eval'
 * ban) — fine for static self-study hosting.
 */

import type { ExerciseSpec, UserFns, TestResult, Lib } from './types'
import { approxDeepEqual, formatValue } from './assert'
import { pickLib, LIB } from './lib'

export class CompileError extends Error {}

/**
 * Compile learner code.
 *
 * `scope` injects extra names alongside the spec's `provides` — they become
 * ordinary `const`s in the learner's scope, so an entry named `Math` or
 * `console` *shadows* the global one for the duration of their code. The
 * sandbox uses exactly that to hand out a seeded `Math.random` (deterministic
 * replay) and a `console` that records into the current frame. A scope name
 * wins over a `provides` name of the same spelling.
 */
export function compileUserCode(spec: ExerciseSpec, code: string, scope?: Lib): UserFns {
  const provides = spec.provides ?? []
  // Deduped: `const { add3, add3 } = lib` is a SyntaxError.
  const names = [...new Set([...provides, ...Object.keys(scope ?? {})])]
  const destructure = names.length ? `const { ${names.join(', ')} } = lib;` : ''
  // `typeof name` is safe even when `name` was never declared.
  const returns = spec.exports
    .map((n) => `${n}: typeof ${n} === 'function' ? ${n} : undefined`)
    .join(', ')

  let factory: (lib: unknown) => Record<string, unknown>
  try {
    factory = new Function(
      'lib',
      `"use strict";\n${destructure}\n${code}\n;return { ${returns} };`,
    ) as typeof factory
  } catch (err) {
    throw new CompileError(`Syntax error: ${err instanceof Error ? err.message : String(err)}`)
  }

  let result: Record<string, unknown>
  try {
    result = factory({ ...pickLib(provides), ...scope })
  } catch (err) {
    throw new CompileError(
      `Your code threw while loading: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  for (const name of spec.exports) {
    if (typeof result[name] !== 'function') {
      throw new CompileError(
        `Couldn't find a function named \`${name}\` — did you rename or delete it?`,
      )
    }
  }
  return result as UserFns
}

/** Run every test case against compiled learner functions. */
export function executeTests(spec: ExerciseSpec, fns: UserFns): TestResult[] {
  return spec.tests.map((t) => {
    try {
      const got = t.run(fns, LIB)
      if (approxDeepEqual(got, t.expect)) return { name: t.name, pass: true }
      const message =
        got === undefined
          ? `got undefined — did you forget \`return\`? (expected ${formatValue(t.expect)})`
          : `got ${formatValue(got)}, expected ${formatValue(t.expect)}`
      return { name: t.name, pass: false, message, hint: t.hint }
    } catch (err) {
      return {
        name: t.name,
        pass: false,
        message: `threw: ${err instanceof Error ? err.message : String(err)}`,
        hint: t.hint,
      }
    }
  })
}
