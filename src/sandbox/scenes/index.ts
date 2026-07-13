/**
 * Every scene the sandbox can load. Add an exercise here to make it
 * steppable — the engine needs nothing else.
 */

import type { SandboxScene } from '../types'
import { fountain } from './fountain'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- scenes are heterogeneous in their state type
export const SCENES: SandboxScene<any>[] = [fountain]

export function getScene(id: string | null): SandboxScene<unknown> {
  return SCENES.find((s) => s.id === id) ?? SCENES[0]
}
