/**
 * The course math library. Import namespaced so vec2/vec3 can share names:
 *
 *   import { v2, v3, m2, m3, m4, pl } from '@/math'
 *   v3.normalize(v3.cross(a, b))
 */

export * as v2 from './vec2'
export * as v3 from './vec3'
export * as m2 from './mat2'
export * as m3 from './mat3'
export * as m4 from './mat4'
export * as pl from './plane'

export type { Vec2 } from './vec2'
export type { Vec3 } from './vec3'
export type { Mat2 } from './mat2'
export type { Mat3 } from './mat3'
export type { Mat4 } from './mat4'
export type { Plane, PlaneSide } from './plane'
