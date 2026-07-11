import { describe, expect, it } from 'vitest'
import { v2, v3, m2, m3, m4, pl, cam, proj } from '../src/math'
import type { Vec2, Vec3 } from '../src/math'

const EPS = 1e-6

const near = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(EPS)
const near2 = (got: Vec2, want: { x: number; y: number }) => {
  near(got.x, want.x)
  near(got.y, want.y)
}
const near3 = (got: Vec3, want: { x: number; y: number; z: number }) => {
  near(got.x, want.x)
  near(got.y, want.y)
  near(got.z, want.z)
}
const nearArr = (got: readonly number[], want: readonly number[]) => {
  expect(got.length).toBe(want.length)
  for (let i = 0; i < want.length; i++) near(got[i], want[i])
}

describe('vec2', () => {
  it('add', () => {
    near2(v2.add(v2.vec2(1, 2), v2.vec2(3, 4)), { x: 4, y: 6 })
    near2(v2.add(v2.vec2(-1, 5), v2.vec2(1, -5)), { x: 0, y: 0 })
    near2(v2.add(v2.vec2(0.1, 0.2), v2.vec2(0.2, 0.1)), { x: 0.3, y: 0.3 })
  })

  it('sub points at the first argument', () => {
    near2(v2.sub(v2.vec2(5, 7), v2.vec2(2, 3)), { x: 3, y: 4 })
    near2(v2.sub(v2.vec2(2, 3), v2.vec2(5, 7)), { x: -3, y: -4 })
    const a = v2.vec2(9, -2)
    const b = v2.vec2(4, 4)
    near2(v2.add(b, v2.sub(a, b)), a)
  })

  it('neg', () => {
    near2(v2.neg(v2.vec2(3, -4)), { x: -3, y: 4 })
  })

  it('scale / length / lengthSq', () => {
    near2(v2.scale(v2.vec2(3, -2), 2), { x: 6, y: -4 })
    near2(v2.scale(v2.vec2(3, -2), -1), { x: -3, y: 2 })
    near(v2.length(v2.vec2(3, 4)), 5)
    near(v2.length(v2.vec2(-3, -4)), 5)
    near(v2.length(v2.vec2(1, 1)), Math.SQRT2)
    near(v2.length(v2.vec2(0, 0)), 0)
    near(v2.lengthSq(v2.vec2(3, 4)), 25)
  })

  it('normalize, incl. the NaN guard', () => {
    near2(v2.normalize(v2.vec2(3, 4)), { x: 0.6, y: 0.8 })
    near2(v2.normalize(v2.vec2(0, 5)), { x: 0, y: 1 })
    near2(v2.normalize(v2.vec2(1, 1)), { x: Math.SQRT1_2, y: Math.SQRT1_2 })
    near2(v2.normalize(v2.vec2(0, 0)), { x: 0, y: 0 })
  })

  it('distance / distanceSq', () => {
    near(v2.distance(v2.vec2(1, 2), v2.vec2(4, 6)), 5)
    near(v2.distance(v2.vec2(3, 3), v2.vec2(3, 3)), 0)
    near(v2.distanceSq(v2.vec2(1, 2), v2.vec2(4, 6)), 25)
  })

  it('lerp is unclamped; damp is frame-rate independent', () => {
    near2(v2.lerp(v2.vec2(0, 0), v2.vec2(10, 20), 0.5), { x: 5, y: 10 })
    near2(v2.lerp(v2.vec2(2, 4), v2.vec2(6, 8), 0.25), { x: 3, y: 5 })
    near2(v2.lerp(v2.vec2(0, 0), v2.vec2(1, 1), 2), { x: 2, y: 2 })

    let slow = v2.vec2(0, 0)
    let fast = v2.vec2(0, 0)
    const target = v2.vec2(10, 0)
    for (let i = 0; i < 2; i++) slow = v2.damp(slow, target, 5, 1 / 30)
    for (let i = 0; i < 4; i++) fast = v2.damp(fast, target, 5, 1 / 60)
    near(slow.x, fast.x)
  })

  it('dot', () => {
    near(v2.dot(v2.vec2(1, 0), v2.vec2(0, 1)), 0)
    near(v2.dot(v2.vec2(2, 3), v2.vec2(4, 5)), 23)
    near(v2.dot(v2.vec2(2, 3), v2.vec2(4, -5)), -7)
    near(v2.dot(v2.vec2(3, 4), v2.vec2(3, 4)), 25)
  })

  it('project / reject decompose a', () => {
    near2(v2.project(v2.vec2(3, 4), v2.vec2(10, 0)), { x: 3, y: 0 })
    near2(v2.project(v2.vec2(2, 2), v2.vec2(0, 5)), { x: 0, y: 2 })
    near2(v2.project(v2.vec2(3, 4), v2.vec2(1, 1)), { x: 3.5, y: 3.5 })
    near2(v2.project(v2.vec2(1, 2), v2.vec2(0, 0)), { x: 0, y: 0 })
    near2(v2.reject(v2.vec2(3, 4), v2.vec2(10, 0)), { x: 0, y: 4 })
    const a = v2.vec2(7, -2)
    const b = v2.vec2(3, 1)
    near2(v2.add(v2.project(a, b), v2.reject(a, b)), a)
    near(v2.dot(v2.reject(v2.vec2(3, 4), v2.vec2(1, 1)), v2.vec2(1, 1)), 0)
  })

  it('angleBetween clamps acos', () => {
    near(v2.angleBetween(v2.vec2(1, 0), v2.vec2(0, 1)), Math.PI / 2)
    near(v2.angleBetween(v2.vec2(1, 0), v2.vec2(1, 1)), Math.PI / 4)
    near(v2.angleBetween(v2.vec2(1, 0), v2.vec2(-1, 0)), Math.PI)
    near(v2.angleBetween(v2.vec2(2, 0), v2.vec2(4, 0)), 0)
    // A vector with itself: the cosine rounds to 1.0000000000000002, so an
    // unclamped acos(dot/(|a||b|)) returns NaN — this input genuinely needs
    // the clamp that angleBetween performs.
    const dirty = v2.vec2(0.1, 0.7)
    expect(Math.acos(v2.dot(dirty, dirty) / (v2.length(dirty) * v2.length(dirty)))).toBeNaN()
    near(v2.angleBetween(dirty, dirty), 0)
  })

  it('cross2 sign says left-or-right', () => {
    near(v2.cross2(v2.vec2(1, 0), v2.vec2(0, 1)), 1)
    near(v2.cross2(v2.vec2(1, 0), v2.vec2(0, -1)), -1)
  })

  it('reflect preserves length', () => {
    near2(v2.reflect(v2.vec2(1, -1), v2.vec2(0, 1)), { x: 1, y: 1 })
    near2(v2.reflect(v2.vec2(2, -3), v2.vec2(0, 1)), { x: 2, y: 3 })
    // A "\"-tilted mirror: surface along (1,−1), unit normal (1,1)/√2.
    const mirror45 = v2.normalize(v2.vec2(1, 1))
    near2(v2.reflect(v2.vec2(0, -1), mirror45), { x: 1, y: 0 })
    near2(v2.reflect(v2.vec2(1, 0), v2.vec2(0, 1)), { x: 1, y: 0 })
    near(v2.length(v2.reflect(v2.vec2(3, 4), v2.normalize(v2.vec2(2, 5)))), 5)
  })
})

