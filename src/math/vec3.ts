/**
 * 3D vectors as plain immutable objects. Deliberately mirrors vec2.ts with
 * identical unsuffixed names — import namespaced:
 *   import * as v3 from '@/math/vec3'
 *
 * Conventions: right-handed, +X right, +Y up, +Z toward the viewer.
 */

export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

export const ZERO: Vec3 = vec3(0, 0, 0)

/** Exercise 01/vec3 */
export const add = (a: Vec3, b: Vec3): Vec3 => vec3(a.x + b.x, a.y + b.y, a.z + b.z)

/** Exercise 01/vec3 */
export const sub = (a: Vec3, b: Vec3): Vec3 => vec3(a.x - b.x, a.y - b.y, a.z - b.z)

/** Exercise 01/vec3 */
export const neg = (v: Vec3): Vec3 => vec3(-v.x, -v.y, -v.z)

/** Exercise 01/vec3 */
export const scale = (v: Vec3, s: number): Vec3 => vec3(v.x * s, v.y * s, v.z * s)

/** Exercise 01/vec3 — "the only new math in 3D is one more + z*z". */
export const lengthSq = (v: Vec3): number => v.x * v.x + v.y * v.y + v.z * v.z

/** Exercise 01/vec3 */
export const length = (v: Vec3): number => Math.sqrt(lengthSq(v))

/** Exercise 01/vec3 */
export const distance = (a: Vec3, b: Vec3): number => length(sub(a, b))

/** Exercise 01/vec3 */
export const distanceSq = (a: Vec3, b: Vec3): number => lengthSq(sub(a, b))

/** Exercise 01/vec3 — zero vector maps to zero, never NaN. */
export const normalize = (v: Vec3): Vec3 => {
  const len = length(v)
  return len === 0 ? ZERO : scale(v, 1 / len)
}

/** Exercise 01/vec3 — t is deliberately not clamped. */
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t))

/** Frame-rate-independent lerp (see exercise 01/lerp). */
export const damp = (a: Vec3, b: Vec3, rate: number, dt: number): Vec3 =>
  lerp(a, b, 1 - Math.exp(-rate * dt))

/** Exercise 02/dot */
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z

/** Exercise 02/project-reject — project(a, 0) → 0. */
export const project = (a: Vec3, b: Vec3): Vec3 => {
  const bb = lengthSq(b)
  return bb === 0 ? ZERO : scale(b, dot(a, b) / bb)
}

/** Exercise 02/project-reject */
export const reject = (a: Vec3, b: Vec3): Vec3 => sub(a, project(a, b))

/** Exercise 02/angles — clamped acos. */
export const angleBetween = (a: Vec3, b: Vec3): number => {
  const la = length(a)
  const lb = length(b)
  if (la === 0 || lb === 0) return 0
  const c = dot(a, b) / (la * lb)
  return Math.acos(Math.min(1, Math.max(-1, c)))
}

/**
 * Exercise 02/cross — right-handed: cross(x̂, ŷ) = ẑ. The only vector
 * guaranteed perpendicular to both inputs; length = parallelogram area.
 */
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)

/** Exercise 02/reflect — n must be unit length. */
export const reflect = (v: Vec3, n: Vec3): Vec3 => sub(v, scale(n, 2 * dot(v, n)))
