/**
 * 2×2 matrices — Module 3.1–3.3. Stored column-major as [ix, iy, jx, jy]:
 * column 1 (ix, iy) is where î = (1, 0) lands, column 2 (jx, jy) is where
 * ĵ = (0, 1) lands. We multiply column vectors: M · v, chains read
 * right-to-left.
 */

import type { Vec2 } from './vec2'
import { vec2 } from './vec2'

export type Mat2 = readonly [number, number, number, number]

export const identity2 = (): Mat2 => [1, 0, 0, 1]

/** Exercise 03/transform — literally x · column1 + y · column2. */
export const transformVec2 = (m: Mat2, v: Vec2): Vec2 =>
  vec2(m[0] * v.x + m[2] * v.y, m[1] * v.x + m[3] * v.y)

/** Exercise 03/factory — î → (cos θ, sin θ), ĵ → (−sin θ, cos θ). */
export const rotation2 = (theta: number): Mat2 => {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [c, s, -s, c]
}

/** Exercise 03/factory */
export const scaling2 = (sx: number, sy: number): Mat2 => [sx, 0, 0, sy]

/** Exercise 03/factory — the area-scaling factor; negative = the grid flipped. */
export const det2 = (m: Mat2): number => m[0] * m[3] - m[2] * m[1]

/**
 * Exercise 03/compose — mul2(a, b) means "apply b, then a". Each column of
 * the result is just b's column run through a (you wrote that in 03/transform).
 */
export const mul2 = (a: Mat2, b: Mat2): Mat2 => {
  const c0 = transformVec2(a, vec2(b[0], b[1]))
  const c1 = transformVec2(a, vec2(b[2], b[3]))
  return [c0.x, c0.y, c1.x, c1.y]
}
