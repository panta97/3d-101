/**
 * 4×4 matrices — Module 3.6–3.7 and everything after. Column-major, same
 * storage as WebGL:
 *
 *   [ m[0]  m[4]  m[8]   m[12] ]    columns 0–2: where x̂, ŷ, ẑ land
 *   [ m[1]  m[5]  m[9]   m[13] ]    column 3 (m[12..14]): where the origin went
 *   [ m[2]  m[6]  m[10]  m[14] ]
 *   [ m[3]  m[7]  m[11]  m[15] ]
 *
 * Storage order (column-major) and math convention (column vectors, M · v)
 * are two independent choices — we pin both, matching WebGL.
 */

import type { Vec3 } from './vec3'
import { vec3 } from './vec3'

// prettier-ignore
export type Mat4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
]

// prettier-ignore
export const identity4 = (): Mat4 => [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]

/** Exercise 03/mat4 */
// prettier-ignore
export const translation3 = (tx: number, ty: number, tz: number): Mat4 => [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  tx, ty, tz, 1,
]

/** Exercise 03/mat4 */
// prettier-ignore
export const scaling3 = (sx: number, sy: number, sz: number): Mat4 => [
  sx, 0, 0, 0,
  0, sy, 0, 0,
  0, 0, sz, 0,
  0, 0, 0, 1,
]

/** Exercise 03/mat4 — right-handed: rotationX(π/2) sends ŷ to ẑ. */
// prettier-ignore
export const rotationX = (theta: number): Mat4 => {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ]
}

/** Exercise 03/mat4 — right-handed: rotationY(π/2) sends x̂ to −ẑ and ẑ to x̂. */
// prettier-ignore
export const rotationY = (theta: number): Mat4 => {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ]
}

/** Exercise 03/mat4 — right-handed: rotationZ(π/2) sends x̂ to ŷ. */
// prettier-ignore
export const rotationZ = (theta: number): Mat4 => {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]
}

/** Exercise 03/mat4 — w = 1: translation applies. */
export const transformPoint3 = (m: Mat4, p: Vec3): Vec3 =>
  vec3(
    m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
    m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
    m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14],
  )

/** Exercise 03/mat4 — w = 0: directions ignore translation. */
export const transformDir3 = (m: Mat4, v: Vec3): Vec3 =>
  vec3(
    m[0] * v.x + m[4] * v.y + m[8] * v.z,
    m[1] * v.x + m[5] * v.y + m[9] * v.z,
    m[2] * v.x + m[6] * v.y + m[10] * v.z,
  )

/** Exercise 03/mat4 — mul4(a, b) means "apply b, then a". */
export const mul4 = (a: Mat4, b: Mat4): Mat4 => {
  const out = new Array<number>(16)
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k]
      out[col * 4 + row] = sum
    }
  }
  return out as unknown as Mat4
}
