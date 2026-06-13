/**
 * Per-exercise persistence in localStorage. Keys are versioned by the spec's
 * codeVersion, so shipping a new starter never clobbers old attempts.
 */

import type { ExerciseSpec } from './types'

export interface SavedState {
  code: string
  passedAt?: number
  revealed?: boolean
}

const key = (id: string, version: number) => `3d101:code:${id}:v${version}`

export function loadState(spec: ExerciseSpec): SavedState | null {
  try {
    const raw = localStorage.getItem(key(spec.id, spec.codeVersion))
    return raw ? (JSON.parse(raw) as SavedState) : null
  } catch {
    return null
  }
}

export function saveState(spec: ExerciseSpec, state: SavedState): void {
  try {
    localStorage.setItem(key(spec.id, spec.codeVersion), JSON.stringify(state))
  } catch {
    // Storage full/blocked — losing persistence is acceptable.
  }
}

/** Most recent attempt saved under an older codeVersion, if any. */
export function previousVersionState(spec: ExerciseSpec): SavedState | null {
  for (let v = spec.codeVersion - 1; v >= 1; v--) {
    try {
      const raw = localStorage.getItem(key(spec.id, v))
      if (raw) return JSON.parse(raw) as SavedState
    } catch {
      /* ignore */
    }
  }
  return null
}
