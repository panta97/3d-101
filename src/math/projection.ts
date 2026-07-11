/**
 * Projection — Module 5. Turns a point in camera (view) space into a pixel on
 * the screen: the perspective divide, the projection matrix, the homogeneous
 * w coordinate, normalized device coordinates and the viewport transform. The
 * capstone reassembles project3() — the black box modules 1–4 leaned on — out
 * of these pieces.
 *
 * Conventions (course-wide, matching WebGL):
 *  - Right-handed view space; the camera sits at the origin looking down −z,
 *    so a visible point has NEGATIVE z and its depth is −z > 0.
 *  - Clip space carries a w; the perspective divide (÷w) lands every axis in
 *    normalized device coordinates (NDC) ∈ [−1, 1]: −1 = left/bottom/near,
 *    +1 = right/top/far.
 *  - Screen pixels: +x right, +y DOWN (canvas convention) — the viewport
 *    transform performs the y-flip.
 *  - Mat4 column-major, 16 numbers (same storage as Module 3).
 */

import type { Vec2 } from './vec2'
import { vec2 } from './vec2'
import type { Vec3 } from './vec3'
import { vec3 } from './vec3'
import type { Mat4 } from './mat4'

/**
 * A homogeneous 4D point. Module 3's transformPoint3 hid the w (it was always
 * 1); projection is where w finally earns its keep — it carries the depth that
 * the divide turns into perspective.
 */
export interface Vec4 {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly w: number
}

export const vec4 = (x: number, y: number, z: number, w: number): Vec4 => ({ x, y, z, w })

/**
 * Exercise 05/perspective-divide — the pinhole camera, by similar triangles.
 * Project a camera-space point onto an image plane `focal` units in front of
 * the eye. Dividing by depth (−z) is the whole of perspective: double the
 * depth, halve the image. Returns image-plane coordinates (+y up), not pixels.
 */
export const projectPinhole = (p: Vec3, focal: number): Vec2 => {
  const depth = -p.z
  return vec2((focal * p.x) / depth, (focal * p.y) / depth)
}

/**
 * Exercise 05/projection-matrix — the perspective projection matrix
 * (gluPerspective). f = 1/tan(fovY/2) is the focal length implied by the
 * vertical field of view; dividing the x term by the aspect ratio keeps the
 * picture from stretching. The −1 in the w row is the trick: it copies −z into
 * the output w, so the later divide is a divide by depth.
 */
// prettier-ignore
export const perspective = (fovY: number, aspect: number, near: number, far: number): Mat4 => {
  const f = 1 / Math.tan(fovY / 2)
  const nf = 1 / (near - far)
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]
}

/**
 * Exercise 05/clip-space — the full 4×4 · (x, y, z, 1), KEEPING w. Module 3's
 * transformPoint3 silently dropped the bottom row (it assumed w = 1); a
 * projection matrix puts −z down there, so this time the fourth coordinate is
 * the whole point. Returns the homogeneous clip-space point.
 */
export const transformPoint4 = (m: Mat4, p: Vec3): Vec4 =>
  vec4(
    m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
    m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
    m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14],
    m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15],
  )

/**
 * Exercise 05/clip-space — the perspective divide: collapse a homogeneous
 * clip-space point to 3D normalized device coordinates by dividing through by
 * w. This single division IS perspective; everything before it is linear.
 */
export const perspectiveDivide = (v: Vec4): Vec3 => vec3(v.x / v.w, v.y / v.w, v.z / v.w)

/**
 * Exercise 05/viewport — map normalized device coordinates (x, y ∈ [−1, 1])
 * onto a `width`×`height` pixel rectangle, flipping y because the canvas
 * counts pixels downward. NDC (−1, −1) is the bottom-left corner; on screen
 * that lands at (0, height).
 */
export const viewport = (ndc: Vec3, width: number, height: number): Vec2 =>
  vec2(((ndc.x + 1) / 2) * width, ((1 - ndc.y) / 2) * height)

/**
 * Exercise 05/orthographic — parallel projection: no foreshortening, no
 * divide. The w row stays (0, 0, 0, 1), so w = 1 and the perspective divide
 * does nothing. Maps a width×height box, near..far deep, onto the NDC cube
 * (near → −1, far → +1).
 */
// prettier-ignore
export const orthographic = (width: number, height: number, near: number, far: number): Mat4 => [
  2 / width, 0, 0, 0,
  0, 2 / height, 0, 0,
  0, 0, -2 / (far - near), 0,
  0, 0, -(far + near) / (far - near), 1,
]

/**
 * Exercise 05/project3 — the whole pipeline, finally un-boxed. A clip-space
 * matrix (projection · view · model) carries a model-space point all the way
 * to a screen pixel: transform keeping w, divide by w into NDC, then map NDC
 * onto the viewport. Returns null for points at or behind the camera (w ≤ 0),
 * which have no honest place on screen.
 */
export const project3 = (mvp: Mat4, p: Vec3, width: number, height: number): Vec2 | null => {
  const clip = transformPoint4(mvp, p)
  if (clip.w <= 1e-6) return null
  return viewport(perspectiveDivide(clip), width, height)
}