describe('vec3', () => {
  it('mirrors vec2 in 3D', () => {
    near3(v3.add(v3.vec3(1, 2, 3), v3.vec3(4, 5, 6)), { x: 5, y: 7, z: 9 })
    near(v3.length(v3.vec3(2, 3, 6)), 7)
    near(v3.length(v3.vec3(1, 2, 2)), 3)
    near3(v3.normalize(v3.vec3(0, 3, 4)), { x: 0, y: 0.6, z: 0.8 })
    near3(v3.lerp(v3.vec3(0, 0, 0), v3.vec3(10, -10, 4), 0.5), { x: 5, y: -5, z: 2 })
    near(v3.distance(v3.vec3(1, 2, 3), v3.vec3(3, 5, 9)), 7)
    near3(v3.normalize(v3.vec3(0, 0, 0)), { x: 0, y: 0, z: 0 })
    near(v3.dot(v3.vec3(1, 2, 3), v3.vec3(4, -5, 6)), 12)
  })

  it('cross is right-handed and anticommutative', () => {
    near3(v3.cross(v3.vec3(1, 0, 0), v3.vec3(0, 1, 0)), { x: 0, y: 0, z: 1 })
    near3(v3.cross(v3.vec3(0, 1, 0), v3.vec3(1, 0, 0)), { x: 0, y: 0, z: -1 })
    near3(v3.cross(v3.vec3(2, 0, 0), v3.vec3(4, 0, 0)), { x: 0, y: 0, z: 0 })
    near3(v3.cross(v3.vec3(1, 2, 3), v3.vec3(4, 5, 6)), { x: -3, y: 6, z: -3 })
    near3(v3.cross(v3.vec3(3, 0, 0), v3.vec3(0, 4, 0)), { x: 0, y: 0, z: 12 })
    const a = v3.vec3(2, -1, 5)
    const b = v3.vec3(-3, 4, 1)
    near(v3.dot(v3.cross(a, b), a), 0)
    near(v3.dot(v3.cross(a, b), b), 0)
  })

  it('reflect', () => {
    near3(v3.reflect(v3.vec3(1, 2, -1), v3.vec3(0, 0, 1)), { x: 1, y: 2, z: 1 })
  })
})

