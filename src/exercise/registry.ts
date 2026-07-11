/**
 * All exercises, keyed by id. DOM-FREE: imported by the Web Worker and by
 * node-side vitest. Module content registers exercises via the per-module
 * barrel files in src/content/exercises/.
 */

import type { ExerciseSpec } from './types'
import { M01_EXERCISES } from '@/content/exercises/m01'
import { M02_EXERCISES } from '@/content/exercises/m02'
import { M03_EXERCISES } from '@/content/exercises/m03'
import { M04_EXERCISES } from '@/content/exercises/m04'
import { M05_EXERCISES } from '@/content/exercises/m05'

const all: ExerciseSpec[] = [
  ...M01_EXERCISES,
  ...M02_EXERCISES,
  ...M03_EXERCISES,
  ...M04_EXERCISES,
  ...M05_EXERCISES,
]

const byId = new Map<string, ExerciseSpec>()
for (const spec of all) {
  if (byId.has(spec.id)) throw new Error(`Duplicate exercise id: ${spec.id}`)
  byId.set(spec.id, spec)
}

export function getExercise(id: string): ExerciseSpec {
  const spec = byId.get(id)
  if (!spec) throw new Error(`Unknown exercise id: ${id}`)
  return spec
}

export function allExercises(): readonly ExerciseSpec[] {
  return all
}
