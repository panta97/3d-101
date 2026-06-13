/**
 * Shared guards for values coming back from learner code. Widgets must never
 * trust a user function's return shape — one wrong return and the canvas
 * fills with NaN.
 */

import type { Vec2, Vec3 } from '@/math'

export function isVec2(v: unknown): v is Vec2 {
  return (
    typeof v === 'object' &&
    v !== null &&
    Number.isFinite((v as Vec2).x) &&
    Number.isFinite((v as Vec2).y)
  )
}

export function isVec3(v: unknown): v is Vec3 {
  return (
    typeof v === 'object' &&
    v !== null &&
    Number.isFinite((v as Vec3).x) &&
    Number.isFinite((v as Vec3).y) &&
    Number.isFinite((v as Vec3).z)
  )
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Flat numeric array of an exact length (matrix returns). */
export function isNumberArray(v: unknown, len: number): v is number[] {
  return Array.isArray(v) && v.length === len && v.every((n) => Number.isFinite(n))
}