describe('plane', () => {
  const ground = pl.plane(v3.vec3(0, 1, 0), 0)

  it('signedDistance', () => {
    near(pl.signedDistance(ground, v3.vec3(5, 3, 2)), 3)
    near(pl.signedDistance(ground, v3.vec3(0, -2, 0)), -2)
    near(pl.signedDistance(pl.plane(v3.vec3(0, 0, 1), 5), v3.vec3(1, 2, 9)), 4)
    const tilted = pl.plane(v3.normalize(v3.vec3(1, 1, 0)), 0)
    near(pl.signedDistance(tilted, v3.vec3(1, 1, 0)), Math.SQRT2)
  })

  it('classifyPoint', () => {
    expect(pl.classifyPoint(ground, v3.vec3(3, 0, 7))).toBe('on')
    expect(pl.classifyPoint(ground, v3.vec3(3, 2, 7))).toBe('front')
    expect(pl.classifyPoint(ground, v3.vec3(3, -2, 7))).toBe('back')
  })

  it('planeFromPoints — winding determines the normal', () => {
    const a = pl.planeFromPoints(v3.vec3(0, 0, 0), v3.vec3(1, 0, 0), v3.vec3(0, 1, 0))
    near3(a.n, { x: 0, y: 0, z: 1 })
    near(a.d, 0)
    const b = pl.planeFromPoints(v3.vec3(0, 2, 0), v3.vec3(0, 2, 1), v3.vec3(1, 2, 0))
    near3(b.n, { x: 0, y: 1, z: 0 })
    near(b.d, 2)
  })
})

describe('mat2', () => {
  const rot90 = m2.rotation2(Math.PI / 2)

  it('transformVec2 reads columns', () => {
    near2(m2.transformVec2(m2.identity2(), v2.vec2(3, 7)), { x: 3, y: 7 })
    near2(m2.transformVec2([0, 1, -1, 0], v2.vec2(1, 0)), { x: 0, y: 1 })
    near2(m2.transformVec2([0, 1, -1, 0], v2.vec2(2, 3)), { x: -3, y: 2 })
    near2(m2.transformVec2([1, 0, 1, 1], v2.vec2(0, 2)), { x: 2, y: 2 })
    near2(m2.transformVec2([2, 0, 0, 3], v2.vec2(4, 5)), { x: 8, y: 15 })
    near2(m2.transformVec2([5, 6, 7, 8], v2.vec2(1, 0)), { x: 5, y: 6 })
  })

  it('factories', () => {
    nearArr(m2.rotation2(0), [1, 0, 0, 1])
    nearArr(rot90, [0, 1, -1, 0])
    nearArr(m2.rotation2(Math.PI / 6), [0.8660254, 0.5, -0.5, 0.8660254])
    nearArr(m2.scaling2(2, 3), [2, 0, 0, 3])
  })

  it('det2', () => {
    near(m2.det2(m2.identity2()), 1)
    near(m2.det2([2, 0, 0, 3]), 6)
    near(m2.det2(m2.rotation2(0.7)), 1)
    near(m2.det2([0, 1, 1, 0]), -1)
  })

  it('mul2 — apply b, then a; non-commutative', () => {
    nearArr(m2.mul2(rot90, rot90), [-1, 0, 0, -1])
    nearArr(m2.mul2(m2.identity2(), [5, 6, 7, 8]), [5, 6, 7, 8])
    const S = m2.scaling2(2, 1)
    nearArr(m2.mul2(S, rot90), [0, 1, -2, 0])
    nearArr(m2.mul2(rot90, S), [0, 2, -1, 0])
    near2(m2.transformVec2(m2.mul2(S, rot90), v2.vec2(1, 1)), { x: -2, y: 1 })
    near(m2.det2(m2.mul2(S, rot90)), 2)
  })
})

