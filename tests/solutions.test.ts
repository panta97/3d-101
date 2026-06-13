/**
 * Every exercise's shipped solution must pass its own tests through the SAME
 * new Function('lib', …) compile path the browser uses — this keeps solutions
 * green and proves the registry is runnable outside the DOM (this file runs
 * under node, so any DOM leak in an exercise spec import explodes here).
 */

import { describe, expect, it } from 'vitest'
import { allExercises } from '../src/exercise/registry'
import { compileUserCode, executeTests } from '../src/exercise/compile'

describe('exercise registry', () => {
  it('has at least the module 1 starter exercise', () => {
    expect(allExercises().length).toBeGreaterThan(0)
  })

  for (const spec of allExercises()) {
    describe(spec.id, () => {
      it('solution passes all of its tests', () => {
        const fns = compileUserCode(spec, spec.solution)
        const failing = executeTests(spec, fns).filter((r) => !r.pass)
        expect(failing, failing.map((f) => `${f.name}: ${f.message}`).join('\n')).toEqual([])
      })

      it('starter compiles (declares every export)', () => {
        expect(() => compileUserCode(spec, spec.starter)).not.toThrow()
      })

      it('spec is well-formed', () => {
        expect(spec.exports.length).toBeGreaterThan(0)
        expect(spec.tests.length).toBeGreaterThanOrEqual(3)
        expect(spec.codeVersion).toBeGreaterThanOrEqual(1)
      })
    })
  }
})
