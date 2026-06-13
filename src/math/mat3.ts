/**
 * 3×3 matrices used as 2D homogeneous transforms — Module 3.4–3.5.
 * Column-major, 9 elements:
 *
 *   [ m[0]  m[3]  m[6] ]      columns 0–1: the 2×2 linear part
 *   [ m[1]  m[4]  m[7] ]      column 2 (m[6], m[7]): where the origin went
 *   [ m[2]  m[5]  m[8] ]      bottom row stays (0, 0, 1) for affine maps
 *
 * Points get w = 1 (they translate); directions get w = 0 (they don't).
 */

import type { Vec2 } from './vec2'
import { vec2 } from './vec2'
import type { Mat2 } from './mat2'
import { rotation2 } from './mat2'

// prettier-ignore
export type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
]

// prettier-ignore
export const identity3 = (): Mat3 => [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
]

/** Exercise 03/homogeneous — translation is a shear of the w = 1 plane. */
// prettier-ignore
export const translation2 = (tx: number, ty: number): Mat3 => [
  1, 0, 0,
  0, 1, 0,
  tx, ty, 1,
]

/** Lift a 2×2 linear transform into homogeneous form (origin fixed). */
// prettier-ignore
export const mat3FromMat2 = (m: Mat2): Mat3 => [
  m[0], m[1], 0,
  m[2], m[3], 0,
  0, 0, 1,
]

/** Exercise 03/homogeneous — w = 1: the translation column applies. */
export const transformPoint2 = (m: Mat3, p: Vec2): Vec2 =>
  vec2(m[0] * p.x + m[3] * p.y + m[6], m[1] * p.x + m[4] * p.y + m[7])

/** Exercise 03/homogeneous — w = 0: directions ignore translation. */
export const transformDir2 = (m: Mat3, v: Vec2): Vec2 =>
  vec2(m[0] * v.x + m[3] * v.y, m[1] * v.x + m[4] * v.y)

/** Exercise 03/sandwich */
export const mul3 = (a: Mat3, b: Mat3): Mat3 => {
  const out = new Array<number>(9)
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) {
      let sum = 0
      for (let k = 0; k < 3; k++) sum += a[k * 3 + row] * b[col * 3 + k]
      out[col * 3 + row] = sum
    }
  }
  return out as unknown as Mat3
}

/**
 * Exercise 03/sandwich — T(p) · R(θ) · T(−p): carry the hinge to the origin,
 * rotate there, carry it back.
 */
export const rotationAbout = (p: Vec2, theta: number): Mat3 =>
  mul3(translation2(p.x, p.y), mul3(mat3FromMat2(rotation2(theta)), translation2(-p.x, -p.y)))