describe('mat3 (2D homogeneous)', () => {
  it('translation moves points, not directions', () => {
    nearArr(m3.translation2(3, 5), [1, 0, 0, 0, 1, 0, 3, 5, 1])
    const t = m3.translation2(3, 5)
    near2(m3.transformPoint2(t, v2.vec2(1, 1)), { x: 4, y: 6 })
    near2(m3.transformPoint2(t, v2.vec2(0, 0)), { x: 3, y: 5 })
    near2(m3.transformDir2(t, v2.vec2(1, 1)), { x: 1, y: 1 })
    near2(m3.transformDir2(t, v2.vec2(0, 2)), { x: 0, y: 2 })
    near2(m3.transformDir2([0, 1, 0, -1, 0, 0, 7, 8, 1], v2.vec2(1, 0)), { x: 0, y: 1 })
  })

  it('mul3 and the sandwich', () => {
    const X = m3.translation2(4, -1)
    nearArr(m3.mul3(m3.identity3(), X), X as unknown as number[])
    near2(
      m3.transformPoint2(m3.mul3(m3.translation2(1, 0), m3.translation2(0, 2)), v2.vec2(0, 0)),
      { x: 1, y: 2 },
    )
    near2(m3.transformPoint2(m3.rotationAbout(v2.vec2(2, 0), Math.PI), v2.vec2(3, 0)), { x: 1, y: 0 })
    near2(m3.transformPoint2(m3.rotationAbout(v2.vec2(2, 0), Math.PI), v2.vec2(2, 0)), { x: 2, y: 0 })
    near2(m3.transformPoint2(m3.rotationAbout(v2.vec2(0, 0), Math.PI / 2), v2.vec2(1, 0)), { x: 0, y: 1 })
    near2(m3.transformPoint2(m3.rotationAbout(v2.vec2(1, 1), Math.PI / 2), v2.vec2(2, 1)), { x: 1, y: 2 })
  })
})

describe('mat4', () => {
  it('translation vs direction', () => {
    const t = m4.translation3(1, 2, 3)
    near3(m4.transformPoint3(t, v3.vec3(4, 5, 6)), { x: 5, y: 7, z: 9 })
    near3(m4.transformDir3(t, v3.vec3(4, 5, 6)), { x: 4, y: 5, z: 6 })
  })

  it('rotations are right-handed', () => {
    const ry = m4.rotationY(Math.PI / 2)
    near3(m4.transformPoint3(ry, v3.vec3(1, 0, 0)), { x: 0, y: 0, z: -1 })
    near3(m4.transformPoint3(ry, v3.vec3(0, 0, 1)), { x: 1, y: 0, z: 0 })
    const rx = m4.rotationX(Math.PI / 2)
    near3(m4.transformPoint3(rx, v3.vec3(0, 1, 0)), { x: 0, y: 0, z: 1 })
    const rz = m4.rotationZ(Math.PI / 2)
    near3(m4.transformPoint3(rz, v3.vec3(1, 0, 0)), { x: 0, y: 1, z: 0 })
  })

  it('scaling3', () => {
    near3(m4.transformPoint3(m4.scaling3(2, 1, 1), v3.vec3(3, 4, 5)), { x: 6, y: 4, z: 5 })
  })

  it('mul4 — order matters', () => {
    const X = m4.translation3(4, -1, 2)
    nearArr(m4.mul4(m4.identity4(), X), X as unknown as number[])
    const a = m4.mul4(m4.translation3(1, 0, 0), m4.rotationY(Math.PI / 2))
    near3(m4.transformPoint3(a, v3.vec3(1, 0, 0)), { x: 1, y: 0, z: -1 })
    const b = m4.mul4(m4.rotationY(Math.PI / 2), m4.translation3(1, 0, 0))
    near3(m4.transformPoint3(b, v3.vec3(1, 0, 0)), { x: 0, y: 0, z: -2 })
  })

  it('solar-system hierarchy (module 3 capstone reference)', () => {
    const planetMatrix = (t: number) =>
      m4.mul4(m4.rotationY(0.5 * t), m4.mul4(m4.translation3(6, 0, 0), m4.rotationY(2 * t)))
    const moonMatrix = (t: number) =>
      m4.mul4(planetMatrix(t), m4.mul4(m4.rotationY(3 * t), m4.translation3(2, 0, 0)))
    const origin = v3.vec3(0, 0, 0)
    near3(m4.transformPoint3(planetMatrix(0), origin), { x: 6, y: 0, z: 0 })
    near3(m4.transformPoint3(moonMatrix(0), origin), { x: 8, y: 0, z: 0 })
    near3(m4.transformPoint3(planetMatrix(Math.PI), origin), { x: 0, y: 0, z: -6 })
    const t = 1.7
    near(
      v3.distance(
        m4.transformPoint3(planetMatrix(t), origin),
        m4.transformPoint3(moonMatrix(t), origin),
      ),
      2,
    )
  })

  it('frameMatrix packs axes into columns, origin into column 3', () => {
    const m = m4.frameMatrix(v3.vec3(0, 0, -1), v3.vec3(0, 1, 0), v3.vec3(1, 0, 0), v3.vec3(5, 0, 0))
    nearArr(m, [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 5, 0, 0, 1])
    near3(m4.transformPoint3(m, v3.vec3(1, 0, 0)), { x: 5, y: 0, z: -1 })
  })

  it('transpose4 reflects across the diagonal', () => {
    const ry = m4.rotationY(0.7)
    nearArr(m4.transpose4(m4.transpose4(ry)), ry as unknown as number[])
  })

  it('invertRigid undoes translation and rotation; M⁻¹·M = I', () => {
    nearArr(m4.invertRigid(m4.translation3(1, 2, 3)), [
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -1, -2, -3, 1,
    ])
    nearArr(m4.invertRigid(m4.rotationY(Math.PI / 2)), m4.rotationY(-Math.PI / 2) as unknown as number[])
    const M = m4.mul4(m4.translation3(2, -1, 4), m4.rotationY(0.9))
    nearArr(m4.mul4(m4.invertRigid(M), M), m4.identity4() as unknown as number[])
  })
})

