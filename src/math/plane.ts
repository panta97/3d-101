/**
 * Planes — Module 2.5. Convention (pinned for the whole course):
 * a plane is a unit normal n and a number d; the plane is every point p where
 * dot(n, p) = d. The signed distance dot(n, p) − d is positive on the side
 * n points toward.
 */

import type { Vec3 } from './vec3'
import * as v3 from './vec3'

export interface Plane {
  /** Unit normal. */
  readonly n: Vec3
  readonly d: number
}

export const plane = (n: Vec3, d: number): Plane => ({ n, d })

/** Exercise 02/planes — "which side, and how far" in one subtraction. */
export const signedDistance = (pl: Plane, p: Vec3): number => v3.dot(pl.n, p) - pl.d

export type PlaneSide = 'front' | 'back' | 'on'

/** Exercise 02/planes */
export const classifyPoint = (pl: Plane, p: Vec3, eps = 1e-6): PlaneSide => {
  const d = signedDistance(pl, p)
  if (d > eps) return 'front'
  if (d < -eps) return 'back'
  return 'on'
}

/**
 * Exercise 02/planes — counter-clockwise winding (seen from the front side)
 * determines which way the normal points.
 */
export const planeFromPoints = (a: Vec3, b: Vec3, c: Vec3): Plane => {
  const n = v3.normalize(v3.cross(v3.sub(b, a), v3.sub(c, a)))
  return plane(n, v3.dot(n, a))
}
