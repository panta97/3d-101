/**
 * mulberry32 — a seeded PRNG whose entire state is one uint32.
 *
 * The sandbox shadows `Math.random` inside learner code with this. That is
 * what buys deterministic replay: a fountain built on the real Math.random
 * draws fresh directions on every re-simulation, so stepping backward and
 * forward would show a different scene each pass. Because the state is a
 * single number, every recorded frame can carry the exact RNG state to
 * resume from — seeking is then a true restore, not an approximation.
 */

export interface Rng {
  next(): number
  /** Read/write the full generator state (one uint32). */
  state: number
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return {
    next(): number {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    get state(): number {
      return a >>> 0
    },
    set state(s: number) {
      a = s >>> 0
    },
  }
}
