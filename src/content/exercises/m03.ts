/**
 * Module 3 exercises — Matrices: Transforming Space. DOM-FREE (imported by
 * the worker and by node vitest).
 *
 * Matrix conventions (pinned course-wide, see src/math/mat*.ts):
 *  - COLUMN-MAJOR flat arrays. Mat2 = [ix, iy, jx, jy].
 *  - Mat3 translation lives at indices 6, 7. Mat4 translation at 12, 13, 14.
 *  - Column vectors, M · v; chains apply right-to-left.
 *  - Angles in radians, always.
 */

import type { ExerciseSpec } from '@/exercise/types'

const v = (x: number, y: number) => ({ x, y })
const w = (x: number, y: number, z: number) => ({ x, y, z })

const ROT90 = [0, 1, -1, 0]
const ORIGIN3 = w(0, 0, 0)

export const M03_EXERCISES: ExerciseSpec[] = [
  /* ----------------------------- 3.1 ----------------------------- */
  {
    id: '03/transform',
    title: 'Matrix × vector: read the columns',
    signature: `function transformVec2(m: Mat2, v: Vec2): Vec2
// Mat2 = [ix, iy, jx, jy] — column-major:
//   column 1 (m[0], m[1]) is where î = (1, 0) lands
//   column 2 (m[2], m[3]) is where ĵ = (0, 1) lands`,
    starter: `// M · v is literally: x copies of column 1, plus y copies of column 2.
// You already own the tools: add() and scale() from Module 1.
function transformVec2(m, v) {
  // your code here
}
`,
    solution: `function transformVec2(m, v) {
  // x copies of where î landed + y copies of where ĵ landed.
  return add(scale(vec2(m[0], m[1]), v.x), scale(vec2(m[2], m[3]), v.y));
}
`,
    exports: ['transformVec2'],
    provides: ['add', 'scale', 'vec2'],
    tests: [
      {
        name: 'identity [1,0,0,1] leaves (3,7) alone',
        run: (f) => f.transformVec2([1, 0, 0, 1], v(3, 7)),
        expect: v(3, 7),
        hint: 'î stays at (1,0) and ĵ stays at (0,1), so nothing moves',
      },
      {
        name: 'rot90 [0,1,−1,0] sends (1,0) → (0,1)',
        run: (f) => f.transformVec2(ROT90, v(1, 0)),
        expect: v(0, 1),
      },
      {
        name: 'rot90 [0,1,−1,0] sends (2,3) → (−3,2)',
        run: (f) => f.transformVec2(ROT90, v(2, 3)),
        expect: v(-3, 2),
        hint: '2·(0,1) + 3·(−1,0) — two copies of column 1 plus three of column 2',
      },
      {
        name: 'shear [1,0,1,1] sends (0,2) → (2,2)',
        run: (f) => f.transformVec2([1, 0, 1, 1], v(0, 2)),
        expect: v(2, 2),
      },
      {
        name: 'scale [2,0,0,3] sends (4,5) → (8,15)',
        run: (f) => f.transformVec2([2, 0, 0, 3], v(4, 5)),
        expect: v(8, 15),
      },
      {
        name: '[5,6,7,8] on (1,0) — multiplying by î just reads off column 1',
        run: (f) => f.transformVec2([5, 6, 7, 8], v(1, 0)),
        expect: v(5, 6),
        hint: 'feed in î = (1,0) and the answer IS column 1: (m[0], m[1])',
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 3.2 ----------------------------- */
  {
    id: '03/factory',
    title: 'The matrix factory: rotation, scale, determinant',
    signature: `function rotation2(theta: number): Mat2   // theta in RADIANS
function scaling2(sx: number, sy: number): Mat2
function det2(m: Mat2): number             // area-scaling factor`,
    starter: `// Derive, don't memorize: where do î and ĵ land?
//   rotation by θ:  î → (cos θ, sin θ),  ĵ → (−sin θ, cos θ)
// Remember: Mat2 = [ix, iy, jx, jy], column-major.
function rotation2(theta) {
  // your code here
}

function scaling2(sx, sy) {
  // your code here
}

// det2 = signed area of the parallelogram spanned by the two columns.
// (You met this in Module 2 — it is cross2(column1, column2).)
function det2(m) {
  // your code here
}
`,
    solution: `function rotation2(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [c, s, -s, c];
}

function scaling2(sx, sy) {
  return [sx, 0, 0, sy];
}

function det2(m) {
  return m[0] * m[3] - m[2] * m[1];
}
`,
    exports: ['rotation2', 'scaling2', 'det2'],
    provides: ['vec2'],
    tests: [
      {
        name: 'rotation2(0) is the identity',
        run: (f) => f.rotation2(0),
        expect: [1, 0, 0, 1],
      },
      {
        name: 'rotation2(π/2) → [0,1,−1,0]',
        run: (f) => f.rotation2(Math.PI / 2),
        expect: [0, 1, -1, 0],
        hint: 'î → (cos 90°, sin 90°) = (0,1); ĵ → (−sin 90°, cos 90°) = (−1,0)',
      },
      {
        name: 'rotation2(π/6) — 30°, in radians',
        run: (f) => f.rotation2(Math.PI / 6),
        expect: [0.8660254, 0.5, -0.5, 0.8660254],
        hint: 'if your numbers look like garbage, check you are not passing degrees',
      },
      {
        name: 'scaling2(2,3) → [2,0,0,3]',
        run: (f) => f.scaling2(2, 3),
        expect: [2, 0, 0, 3],
      },
      {
        name: 'det2(identity) → 1',
        run: (f) => f.det2([1, 0, 0, 1]),
        expect: 1,
      },
      {
        name: 'det2([2,0,0,3]) → 6 — areas scale by 2·3',
        run: (f) => f.det2([2, 0, 0, 3]),
        expect: 6,
      },
      {
        name: 'det2(rotation2(0.7)) → 1 — rotations preserve area',
        run: (f) => f.det2(f.rotation2(0.7)),
        expect: 1,
        hint: 'cos²θ + sin²θ = 1; a pure rotation never stretches anything',
      },
      {
        name: 'det2([0,1,1,0]) → −1 — the flip detector',
        run: (f) => f.det2([0, 1, 1, 0]),
        expect: -1,
        hint: 'this matrix swaps î and ĵ: same area, but the grid is mirror-flipped',
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 3.3 ----------------------------- */
  {
    id: '03/compose',
    title: 'Composition: mul2(a, b) = apply b, then a',
    signature: `function mul2(a: Mat2, b: Mat2): Mat2
// mul2(a, b) means "apply b first, then a" — like f(g(x)).`,
    starter: `// The big shortcut: a matrix product's columns are just the right
// matrix's columns pushed through the left matrix.
//   result column 1 = transformVec2(a, b's column 1)
//   result column 2 = transformVec2(a, b's column 2)
// You wrote the hard part in 3.1.
function mul2(a, b) {
  // your code here
}
`,
    solution: `function mul2(a, b) {
  const c1 = transformVec2(a, vec2(b[0], b[1]));
  const c2 = transformVec2(a, vec2(b[2], b[3]));
  return [c1.x, c1.y, c2.x, c2.y];
}
`,
    exports: ['mul2'],
    provides: ['transformVec2', 'vec2'],
    tests: [
      {
        name: 'two 90° turns make a 180°: mul2(rot90, rot90) → [−1,0,0,−1]',
        run: (f) => f.mul2(ROT90, ROT90),
        expect: [-1, 0, 0, -1],
      },
      {
        name: 'identity on the left changes nothing: mul2(I, [5,6,7,8])',
        run: (f) => f.mul2([1, 0, 0, 1], [5, 6, 7, 8]),
        expect: [5, 6, 7, 8],
      },
      {
        name: 'stretch-after-rotate: mul2(S, R) → [0,1,−2,0]',
        run: (f) => f.mul2([2, 0, 0, 1], ROT90),
        expect: [0, 1, -2, 0],
        hint: 'S = [2,0,0,1], R = rot90. Rotate first, then stretch x. Columns of R, pushed through S.',
      },
      {
        name: 'rotate-after-stretch: mul2(R, S) → [0,2,−1,0] — they do NOT commute',
        run: (f) => f.mul2(ROT90, [2, 0, 0, 1]),
        expect: [0, 2, -1, 0],
        hint: 'same two matrices, opposite order, different animal — if you got [0,1,−2,0] you composed left-to-right',
      },
      {
        name: 'behavior check: mul2(S, R) sends (1,1) → (−2,1)',
        run: (f, lib) => lib.transformVec2(f.mul2([2, 0, 0, 1], ROT90), v(1, 1)),
        expect: v(-2, 1),
        hint: 'rot90 sends (1,1) to (−1,1); stretching x by 2 gives (−2,1)',
      },
      {
        name: 'determinants multiply: det2(mul2(S, R)) → 2',
        run: (f, lib) => lib.det2(f.mul2([2, 0, 0, 1], ROT90)),
        expect: 2,
        hint: 'area ×2 then ×1 (rotation) — or in the other order — is still area ×2',
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 3.4 ----------------------------- */
  {
    id: '03/homogeneous',
    title: 'The homogeneous trick: points move, directions don’t',
    signature: `function translation2(tx: number, ty: number): Mat3
function transformPoint2(m: Mat3, p: Vec2): Vec2   // w = 1: translation applies
function transformDir2(m: Mat3, v: Vec2): Vec2     // w = 0: translation ignored
// Mat3 is column-major, 9 numbers; the translation column is m[6], m[7]:
//   [ m[0] m[3] m[6] ]
//   [ m[1] m[4] m[7] ]
//   [ m[2] m[5] m[8] ]`,
    starter: `// translation2 is a SHEAR of 3D homogeneous space: the first two
// columns are untouched î and ĵ; the third column carries the origin
// to (tx, ty, 1).
function translation2(tx, ty) {
  // return [ , , ,   , , ,   , , ];
}

// A point rides at w = 1, so it picks up the translation column once:
//   x·col1 + y·col2 + 1·col3 (keep the first two components).
function transformPoint2(m, p) {
  // your code here
}

// A direction rides at w = 0 — the translation column is multiplied by 0.
function transformDir2(m, v) {
  // your code here
}
`,
    solution: `function translation2(tx, ty) {
  return [1, 0, 0,  0, 1, 0,  tx, ty, 1];
}

function transformPoint2(m, p) {
  return vec2(
    m[0] * p.x + m[3] * p.y + m[6],
    m[1] * p.x + m[4] * p.y + m[7]
  );
}

function transformDir2(m, v) {
  return vec2(
    m[0] * v.x + m[3] * v.y,
    m[1] * v.x + m[4] * v.y
  );
}
`,
    exports: ['translation2', 'transformPoint2', 'transformDir2'],
    provides: ['vec2', 'add', 'scale'],
    tests: [
      {
        name: 'translation2(3,5) → [1,0,0, 0,1,0, 3,5,1]',
        run: (f) => f.translation2(3, 5),
        expect: [1, 0, 0, 0, 1, 0, 3, 5, 1],
        hint: 'column-major: the translation goes in the LAST column — indices 6 and 7',
      },
      {
        name: 'point (1,1) through T(3,5) → (4,6)',
        run: (f) => f.transformPoint2(f.translation2(3, 5), v(1, 1)),
        expect: v(4, 6),
      },
      {
        name: 'the origin moved — that’s the whole point: (0,0) → (3,5)',
        run: (f) => f.transformPoint2(f.translation2(3, 5), v(0, 0)),
        expect: v(3, 5),
        hint: 'no 2×2 matrix could ever do this — 0·col1 + 0·col2 is stuck at zero',
      },
      {
        name: 'direction (1,1) through T(3,5) → (1,1), unmoved',
        run: (f) => f.transformDir2(f.translation2(3, 5), v(1, 1)),
        expect: v(1, 1),
        hint: 'w = 0 kills the translation column — directions have no position to move',
      },
      {
        name: 'direction (0,2) through T(3,5) → (0,2)',
        run: (f) => f.transformDir2(f.translation2(3, 5), v(0, 2)),
        expect: v(0, 2),
      },
      {
        name: 'rotation still rotates directions: rot90+T(7,8) sends dir (1,0) → (0,1)',
        run: (f) => f.transformDir2([0, 1, 0, -1, 0, 0, 7, 8, 1], v(1, 0)),
        expect: v(0, 1),
        hint: 'directions ignore the translation column but still feel the 2×2 linear part',
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 3.5 ----------------------------- */
  {
    id: '03/sandwich',
    title: 'The sandwich: rotate about any point',
    signature: `function mul3(a: Mat3, b: Mat3): Mat3              // apply b, then a
function rotationAbout(p: Vec2, theta: number): Mat3
// rotationAbout = T(p) · R(θ) · T(−p): carry p to the origin,
// rotate there, carry it back. Chains read right-to-left.`,
    starter: `// Same trick as mul2, one size up: each of b's three columns goes
// through a. (Or write the triple loop — both are fine.)
function mul3(a, b) {
  // your code here
}

// Build the sandwich from parts you already own:
//   translation2(...), rotation2(...) and mat3FromMat2(...) are provided.
// mat3FromMat2 lifts a 2×2 into a 3×3 with no translation.
function rotationAbout(p, theta) {
  // your code here
}
`,
    solution: `function mul3(a, b) {
  const out = [];
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += a[k * 3 + row] * b[col * 3 + k];
      out[col * 3 + row] = sum;
    }
  }
  return out;
}

function rotationAbout(p, theta) {
  const toOrigin = translation2(-p.x, -p.y);
  const rotate = mat3FromMat2(rotation2(theta));
  const back = translation2(p.x, p.y);
  // Right-to-left: toOrigin happens first.
  return mul3(back, mul3(rotate, toOrigin));
}
`,
    exports: ['mul3', 'rotationAbout'],
    provides: ['translation2', 'transformPoint2', 'transformDir2', 'mat3FromMat2', 'rotation2', 'vec2'],
    tests: [
      {
        name: 'mul3(I, X) → X for X = translation2(4,−1)',
        run: (f, lib) => f.mul3(lib.identity3(), lib.translation2(4, -1)),
        expect: [1, 0, 0, 0, 1, 0, 4, -1, 1],
      },
      {
        name: 'translations compose by adding: T(1,0)·T(0,2) moves origin to (1,2)',
        run: (f, lib) =>
          lib.transformPoint2(f.mul3(lib.translation2(1, 0), lib.translation2(0, 2)), v(0, 0)),
        expect: v(1, 2),
      },
      {
        name: 'rotationAbout((2,0), π) sends (3,0) → (1,0)',
        run: (f, lib) => lib.transformPoint2(f.rotationAbout(v(2, 0), Math.PI), v(3, 0)),
        expect: v(1, 0),
        hint: 'half-turn about (2,0): a point 1 unit right of the pivot lands 1 unit left of it',
      },
      {
        name: 'the hinge doesn’t move: rotationAbout((2,0), π) fixes (2,0)',
        run: (f, lib) => lib.transformPoint2(f.rotationAbout(v(2, 0), Math.PI), v(2, 0)),
        expect: v(2, 0),
        hint: 'if your hinge moves, your sandwich is inside-out — T(−p) must happen FIRST (rightmost)',
      },
      {
        name: 'about the origin it’s a plain rotation: (1,0) → (0,1)',
        run: (f, lib) => lib.transformPoint2(f.rotationAbout(v(0, 0), Math.PI / 2), v(1, 0)),
        expect: v(0, 1),
      },
      {
        name: 'rotationAbout((1,1), π/2) sends (2,1) → (1,2)',
        run: (f, lib) => lib.transformPoint2(f.rotationAbout(v(1, 1), Math.PI / 2), v(2, 1)),
        expect: v(1, 2),
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 3.6 ----------------------------- */
  {
    id: '03/mat4',
    title: 'To 3D: the Mat4',
    signature: `function mul4(a: Mat4, b: Mat4): Mat4              // apply b, then a
function translation3(tx: number, ty: number, tz: number): Mat4
function rotationY(theta: number): Mat4            // right-handed: x̂ → −ẑ at +90°
function scaling3(sx: number, sy: number, sz: number): Mat4
function transformPoint3(m: Mat4, p: Vec3): Vec3   // w = 1
function transformDir3(m: Mat4, v: Vec3): Vec3     // w = 0
// Mat4 is column-major, 16 numbers; translation at indices 12, 13, 14:
//   [ m[0] m[4] m[8]  m[12] ]
//   [ m[1] m[5] m[9]  m[13] ]
//   [ m[2] m[6] m[10] m[14] ]
//   [ m[3] m[7] m[11] m[15] ]`,
    starter: `// Bookkeeping you already know, one size up. Columns 0–2 say where
// x̂, ŷ, ẑ land; column 3 says where the origin went.

function mul4(a, b) {
  // same pattern as mul3 — push b's columns through a (a 4-loop is fine)
}

function translation3(tx, ty, tz) {
  // identity, with (tx, ty, tz) in the last column (indices 12, 13, 14)
}

// Rotation about ŷ: x̂ → (cos θ, 0, −sin θ), ŷ stays, ẑ → (sin θ, 0, cos θ).
// (Right-handed: at θ = π/2, x̂ swings to −ẑ.)
function rotationY(theta) {
  // your code here
}

function scaling3(sx, sy, sz) {
  // your code here
}

function transformPoint3(m, p) {
  // x·col0 + y·col1 + z·col2 + 1·col3 (keep the first three components)
}

function transformDir3(m, v) {
  // same, but w = 0: skip the translation column
}
`,
    solution: `function mul4(a, b) {
  const out = [];
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

function translation3(tx, ty, tz) {
  return [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  tx, ty, tz, 1];
}

function rotationY(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [c, 0, -s, 0,  0, 1, 0, 0,  s, 0, c, 0,  0, 0, 0, 1];
}

function scaling3(sx, sy, sz) {
  return [sx, 0, 0, 0,  0, sy, 0, 0,  0, 0, sz, 0,  0, 0, 0, 1];
}

function transformPoint3(m, p) {
  return vec3(
    m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
    m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
    m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]
  );
}

function transformDir3(m, v) {
  return vec3(
    m[0] * v.x + m[4] * v.y + m[8] * v.z,
    m[1] * v.x + m[5] * v.y + m[9] * v.z,
    m[2] * v.x + m[6] * v.y + m[10] * v.z
  );
}
`,
    exports: ['mul4', 'translation3', 'rotationY', 'scaling3', 'transformPoint3', 'transformDir3'],
    provides: ['vec3', 'add3', 'scale3'],
    tests: [
      {
        name: 'point (4,5,6) through T(1,2,3) → (5,7,9)',
        run: (f) => f.transformPoint3(f.translation3(1, 2, 3), w(4, 5, 6)),
        expect: w(5, 7, 9),
      },
      {
        name: 'directions ignore translation: dir (4,5,6) through T(1,2,3) → (4,5,6)',
        run: (f) => f.transformDir3(f.translation3(1, 2, 3), w(4, 5, 6)),
        expect: w(4, 5, 6),
        hint: 'w = 0: the translation column (indices 12–14) must not contribute',
      },
      {
        name: 'right-handed: rotationY(π/2) sends x̂ → (0,0,−1)',
        run: (f) => f.transformPoint3(f.rotationY(Math.PI / 2), w(1, 0, 0)),
        expect: w(0, 0, -1),
        hint: 'curl your right hand around +y: x̂ swings toward −ẑ',
      },
      {
        name: 'right-handed: rotationY(π/2) sends ẑ → (1,0,0)',
        run: (f) => f.transformPoint3(f.rotationY(Math.PI / 2), w(0, 0, 1)),
        expect: w(1, 0, 0),
      },
      {
        name: 'scaling3(2,1,1) sends (3,4,5) → (6,4,5)',
        run: (f) => f.transformPoint3(f.scaling3(2, 1, 1), w(3, 4, 5)),
        expect: w(6, 4, 5),
      },
      {
        name: 'mul4(I, X) → X for X = translation3(4,−1,2)',
        run: (f, lib) => f.mul4(lib.identity4(), lib.translation3(4, -1, 2)),
        expect: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, -1, 2, 1],
      },
      {
        name: 'order pin: mul4(T(1,0,0), Ry(π/2)) on (1,0,0) → (1,0,−1)',
        run: (f) =>
          f.transformPoint3(f.mul4(f.translation3(1, 0, 0), f.rotationY(Math.PI / 2)), w(1, 0, 0)),
        expect: w(1, 0, -1),
        hint: 'right-to-left: rotate first (x̂ → −ẑ), then slide +1 in x',
      },
      {
        name: 'swapped order is different: mul4(Ry(π/2), T(1,0,0)) on (1,0,0) → (0,0,−2)',
        run: (f) =>
          f.transformPoint3(f.mul4(f.rotationY(Math.PI / 2), f.translation3(1, 0, 0)), w(1, 0, 0)),
        expect: w(0, 0, -2),
        hint: 'slide first to (2,0,0), THEN rotate the whole thing — the translation gets rotated too',
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 3.7 ----------------------------- */
  {
    id: '03/trs',
    title: 'TRS: how every engine stores an object',
    signature: `function trs(t: Vec3, ry: number, s: Vec3): Mat4
// M = T(t) · R_y(ry) · S(s) — scale first, then rotate, then translate.`,
    starter: `// One line, if you respect the order. Right-to-left: the scale is the
// FIRST thing that happens to a model's vertices, the translation is
// the LAST.
function trs(t, ry, s) {
  // your code here
}
`,
    solution: `function trs(t, ry, s) {
  return mul4(translation3(t.x, t.y, t.z), mul4(rotationY(ry), scaling3(s.x, s.y, s.z)));
}
`,
    exports: ['trs'],
    provides: ['mul4', 'translation3', 'rotationY', 'scaling3', 'transformPoint3', 'vec3'],
    tests: [
      {
        name: 'trs(0, 0, 1) is the identity',
        run: (f) => f.trs(w(0, 0, 0), 0, w(1, 1, 1)),
        expect: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      },
      {
        name: 'scale happens before translate: trs((5,0,0), 0, (2,2,2)) on (1,0,0) → (7,0,0)',
        run: (f, lib) => lib.transformPoint3(f.trs(w(5, 0, 0), 0, w(2, 2, 2)), w(1, 0, 0)),
        expect: w(7, 0, 0),
        hint: 'scale to (2,0,0), then slide to (7,0,0) — if you got 12, the translation got scaled',
      },
      {
        name: 'scale-then-rotate: trs(0, π/2, (2,1,1)) on (1,0,0) → (0,0,−2)',
        run: (f, lib) =>
          lib.transformPoint3(f.trs(w(0, 0, 0), Math.PI / 2, w(2, 1, 1)), w(1, 0, 0)),
        expect: w(0, 0, -2),
        hint: 'stretch x̂ to (2,0,0) FIRST, then swing it to −ẑ — if you got (0,0,−1), R and S are swapped',
      },
      {
        name: 'the origin lands at t: trs((1,2,3), 0, 1) sends (0,0,0) → (1,2,3)',
        run: (f, lib) => lib.transformPoint3(f.trs(w(1, 2, 3), 0, w(1, 1, 1)), w(0, 0, 0)),
        expect: w(1, 2, 3),
      },
      {
        name: 'wrong-order probe: trs((5,0,0), 0, (2,1,1)) on (1,0,0) → (7,0,0)',
        run: (f, lib) => lib.transformPoint3(f.trs(w(5, 0, 0), 0, w(2, 1, 1)), w(1, 0, 0)),
        expect: w(7, 0, 0),
        hint: 'if you got 12, you translated before scaling — S·R·T instead of T·R·S',
      },
    ],
    codeVersion: 1,
  },

  /* --------------------------- capstone --------------------------- */
  {
    id: '03/capstone-solar',
    title: 'Capstone: a solar system is a matrix sandwich',
    signature: `function sunMatrix(t: number): Mat4     // the sun spins in place
function planetMatrix(t: number): Mat4  // orbits the sun at radius 6, spins itself
function moonMatrix(t: number): Mat4    // orbits the PLANET at radius 2
// Hierarchy rule: child world = parent world × child local.`,
    starter: `// The sun just spins:
function sunMatrix(t) {
  // rotationY(t)
}

// The planet: swing the whole frame around the sun by 0.5·t, push out
// 6 units, then spin on its own axis by 2·t. Right-to-left!
//   R_y(0.5t) · T(6,0,0) · R_y(2t)
function planetMatrix(t) {
  // your code here
}

// The moon lives in the PLANET's frame: take planetMatrix(t) whole,
// then swing by 3·t and push out 2 units.
//   planetMatrix(t) · R_y(3t) · T(2,0,0)
function moonMatrix(t) {
  // your code here
}
`,
    solution: `function sunMatrix(t) {
  return rotationY(t);
}

function planetMatrix(t) {
  return mul4(rotationY(0.5 * t), mul4(translation3(6, 0, 0), rotationY(2 * t)));
}

function moonMatrix(t) {
  return mul4(planetMatrix(t), mul4(rotationY(3 * t), translation3(2, 0, 0)));
}
`,
    exports: ['sunMatrix', 'planetMatrix', 'moonMatrix'],
    provides: ['mul4', 'rotationY', 'translation3', 'identity4', 'transformPoint3', 'vec3'],
    tests: [
      {
        name: 'sunMatrix(π/2) spins x̂ to (0,0,−1)',
        run: (f, lib) => lib.transformDir3(f.sunMatrix(Math.PI / 2), w(1, 0, 0)),
        expect: w(0, 0, -1),
      },
      {
        name: 'planetMatrix(0) puts the planet at (6,0,0)',
        run: (f, lib) => lib.transformPoint3(f.planetMatrix(0), ORIGIN3),
        expect: w(6, 0, 0),
        hint: 'at t = 0 every rotation is the identity — only T(6,0,0) is left',
      },
      {
        name: 'moonMatrix(0) puts the moon at (8,0,0)',
        run: (f, lib) => lib.transformPoint3(f.moonMatrix(0), ORIGIN3),
        expect: w(8, 0, 0),
        hint: 'planet at (6,0,0), then 2 more units out in the planet’s frame',
      },
      {
        name: 'right-handed orbit: planetMatrix(π) puts the planet at (0,0,−6)',
        run: (f, lib) => lib.transformPoint3(f.planetMatrix(Math.PI), ORIGIN3),
        expect: w(0, 0, -6),
        hint: 'orbit angle is 0.5·π = 90°; a right-handed turn about +y swings +x toward −z',
      },
      {
        name: 'the moon stays exactly 2 units from its planet at t = 1.7',
        run: (f, lib) =>
          lib.distance3(
            lib.transformPoint3(f.planetMatrix(1.7), ORIGIN3),
            lib.transformPoint3(f.moonMatrix(1.7), ORIGIN3),
          ),
        expect: 2,
        hint: 'if not, your multiply order detached the moon — planetMatrix(t) must be the LEFTMOST factor',
      },
    ],
    codeVersion: 1,
  },
]
