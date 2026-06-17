/**
 * The reference library exposed to exercises — both as `provides` injections
 * into learner code and as the `lib` argument of test `run` functions.
 *
 * Naming rule (course-wide): unsuffixed names are the Vec2 versions
 * (add, dot, cross2, …), '3'-suffixed names are the Vec3 versions
 * (add3, dot3, reflect3, …) — except `cross`, which is inherently 3D.
 */

import { v2, v3, m2, m3, m4, pl, cam } from '@/math'
import type { Lib } from './types'

export const LIB: Lib = {
  // vec2
  vec2: v2.vec2,
  add: v2.add,
  sub: v2.sub,
  neg: v2.neg,
  scale: v2.scale,
  length: v2.length,
  lengthSq: v2.lengthSq,
  distance: v2.distance,
  distanceSq: v2.distanceSq,
  normalize: v2.normalize,
  lerp: v2.lerp,
  damp: v2.damp,
  dot: v2.dot,
  project: v2.project,
  reject: v2.reject,
  angleBetween: v2.angleBetween,
  cross2: v2.cross2,
  reflect: v2.reflect,

  // vec3
  vec3: v3.vec3,
  add3: v3.add,
  sub3: v3.sub,
  neg3: v3.neg,
  scale3: v3.scale,
  length3: v3.length,
  lengthSq3: v3.lengthSq,
  distance3: v3.distance,
  distanceSq3: v3.distanceSq,
  normalize3: v3.normalize,
  lerp3: v3.lerp,
  damp3: v3.damp,
  dot3: v3.dot,
  project3v: v3.project,
  reject3: v3.reject,
  angleBetween3: v3.angleBetween,
  cross: v3.cross,
  reflect3: v3.reflect,

  // plane
  plane: pl.plane,
  signedDistance: pl.signedDistance,
  classifyPoint: pl.classifyPoint,
  planeFromPoints: pl.planeFromPoints,

  // mat2
  identity2: m2.identity2,
  transformVec2: m2.transformVec2,
  rotation2: m2.rotation2,
  scaling2: m2.scaling2,
  det2: m2.det2,
  mul2: m2.mul2,

  // mat3 (2D homogeneous)
  identity3: m3.identity3,
  mul3: m3.mul3,
  translation2: m3.translation2,
  transformPoint2: m3.transformPoint2,
  transformDir2: m3.transformDir2,
  mat3FromMat2: m3.mat3FromMat2,
  rotationAbout: m3.rotationAbout,

  // mat4
  identity4: m4.identity4,
  mul4: m4.mul4,
  translation3: m4.translation3,
  rotationX: m4.rotationX,
  rotationY: m4.rotationY,
  rotationZ: m4.rotationZ,
  scaling3: m4.scaling3,
  transformPoint3: m4.transformPoint3,
  transformDir3: m4.transformDir3,
  frameMatrix: m4.frameMatrix,
  transpose4: m4.transpose4,
  invertRigid: m4.invertRigid,

  // camera / coordinate frames (mod 4)
  orthonormalBasis: cam.orthonormalBasis,
  worldToLocal: cam.worldToLocal,
  cameraToWorld: cam.cameraToWorld,
  lookAt: cam.lookAt,
}

/** Subset of LIB named by a spec's `provides`, for scope injection. */
export function pickLib(provides: string[] | undefined): Lib {
  const out: Lib = {}
  for (const name of provides ?? []) {
    if (!(name in LIB)) throw new Error(`Unknown provides entry: ${name}`)
    out[name] = LIB[name]
  }
  return out
}