describe('camera / coordinate frames (module 4)', () => {
  it('orthonormalBasis squares up sloppy inputs', () => {
    const b = cam.orthonormalBasis(v3.vec3(1, 0, 0), v3.vec3(0.3, 1, 0))
    near3(b.right, { x: 0, y: 0, z: 1 })
    near3(b.up, { x: 0, y: 1, z: 0 })
    near3(b.fwd, { x: 1, y: 0, z: 0 })
    // orthonormality from an arbitrary input
    const c = cam.orthonormalBasis(v3.vec3(2, -1, 4), v3.vec3(0, 1, 0))
    near(v3.dot(c.right, c.up), 0)
    near(v3.dot(c.right, c.fwd), 0)
    near(v3.length(c.right), 1)
    near(v3.length(c.fwd), 1)
  })

  it('worldToLocal is the inverse of frameMatrix for orthonormal frames', () => {
    const x = v3.vec3(0, 0, -1)
    const y = v3.vec3(0, 1, 0)
    const z = v3.vec3(1, 0, 0)
    const o = v3.vec3(5, 0, 0)
    const local = v3.vec3(2, -3, 4)
    const world = m4.transformPoint3(m4.frameMatrix(x, y, z, o), local)
    near3(cam.worldToLocal(o, x, y, z, world), local)
  })

  it('cameraToWorld places the eye and looks down −z', () => {
    const c = cam.cameraToWorld(v3.vec3(0, 0, 5), v3.vec3(0, 0, 0), v3.vec3(0, 1, 0))
    nearArr(c, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 5, 1])
    near3(m4.transformPoint3(c, v3.vec3(0, 0, 0)), { x: 0, y: 0, z: 5 })
    near3(m4.transformDir3(c, v3.vec3(0, 0, -1)), { x: 0, y: 0, z: -1 })
  })

  it('lookAt = inverse of cameraToWorld: eye→origin, target→(0,0,−dist)', () => {
    const view = cam.lookAt(v3.vec3(0, 0, 5), v3.vec3(0, 0, 0), v3.vec3(0, 1, 0))
    nearArr(view, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -5, 1])
    near3(m4.transformPoint3(view, v3.vec3(0, 0, 5)), { x: 0, y: 0, z: 0 })
    near3(m4.transformPoint3(view, v3.vec3(0, 0, 0)), { x: 0, y: 0, z: -5 })
    const side = cam.lookAt(v3.vec3(5, 0, 0), v3.vec3(0, 0, 0), v3.vec3(0, 1, 0))
    near3(m4.transformPoint3(side, v3.vec3(0, 0, 0)), { x: 0, y: 0, z: -5 })
  })
})

