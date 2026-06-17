/**
 * Module 4 exercises — Coordinate Spaces & the Camera. DOM-FREE (imported by
 * the worker and by node vitest).
 *
 * Conventions (pinned course-wide):
 *  - Right-handed world; +X right, +Y up, +Z toward the viewer.
 *  - Mat4 column-major, 16 numbers; columns 0–2 are the axes, column 3 the
 *    origin (translation at indices 12, 13, 14).
 *  - Camera space looks down −z (WebGL convention): the eye sits at the
 *    origin gazing toward −z.
 *  - Angles in radians, always.
 */

import type { ExerciseSpec } from '@/exercise/types'

const w = (x: number, y: number, z: number) => ({ x, y, z })

const HALF_PI = Math.PI / 2

export const M04_EXERCISES: ExerciseSpec[] = [
  /* ----------------------------- 4.1 ----------------------------- */
  {
    id: '04/frame',
    title: 'A frame is a matrix: pack the axes into columns',
    signature: `function frameMatrix(x: Vec3, y: Vec3, z: Vec3, o: Vec3): Mat4
// Columns 0–2 are the frame's axes; column 3 is its origin.
// The result is a model→world matrix: feed it LOCAL coordinates,
// get WORLD coordinates back (via transformPoint3).`,
    starter: `// Module 3 read a matrix's columns as "where the basis lands". Run it
// backwards: GIVEN where you want the axes to land (x, y, z) and where
// the origin sits (o), just drop them into the columns. Column-major,
// 16 numbers; the bottom row stays (0, 0, 0, 1).
function frameMatrix(x, y, z, o) {
  // return [ x.x, x.y, x.z, 0,   y.x, y.y, y.z, 0,   ... ];
}
`,
    solution: `function frameMatrix(x, y, z, o) {
  return [
    x.x, x.y, x.z, 0,
    y.x, y.y, y.z, 0,
    z.x, z.y, z.z, 0,
    o.x, o.y, o.z, 1,
  ];
}
`,
    exports: ['frameMatrix'],
    provides: ['transformPoint3', 'vec3'],
    tests: [
      {
        name: 'axis-aligned frame at (2,3,4) is just a translation',
        run: (f) => f.frameMatrix(w(1, 0, 0), w(0, 1, 0), w(0, 0, 1), w(2, 3, 4)),
        expect: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 3, 4, 1],
        hint: 'the three axes fill columns 0–2; the origin fills column 3 (indices 12–14)',
      },
      {
        name: 'the origin lands in column 3: local (0,0,0) → world (2,3,4)',
        run: (f, lib) =>
          lib.transformPoint3(f.frameMatrix(w(1, 0, 0), w(0, 1, 0), w(0, 0, 1), w(2, 3, 4)), w(0, 0, 0)),
        expect: w(2, 3, 4),
      },
      {
        name: 'tilted frame: its columns ARE x̂, ŷ, ẑ',
        run: (f) => f.frameMatrix(w(0, 0, -1), w(0, 1, 0), w(1, 0, 0), w(5, 0, 0)),
        expect: [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 5, 0, 0, 1],
      },
      {
        name: "local x̂ lands one step along the frame's x-axis: (1,0,0) → (5,0,−1)",
        run: (f, lib) =>
          lib.transformPoint3(f.frameMatrix(w(0, 0, -1), w(0, 1, 0), w(1, 0, 0), w(5, 0, 0)), w(1, 0, 0)),
        expect: w(5, 0, -1),
        hint: 'transformPoint3 = x·col0 + y·col1 + z·col2 + col3; here it is 1·(0,0,−1) + (5,0,0)',
      },
      {
        name: 'local (0,0,2) rides the frame z-axis: → (7,0,0)',
        run: (f, lib) =>
          lib.transformPoint3(f.frameMatrix(w(0, 0, -1), w(0, 1, 0), w(1, 0, 0), w(5, 0, 0)), w(0, 0, 2)),
        expect: w(7, 0, 0),
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 4.2 ----------------------------- */
  {
    id: '04/change-of-basis',
    title: 'Change of basis: read a point in someone else’s axes',
    signature: `function worldToLocal(o: Vec3, x: Vec3, y: Vec3, z: Vec3, p: Vec3): Vec3
// o, x, y, z describe an ORTHONORMAL frame (unit, perpendicular axes).
// Returns p's coordinates IN that frame.`,
    starter: `// "How far along each of your axes is this point?" Slide the point so
// the frame's origin is the reference (subtract o), then read each
// coordinate as a projection onto that axis — and projection onto a
// UNIT vector is exactly the dot product (Module 2).
//   local.x = dot(p − o, x),  local.y = dot(p − o, y),  local.z = dot(p − o, z)
function worldToLocal(o, x, y, z, p) {
  // your code here
}
`,
    solution: `function worldToLocal(o, x, y, z, p) {
  const rel = sub3(p, o);
  return vec3(dot3(rel, x), dot3(rel, y), dot3(rel, z));
}
`,
    exports: ['worldToLocal'],
    provides: ['vec3', 'sub3', 'dot3'],
    tests: [
      {
        name: 'standard axes at the origin: coordinates are unchanged',
        run: (f) => f.worldToLocal(w(0, 0, 0), w(1, 0, 0), w(0, 1, 0), w(0, 0, 1), w(3, 4, 5)),
        expect: w(3, 4, 5),
      },
      {
        name: 'shifted origin: (3,4,5) seen from o=(1,1,1) is (2,3,4)',
        run: (f) => f.worldToLocal(w(1, 1, 1), w(1, 0, 0), w(0, 1, 0), w(0, 0, 1), w(3, 4, 5)),
        expect: w(2, 3, 4),
        hint: 'subtract the origin first — coordinates are measured FROM the frame’s origin',
      },
      {
        name: 'rotated frame: (5,0,−1) reads as (1,0,0) — the inverse of 4.1',
        run: (f) => f.worldToLocal(w(5, 0, 0), w(0, 0, -1), w(0, 1, 0), w(1, 0, 0), w(5, 0, -1)),
        expect: w(1, 0, 0),
        hint: 'rel = (0,0,−1); dot with x=(0,0,−1) is 1, with y and z is 0',
      },
      {
        name: 'reading onto a single axis is one dot product',
        run: (f) => f.worldToLocal(w(0, 0, 0), w(0, 0, -1), w(0, 1, 0), w(1, 0, 0), w(7, 0, -1)),
        expect: w(1, 0, 7),
      },
      {
        name: 'round-trip: frameMatrix sends local→world, worldToLocal brings it back',
        run: (f, lib) => {
          const x = w(0, 0, -1);
          const y = w(0, 1, 0);
          const z = w(1, 0, 0);
          const o = w(5, 0, 0);
          const local = w(2, -3, 4);
          const world = lib.transformPoint3(lib.frameMatrix(x, y, z, o), local);
          return f.worldToLocal(o, x, y, z, world);
        },
        expect: w(2, -3, 4),
        hint: 'for an orthonormal frame, worldToLocal undoes frameMatrix exactly',
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 4.3 ----------------------------- */
  {
    id: '04/orthonormal',
    title: 'Manufacture a frame: the orthonormal basis',
    signature: `function orthonormalBasis(fwd: Vec3, up: Vec3): { right: Vec3, up: Vec3, fwd: Vec3 }
// Build three perpendicular UNIT axes from a desired forward and a
// rough up. Even a sloppy, non-unit, non-perpendicular up must come out
// clean. (Gram-Schmidt.)`,
    starter: `// Three cross products and a couple of normalizes:
//   1. fwd may not be unit — normalize it.
//   2. right must be perpendicular to BOTH fwd and up: cross(fwd, up),
//      then normalize.
//   3. up might not have been perpendicular — REBUILD it as
//      cross(right, fwd). It is already unit (two perpendicular units).
// Return { right, up, fwd } using your cleaned-up vectors.
function orthonormalBasis(fwd, up) {
  // your code here
}
`,
    solution: `function orthonormalBasis(fwd, up) {
  const f = normalize3(fwd);
  const right = normalize3(cross(f, up));
  const trueUp = cross(right, f);
  return { right: right, up: trueUp, fwd: f };
}
`,
    exports: ['orthonormalBasis'],
    provides: ['normalize3', 'cross', 'vec3', 'dot3', 'length3'],
    tests: [
      {
        name: 'forward −ẑ, up ŷ → the standard camera frame',
        run: (f) => f.orthonormalBasis(w(0, 0, -1), w(0, 1, 0)),
        expect: { right: w(1, 0, 0), up: w(0, 1, 0), fwd: w(0, 0, -1) },
        hint: 'right = normalize(cross(fwd, up)); up = cross(right, fwd)',
      },
      {
        name: 'a non-unit forward gets normalized',
        run: (f) => f.orthonormalBasis(w(0, 0, -5), w(0, 1, 0)).fwd,
        expect: w(0, 0, -1),
      },
      {
        name: 'a tilted up is re-squared: forward x̂, sloppy up → clean ŷ',
        run: (f) => f.orthonormalBasis(w(1, 0, 0), w(0.3, 1, 0)),
        expect: { right: w(0, 0, 1), up: w(0, 1, 0), fwd: w(1, 0, 0) },
        hint: 'cross(right, fwd) discards the part of up that was not perpendicular',
      },
      {
        name: 'right ⟂ up for an arbitrary input (dot = 0)',
        run: (f, lib) => {
          const b = f.orthonormalBasis(w(1, 2, 3), w(0, 1, 0));
          return lib.dot3(b.right, b.up);
        },
        expect: 0,
      },
      {
        name: 'every returned axis is unit length',
        run: (f, lib) => {
          const b = f.orthonormalBasis(w(2, -1, 4), w(0, 1, 0));
          return [lib.length3(b.right), lib.length3(b.up), lib.length3(b.fwd)];
        },
        expect: [1, 1, 1],
        hint: 'normalize the ones that need it; cross of two perpendicular units is already unit',
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 4.4 ----------------------------- */
  {
    id: '04/camera-to-world',
    title: 'lookAt, part 1: place the camera in the world',
    signature: `function cameraToWorld(eye: Vec3, target: Vec3, up: Vec3): Mat4
// The camera's model→world matrix: where it sits and which way it faces.
// Columns: 0 = right, 1 = up, 2 = BACK (−forward), 3 = eye.`,
    starter: `// The camera is just another framed object. Build its frame, then pack
// it with frameMatrix (from 4.1).
//   forward = target − eye  (where it looks)
//   { right, up, fwd } = orthonormalBasis(forward, up)   // from 4.3
// One twist: camera space looks down −z, so the frame's THIRD column
// (its "z axis") must point BACK, away from the target — use −fwd.
//   return frameMatrix(right, up, neg3(fwd), eye)
function cameraToWorld(eye, target, up) {
  // your code here
}
`,
    solution: `function cameraToWorld(eye, target, up) {
  const b = orthonormalBasis(sub3(target, eye), up);
  return frameMatrix(b.right, b.up, neg3(b.fwd), eye);
}
`,
    exports: ['cameraToWorld'],
    provides: ['orthonormalBasis', 'frameMatrix', 'sub3', 'neg3', 'vec3', 'transformPoint3', 'transformDir3'],
    tests: [
      {
        name: 'camera at (0,0,5) looking at the origin → identity rotation + translate',
        run: (f) => f.cameraToWorld(w(0, 0, 5), w(0, 0, 0), w(0, 1, 0)),
        expect: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 5, 1],
        hint: 'looking down −z, the back axis is +z, so columns 0–2 are the identity',
      },
      {
        name: 'the eye sits in column 3: camera-space origin → world eye',
        run: (f, lib) => lib.transformPoint3(f.cameraToWorld(w(0, 0, 5), w(0, 0, 0), w(0, 1, 0)), w(0, 0, 0)),
        expect: w(0, 0, 5),
      },
      {
        name: 'camera-space forward (0,0,−1) points toward the target in world space',
        run: (f, lib) => lib.transformDir3(f.cameraToWorld(w(0, 0, 5), w(0, 0, 0), w(0, 1, 0)), w(0, 0, -1)),
        expect: w(0, 0, -1),
        hint: 'the camera looks toward −z in its own space; in the world that is toward the origin',
      },
      {
        name: 'camera off to the +x side, still facing the origin',
        run: (f) => f.cameraToWorld(w(5, 0, 0), w(0, 0, 0), w(0, 1, 0)),
        expect: [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 5, 0, 0, 1],
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 4.5 ----------------------------- */
  {
    id: '04/view-matrix',
    title: 'lookAt, part 2: the cheap rigid inverse',
    signature: `function invertRigid(m: Mat4): Mat4   // m is rotation + translation only
function lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4   // the VIEW matrix
// The view matrix is world→camera — the inverse of cameraToWorld.`,
    starter: `// Inverting a general 4×4 is miserable. But a rigid matrix (orthonormal
// rotation R + translation t) inverts almost for free:
//   - R's inverse is its TRANSPOSE Rᵀ (rows become columns)
//   - the translation becomes −Rᵀ·t
// In column-major terms, the new columns 0–2 are the old ROWS:
//   col0 = (m[0], m[4], m[8]),  col1 = (m[1], m[5], m[9]),  col2 = (m[2], m[6], m[10])
// and the new translation (t = m[12..14]) is
//   −(m[0]·tx + m[1]·ty + m[2]·tz, m[4]·tx + m[5]·ty + m[6]·tz, m[8]·tx + m[9]·ty + m[10]·tz)
function invertRigid(m) {
  // your code here
}

// cameraToWorld places the camera; its inverse takes the world INTO the
// camera. That inverse is the view matrix. (cameraToWorld is provided.)
function lookAt(eye, target, up) {
  // your code here
}
`,
    solution: `function invertRigid(m) {
  const tx = m[12], ty = m[13], tz = m[14];
  return [
    m[0], m[4], m[8], 0,
    m[1], m[5], m[9], 0,
    m[2], m[6], m[10], 0,
    -(m[0] * tx + m[1] * ty + m[2] * tz),
    -(m[4] * tx + m[5] * ty + m[6] * tz),
    -(m[8] * tx + m[9] * ty + m[10] * tz),
    1,
  ];
}

function lookAt(eye, target, up) {
  return invertRigid(cameraToWorld(eye, target, up));
}
`,
    exports: ['invertRigid', 'lookAt'],
    provides: ['cameraToWorld', 'mul4', 'transformPoint3', 'translation3', 'rotationY', 'vec3'],
    tests: [
      {
        name: 'inverse of a translation is the opposite translation',
        run: (f, lib) => f.invertRigid(lib.translation3(1, 2, 3)),
        expect: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -1, -2, -3, 1],
      },
      {
        name: 'inverse of a rotation is the transpose: invertRigid(Ry(π/2)) = Ry(−π/2)',
        run: (f, lib) => f.invertRigid(lib.rotationY(HALF_PI)),
        expect: null, // replaced below: set to rotationY(−π/2) against LIB
        hint: 'a pure rotation has no translation, so the inverse is just Rᵀ',
      },
      {
        name: 'M⁻¹ · M = identity for a rigid M = T · Ry',
        run: (f, lib) => {
          const M = lib.mul4(lib.translation3(2, -1, 4), lib.rotationY(0.9));
          return lib.mul4(f.invertRigid(M), M);
        },
        expect: null, // replaced below: computed against lib in a fixup
      },
      {
        name: 'view matrix: camera at (0,0,5) looking at origin → translate −5 in z',
        run: (f) => f.lookAt(w(0, 0, 5), w(0, 0, 0), w(0, 1, 0)),
        expect: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -5, 1],
        hint: 'the eye sits 5 in front; world points get pushed 5 down −z so the eye lands at the origin',
      },
      {
        name: 'the eye maps to the camera-space origin',
        run: (f, lib) => lib.transformPoint3(f.lookAt(w(0, 0, 5), w(0, 0, 0), w(0, 1, 0)), w(0, 0, 5)),
        expect: w(0, 0, 0),
      },
      {
        name: 'the target lands dead ahead at (0,0,−distance)',
        run: (f, lib) => lib.transformPoint3(f.lookAt(w(0, 0, 5), w(0, 0, 0), w(0, 1, 0)), w(0, 0, 0)),
        expect: w(0, 0, -5),
      },
      {
        name: 'a side camera too: eye (5,0,0) → target lands at (0,0,−5)',
        run: (f, lib) => lib.transformPoint3(f.lookAt(w(5, 0, 0), w(0, 0, 0), w(0, 1, 0)), w(0, 0, 0)),
        expect: w(0, 0, -5),
        hint: 'no matter where the eye is, looking at the target puts it straight ahead down −z',
      },
    ],
    codeVersion: 1,
  },

  /* --------------------------- capstone --------------------------- */
  {
    id: '04/fly-camera',
    title: 'Capstone: the full model → world → view chain',
    signature: `function modelView(eye: Vec3, target: Vec3, up: Vec3, model: Mat4): Mat4
// Compose the camera's view matrix with an object's model matrix into the
// single matrix that takes the object's LOCAL points straight into camera
// space. Right-to-left: model first (local→world), then view (world→camera).`,
    starter: `// Two matrices you already own, multiplied in the right order:
//   view = lookAt(eye, target, up)        // world → camera
//   model                                  // local → world (passed in)
// A local point travels model FIRST, then view — so view is on the LEFT:
//   return mul4(view, model)
function modelView(eye, target, up, model) {
  // your code here
}
`,
    solution: `function modelView(eye, target, up, model) {
  return mul4(lookAt(eye, target, up), model);
}
`,
    exports: ['modelView'],
    provides: ['lookAt', 'mul4', 'translation3', 'rotationY', 'identity4', 'transformPoint3', 'vec3'],
    tests: [
      {
        name: 'identity model is just the view matrix',
        run: (f, lib) => f.modelView(w(0, 0, 5), w(0, 0, 0), w(0, 1, 0), lib.identity4()),
        expect: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -5, 1],
      },
      {
        name: 'an object lifted +2 in y sits up and ahead: local origin → (0,2,−5)',
        run: (f, lib) =>
          lib.transformPoint3(
            f.modelView(w(0, 0, 5), w(0, 0, 0), w(0, 1, 0), lib.translation3(0, 2, 0)),
            w(0, 0, 0),
          ),
        expect: w(0, 2, -5),
        hint: 'model puts the point at world (0,2,0); the view matrix then pushes it 5 down −z',
      },
      {
        name: 'order matters: rotate the model, THEN view — local x̂ → (0,0,−6)',
        run: (f, lib) =>
          lib.transformPoint3(
            f.modelView(w(0, 0, 5), w(0, 0, 0), w(0, 1, 0), lib.rotationY(HALF_PI)),
            w(1, 0, 0),
          ),
        expect: w(0, 0, -6),
        hint: 'model first: x̂ → world (0,0,−1); then view: (0,0,−1) → (0,0,−6)',
      },
      {
        name: 'side camera, identity model: target lands at (0,0,−5)',
        run: (f, lib) =>
          lib.transformPoint3(
            f.modelView(w(5, 0, 0), w(0, 0, 0), w(0, 1, 0), lib.identity4()),
            w(0, 0, 0),
          ),
        expect: w(0, 0, -5),
      },
    ],
    codeVersion: 1,
  },
]

/* ------------------------------------------------------------------ *
 * A couple of 4.5 expectations are easiest to state as "whatever the
 * reference library produces", so they are filled in here against LIB
 * rather than hand-transcribed. Kept out of the spec literals above so
 * those stay readable.
 * ------------------------------------------------------------------ */
import { m4 } from '@/math'

const viewSpec = M04_EXERCISES.find((s) => s.id === '04/view-matrix')!
const rotTest = viewSpec.tests.find((t) => t.name.includes('transpose'))!
rotTest.expect = [...m4.rotationY(-HALF_PI)]
const idTest = viewSpec.tests.find((t) => t.name.includes('identity for a rigid'))!
idTest.expect = [...m4.identity4()]
