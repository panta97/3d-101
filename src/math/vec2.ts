/**
 * 2D vectors as plain immutable objects. Every function here is built by
 * learners in Module 1–2 exercises (cited per function); this file is the
 * reference implementation that powers widgets, ghosts and solution tests.
 *
 * Conventions (course-wide): +X right, +Y up, angles in radians,
 * normalize(0) → 0 and project(a, 0) → 0 (the "NaN guard" policy).
 */

export interface Vec2 {
  readonly x: number
  readonly y: number
}

export const vec2 = (x: number, y: number): Vec2 => ({ x, y })

export const ZERO: Vec2 = vec2(0, 0)

/** Exercise 01/add */
export const add = (a: Vec2, b: Vec2): Vec2 => vec2(a.x + b.x, a.y + b.y)

/** Exercise 01/sub — points from b to a ("sub points at the first argument"). */
export const sub = (a: Vec2, b: Vec2): Vec2 => vec2(a.x - b.x, a.y - b.y)

/** Exercise 01/sub */
export const neg = (v: Vec2): Vec2 => vec2(-v.x, -v.y)

/** Exercise 01/scale-length */
export const scale = (v: Vec2, s: number): Vec2 => vec2(v.x * s, v.y * s)

/** Exercise 01/scale-length */
export const lengthSq = (v: Vec2): number => v.x * v.x + v.y * v.y

/** Exercise 01/scale-length */
export const length = (v: Vec2): number => Math.sqrt(lengthSq(v))

/** Exercise 01/normalize */
export const distance = (a: Vec2, b: Vec2): number => length(sub(a, b))

/** Exercise 01/normalize */
export const distanceSq = (a: Vec2, b: Vec2): number => lengthSq(sub(a, b))

/** Exercise 01/normalize — zero vector maps to zero, never NaN. */
export const normalize = (v: Vec2): Vec2 => {
  const len = length(v)
  return len === 0 ? ZERO : scale(v, 1 / len)
}

/** Exercise 01/lerp — t is deliberately not clamped. */
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => add(a, scale(sub(b, a), t))

/** Exercise 01/lerp (bonus) — frame-rate-independent lerp. */
export const damp = (a: Vec2, b: Vec2, rate: number, dt: number): Vec2 =>
  lerp(a, b, 1 - Math.exp(-rate * dt))

/** Exercise 02/dot */
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y

/** Exercise 02/project-reject — component of a along b; project(a, 0) → 0. */
export const project = (a: Vec2, b: Vec2): Vec2 => {
  const bb = lengthSq(b)
  return bb === 0 ? ZERO : scale(b, dot(a, b) / bb)
}

/** Exercise 02/project-reject — component of a perpendicular to b. */
export const reject = (a: Vec2, b: Vec2): Vec2 => sub(a, project(a, b))

/** Exercise 02/angles — always clamps before acos; floats hand you 1.0000000002. */
export const angleBetween = (a: Vec2, b: Vec2): number => {
  const la = length(a)
  const lb = length(b)
  if (la === 0 || lb === 0) return 0
  const c = dot(a, b) / (la * lb)
  return Math.acos(Math.min(1, Math.max(-1, c)))
}

/** Exercise 02/cross — the 2D cross product: positive when b is to the left of a. */
export const cross2 = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x

/** Exercise 02/reflect — n must be unit length. */
export const reflect = (v: Vec2, n: Vec2): Vec2 => sub(v, scale(n, 2 * dot(v, n)))