describe('projection (module 5)', () => {
  const HALF_PI = Math.PI / 2

  it('projectPinhole divides by depth (similar triangles)', () => {
    near2(proj.projectPinhole(v3.vec3(0, 0, -5), 1), { x: 0, y: 0 })
    near2(proj.projectPinhole(v3.vec3(2, 3, -1), 1), { x: 2, y: 3 })
    // twice as deep → half the image
    near2(proj.projectPinhole(v3.vec3(2, 3, -2), 1), { x: 1, y: 1.5 })
    // focal scales the whole image
    near2(proj.projectPinhole(v3.vec3(2, 3, -2), 4), { x: 4, y: 6 })
  })

  it('perspective is the gluPerspective matrix with −1 in the w row', () => {
    nearArr(proj.perspective(HALF_PI, 1, 1, 3), [
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -2, -1, 0, 0, -3, 0,
    ])
    const m = proj.perspective(HALF_PI, 2, 1, 3)
    near(m[0], 0.5) // x divided by aspect
    near(m[5], 1) // y untouched by aspect
    near(m[11], -1) // copies −z into w
    near(m[15], 0)
  })

  it('transformPoint4 keeps w; perspectiveDivide collapses to NDC', () => {
    const id = m4.identity4()
    const a = proj.transformPoint4(id, v3.vec3(2, 3, 4))
    expect([a.x, a.y, a.z, a.w]).toEqual([2, 3, 4, 1])
    // a (0,0,−1,0) bottom row drops −z into w
    const b = proj.transformPoint4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0], v3.vec3(2, 3, -5))
    near(b.w, 5)
    near3(proj.perspectiveDivide({ x: 4, y: 6, z: 8, w: 2 }), { x: 2, y: 3, z: 4 })
  })

  it('perspective maps the near plane to NDC z = −1 and far to +1', () => {
    const P = proj.perspective(HALF_PI, 1, 1, 3)
    near(proj.perspectiveDivide(proj.transformPoint4(P, v3.vec3(0, 0, -1))).z, -1)
    near(proj.perspectiveDivide(proj.transformPoint4(P, v3.vec3(0, 0, -3))).z, 1)
    // an off-axis point: x = 1 at depth 2 lands at NDC x = 0.5 (the divide)
    near(proj.perspectiveDivide(proj.transformPoint4(P, v3.vec3(1, 0, -2))).x, 0.5)
  })

  it('viewport maps NDC onto pixels and flips y', () => {
    near2(proj.viewport(v3.vec3(0, 0, 0), 800, 600), { x: 400, y: 300 })
    near2(proj.viewport(v3.vec3(-1, -1, 0), 800, 600), { x: 0, y: 600 })
    near2(proj.viewport(v3.vec3(1, 1, 0), 800, 600), { x: 800, y: 0 })
    near2(proj.viewport(v3.vec3(0.5, -0.5, 0), 400, 200), { x: 300, y: 150 })
  })

  it('orthographic keeps w = 1 and does not foreshorten', () => {
    nearArr(proj.orthographic(4, 2, 1, 3), [
      0.5, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, -2, 1,
    ])
    const O = proj.orthographic(4, 2, 1, 3)
    // same x at two depths → identical NDC x (parallel, no shrink)
    near(proj.perspectiveDivide(proj.transformPoint4(O, v3.vec3(2, 0, -1))).x, 1)
    near(proj.perspectiveDivide(proj.transformPoint4(O, v3.vec3(2, 0, -2.9))).x, 1)
  })

  it('project3 runs the whole pipeline and culls behind the camera', () => {
    const P = proj.perspective(HALF_PI, 1, 1, 10)
    near2(proj.project3(P, v3.vec3(0, 0, -2), 800, 600)!, { x: 400, y: 300 })
    near2(proj.project3(P, v3.vec3(1, 0, -2), 800, 600)!, { x: 600, y: 300 })
    expect(proj.project3(P, v3.vec3(0, 0, 5), 800, 600)).toBeNull()
    // full chain projection · view: the look-at target lands dead center
    const view = cam.lookAt(v3.vec3(0, 0, 5), v3.vec3(0, 0, 0), v3.vec3(0, 1, 0))
    near2(proj.project3(m4.mul4(P, view), v3.vec3(0, 0, 0), 800, 600)!, { x: 400, y: 300 })
  })
})
