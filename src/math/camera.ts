/**
 * Coordinate frames and the camera — Module 4. Built on the course's own
 * vector math (normalize + cross + dot) plus the Mat4 constructors, so the
 * view matrix the learner assembles here uses nothing they haven't built.
 *
 * Conventions (matching WebGL / the infra Camera3D):
 *  - Right-handed world, +X right, +Y up, +Z toward the viewer.
 *  - Camera space looks down −z: the eye sits at the origin and gazes toward
 *    −z, so a frame's "back" axis (its column 2) points away from the target.
 */

import type { Vec3 } from './vec3'
import { vec3, sub, neg, dot, cross, normalize } from './vec3'
import type { Mat4 } from './mat4'
import { frameMatrix, invertRigid } from './mat4'

/** An orthonormal coordinate frame: three mutually perpendicular unit axes. */
export interface Basis {
  readonly right: Vec3
  readonly up: Vec3
  readonly fwd: Vec3
}

/**
 * Exercise 04/orthonormal — manufacture a clean orthonormal frame from a
 * desired forward and a rough up (Gram-Schmidt). `right` is forced
 * perpendicular to both; `up` is then recomputed so all three are exactly
 * perpendicular and unit length, even when the supplied `up` was neither.
 */
export const orthonormalBasis = (fwd: Vec3, up: Vec3): Basis => {
  const f = normalize(fwd)
  const right = normalize(cross(f, up))
  const trueUp = cross(right, f)
  return { right, up: trueUp, fwd: f }
}

/**
 * Exercise 04/change-of-basis — express a world point in an orthonormal
 * frame's local coordinates. Subtract the origin, then read each coordinate
 * as the projection (dot product) onto that axis.
 */
export const worldToLocal = (o: Vec3, x: Vec3, y: Vec3, z: Vec3, p: Vec3): Vec3 => {
  const rel = sub(p, o)
  return vec3(dot(rel, x), dot(rel, y), dot(rel, z))
}

/**
 * Exercise 04/camera-to-world — the matrix that places the camera in the
 * world: columns are the camera's right / up / back axes, with the eye in
 * column 3. Maps camera-space coordinates out into world space.
 */
export const cameraToWorld = (eye: Vec3, target: Vec3, up: Vec3): Mat4 => {
  const { right, up: trueUp, fwd } = orthonormalBasis(sub(target, eye), up)
  // Column 2 is "back" = −forward, because camera space looks down −z.
  return frameMatrix(right, trueUp, neg(fwd), eye)
}

/**
 * Exercise 04/view-matrix — the world→camera (view) matrix: the inverse of
 * cameraToWorld. Because that matrix is rigid, the inverse is the cheap one.
 */
export const lookAt = (eye: Vec3, target: Vec3, up: Vec3): Mat4 =>
  invertRigid(cameraToWorld(eye, target, up))
