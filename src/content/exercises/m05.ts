/**
 * Module 5 exercises — Projection: 3D onto the Screen. DOM-FREE (imported by
 * the worker and by node vitest).
 *
 * Conventions (pinned course-wide):
 *  - Right-handed view space; the camera looks down −z, so a visible point has
 *    NEGATIVE z and its depth is −z > 0.
 *  - Clip space carries a w; the perspective divide (÷w) lands each axis in
 *    normalized device coordinates (NDC) ∈ [−1, 1].
 *  - Screen pixels: +x right, +y DOWN — the viewport transform flips y.
 *  - Mat4 column-major, 16 numbers (same storage as Module 3).
 *  - Angles in radians, always.
 */

import type { ExerciseSpec } from '@/exercise/types'

const w = (x: number, y: number, z: number) => ({ x, y, z })
const s = (x: number, y: number) => ({ x, y })

const HALF_PI = Math.PI / 2

export const M05_EXERCISES: ExerciseSpec[] = [
  /* ----------------------------- 5.1 ----------------------------- */
  {
    id: '05/perspective-divide',
    title: 'The perspective divide: similar triangles',
    signature: `function projectPinhole(p: Vec3, focal: number): Vec2
// p is in CAMERA space (camera at origin, looking down −z).
// Project it onto an image plane \`focal\` units in front of the eye.`,
    starter: `// A pinhole camera is just similar triangles. The eye is at the origin;
// the image plane sits \`focal\` units down the line of sight. A point at
// depth d = −p.z casts a ray to the eye that crosses the plane scaled by
// focal / d — so nearer points (small d) loom large, far ones shrink.
//   image.x = focal * p.x / (−p.z)
//   image.y = focal * p.y / (−p.z)
// Dividing by depth IS perspective. Return a Vec2 (image-plane coords, +y up).
function projectPinhole(p, focal) {
  // your code here
}
`,
    solution: `function projectPinhole(p, focal) {
  const depth = -p.z;
  return vec2((focal * p.x) / depth, (focal * p.y) / depth);
}
`,
    exports: ['projectPinhole'],
    provides: ['vec2'],
    tests: [
      {
        name: 'a point dead ahead projects to the image center',
        run: (f) => f.projectPinhole(w(0, 0, -5), 1),
        expect: s(0, 0),
        hint: 'x and y are 0, so the image point is (0, 0) regardless of depth',
      },
      {
        name: 'a point at depth = focal projects 1:1',
        run: (f) => f.projectPinhole(w(2, 3, -1), 1),
        expect: s(2, 3),
        hint: 'depth = −p.z = 1, so the divide leaves x and y untouched',
      },
      {
        name: 'twice as far → half the size',
        run: (f) => f.projectPinhole(w(2, 3, -2), 1),
        expect: s(1, 1.5),
        hint: 'depth = 2; dividing by it is the "distant things look small" effect',
      },
      {
        name: 'focal length scales the whole image',
        run: (f) => f.projectPinhole(w(2, 3, -2), 4),
        expect: s(4, 6),
        hint: 'image = focal * p / depth = 4 * (2, 3) / 2',
      },
      {
        name: 'off to the upper-right, at depth 4',
        run: (f) => f.projectPinhole(w(1, 1, -4), 2),
        expect: s(0.5, 0.5),
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 5.2 ----------------------------- */
  {
    id: '05/projection-matrix',
    title: 'The projection matrix: hiding the divide inside a 4×4',
    signature: `function perspective(fovY: number, aspect: number, near: number, far: number): Mat4
// The gluPerspective matrix. fovY is the vertical field of view (radians),
// aspect = width / height. Maps the view frustum to clip space.`,
    starter: `// A matrix is linear — it can't divide by a coordinate. The trick: don't.
// Set up the matrix so the OUTPUT w equals −z (the depth), and let the
// perspective divide (next section) do the division for you.
//   f  = 1 / tan(fovY / 2)        // the focal length the fov implies
//   nf = 1 / (near − far)
// Column-major (columns 0–2 are the axes, the bottom row is m[3],m[7],m[11],m[15]):
//   m[0]  = f / aspect            // x, un-stretched by the aspect ratio
//   m[5]  = f                     // y
//   m[10] = (far + near) * nf     // squashes z into the depth range
//   m[14] = 2 * far * near * nf
//   m[11] = -1                    // THE trick: copies −z into the output w
// everything else 0.
function perspective(fovY, aspect, near, far) {
  // return [ f/aspect, 0, 0, 0,  0, f, 0, 0,  ... ];
}
`,
    solution: `function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ];
}
`,
    exports: ['perspective'],
    tests: [
      {
        name: 'fovY = 90°, aspect 1, near 1, far 3 → the textbook matrix',
        run: (f) => f.perspective(HALF_PI, 1, 1, 3),
        expect: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -2, -1, 0, 0, -3, 0],
        hint: 'f = 1/tan(45°) = 1; nf = 1/(1−3) = −0.5; m[10] = 4·(−0.5) = −2; m[14] = 6·(−0.5) = −3',
      },
      {
        name: 'the aspect ratio divides the x term (and only x)',
        run: (f) => {
          const m = f.perspective(HALF_PI, 2, 1, 3);
          return [m[0], m[5]];
        },
        expect: [0.5, 1],
        hint: 'm[0] = f/aspect = 1/2; m[5] = f = 1 — y is never touched by aspect',
      },
      {
        name: 'the w row is always (0, 0, −1, 0): m[11] = −1, m[15] = 0',
        run: (f) => {
          const m = f.perspective(1.1, 1.7, 0.1, 100);
          return [m[3], m[7], m[11], m[15]];
        },
        expect: [0, 0, -1, 0],
        hint: 'the −1 sits at m[11]; the rest of the bottom row is zero so output w = −z',
      },
      {
        name: 'the near plane maps to NDC z = −1',
        run: (f, lib) => {
          const m = f.perspective(HALF_PI, 1, 1, 3);
          return lib.perspectiveDivide(lib.transformPoint4(m, w(0, 0, -1))).z;
        },
        expect: -1,
        hint: 'a view point on the near plane is (0, 0, −near); after the divide its z is −1',
      },
      {
        name: 'the far plane maps to NDC z = +1',
        run: (f, lib) => {
          const m = f.perspective(HALF_PI, 1, 1, 3);
          return lib.perspectiveDivide(lib.transformPoint4(m, w(0, 0, -3))).z;
        },
        expect: 1,
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 5.3 ----------------------------- */
  {
    id: '05/clip-space',
    title: 'Clip space → NDC: w finally matters',
    signature: `function transformPoint4(m: Mat4, p: Vec3): Vec4   // keeps the w!
function perspectiveDivide(v: Vec4): Vec3          // divide by w
// transformPoint4 is transformPoint3 with the bottom row put back;
// perspectiveDivide collapses the homogeneous point to NDC.`,
    starter: `// Module 3's transformPoint3 threw away the bottom matrix row because w was
// always 1. The projection matrix put −z down there, so now you must keep it.
//   transformPoint4(m, p) = ( m·p ) including the 4th coordinate w:
//     x = m[0]*p.x + m[4]*p.y + m[8]*p.z  + m[12]
//     y = m[1]*p.x + m[5]*p.y + m[9]*p.z  + m[13]
//     z = m[2]*p.x + m[6]*p.y + m[10]*p.z + m[14]
//     w = m[3]*p.x + m[7]*p.y + m[11]*p.z + m[15]   // <- the new line
//   return vec4(x, y, z, w);
function transformPoint4(m, p) {
  // your code here
}

// The perspective divide: dividing x, y, z through by w is the moment
// 3D becomes 2D-with-depth. After it, every visible coordinate is in [−1, 1].
function perspectiveDivide(v) {
  // return vec3(v.x / v.w, v.y / v.w, v.z / v.w);
}
`,
    solution: `function transformPoint4(m, p) {
  return vec4(
    m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
    m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
    m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14],
    m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15],
  );
}

function perspectiveDivide(v) {
  return vec3(v.x / v.w, v.y / v.w, v.z / v.w);
}
`,
    exports: ['transformPoint4', 'perspectiveDivide'],
    provides: ['vec4', 'vec3'],
    tests: [
      {
        name: 'identity keeps the point and sets w = 1',
        run: (f) =>
          f.transformPoint4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], w(2, 3, 4)),
        expect: { x: 2, y: 3, z: 4, w: 1 },
        hint: 'with an identity matrix x,y,z pass through and the bottom row gives w = 1',
      },
      {
        name: 'a bottom row of (0,0,−1,0) drops −z into w',
        run: (f) =>
          f.transformPoint4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0], w(2, 3, -5)),
        expect: { x: 2, y: 3, z: -5, w: 5 },
        hint: 'w = m[11]*p.z = (−1)·(−5) = 5 — the depth, exactly what projection needs',
      },
      {
        name: 'perspectiveDivide divides every axis by w',
        run: (f) => f.perspectiveDivide({ x: 4, y: 6, z: 8, w: 2 }),
        expect: w(2, 3, 4),
        hint: '(4, 6, 8) / 2 = (2, 3, 4)',
      },
      {
        name: 'when w = 1 the divide is a no-op',
        run: (f) => f.perspectiveDivide({ x: 2, y: -3, z: 0.5, w: 1 }),
        expect: w(2, -3, 0.5),
      },
      {
        name: 'a centered view point lands at NDC (0, 0)',
        run: (f, lib) => {
          const clip = f.transformPoint4(lib.perspective(HALF_PI, 1, 1, 10), w(0, 0, -2));
          const ndc = f.perspectiveDivide(clip);
          return [ndc.x, ndc.y];
        },
        expect: [0, 0],
      },
      {
        name: 'off-axis: x = 1 at depth 2 lands at NDC x = 0.5',
        run: (f, lib) => {
          const clip = f.transformPoint4(lib.perspective(HALF_PI, 1, 1, 10), w(1, 0, -2));
          return f.perspectiveDivide(clip).x;
        },
        expect: 0.5,
        hint: 'clip.x = f·1 = 1, clip.w = −z = 2, so NDC x = 1/2 — the divide at work',
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 5.4 ----------------------------- */
  {
    id: '05/viewport',
    title: 'The viewport transform: NDC → pixels',
    signature: `function viewport(ndc: Vec3, width: number, height: number): Vec2
// Map NDC (x, y ∈ [−1, 1]) onto a width×height pixel rectangle.
// Screen y points DOWN, so the mapping flips it.`,
    starter: `// NDC is a tidy 2×2 square centered on the origin; the canvas is a
// width×height rectangle whose origin is the TOP-left and whose y grows
// downward. Remap each axis from [−1, 1] to its pixel range:
//   x: (−1 → 0,      +1 → width)   ⇒  (ndc.x + 1) / 2 * width
//   y: (+1 → 0,      −1 → height)  ⇒  (1 − ndc.y) / 2 * height   // flipped!
// Return a Vec2 of pixels.
function viewport(ndc, width, height) {
  // your code here
}
`,
    solution: `function viewport(ndc, width, height) {
  return vec2(((ndc.x + 1) / 2) * width, ((1 - ndc.y) / 2) * height);
}
`,
    exports: ['viewport'],
    provides: ['vec2'],
    tests: [
      {
        name: 'NDC center (0, 0) → the middle of the canvas',
        run: (f) => f.viewport(w(0, 0, 0), 800, 600),
        expect: s(400, 300),
        hint: '(0+1)/2·800 = 400; (1−0)/2·600 = 300',
      },
      {
        name: 'NDC (−1, −1) is the bottom-left corner → (0, height)',
        run: (f) => f.viewport(w(-1, -1, 0), 800, 600),
        expect: s(0, 600),
        hint: 'NDC bottom (y = −1) maps to the largest pixel y, because y is flipped',
      },
      {
        name: 'NDC (1, 1) is the top-right corner → (width, 0)',
        run: (f) => f.viewport(w(1, 1, 0), 800, 600),
        expect: s(800, 0),
      },
      {
        name: 'the y-flip: NDC top (0, 1) → pixel y = 0',
        run: (f) => f.viewport(w(0, 1, 0), 800, 600),
        expect: s(400, 0),
        hint: 'without the (1 − ndc.y) flip, "up" in NDC would land at the bottom of the canvas',
      },
      {
        name: 'an arbitrary point on a 400×200 canvas',
        run: (f) => f.viewport(w(0.5, -0.5, 0), 400, 200),
        expect: s(300, 150),
        hint: 'x: 1.5/2·400 = 300;  y: (1−(−0.5))/2·200 = 150',
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 5.5 ----------------------------- */
  {
    id: '05/orthographic',
    title: 'Orthographic: projection without the divide',
    signature: `function orthographic(width: number, height: number, near: number, far: number): Mat4
// Parallel projection: a width×height×[near,far] box mapped onto the NDC cube.
// The w row stays (0, 0, 0, 1), so there is no foreshortening.`,
    starter: `// Perspective divides by depth; orthographic refuses to. It keeps w = 1, so
// the perspective divide does nothing and distant objects stay full size —
// the look of CAD, blueprints and isometric games. Just scale each axis from
// its box range onto [−1, 1]:
//   m[0]  = 2 / width
//   m[5]  = 2 / height
//   m[10] = -2 / (far − near)
//   m[14] = -(far + near) / (far − near)
//   m[15] = 1                       // bottom row stays (0, 0, 0, 1)
// everything else 0.
function orthographic(width, height, near, far) {
  // return [ 2/width, 0, 0, 0,  0, 2/height, 0, 0,  ... ];
}
`,
    solution: `function orthographic(width, height, near, far) {
  return [
    2 / width, 0, 0, 0,
    0, 2 / height, 0, 0,
    0, 0, -2 / (far - near), 0,
    0, 0, -(far + near) / (far - near), 1,
  ];
}
`,
    exports: ['orthographic'],
    tests: [
      {
        name: 'a 4×2 box, near 1, far 3 → the scale matrix',
        run: (f) => f.orthographic(4, 2, 1, 3),
        expect: [0.5, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, -2, 1],
        hint: '2/4 = 0.5; 2/2 = 1; −2/(3−1) = −1; −(3+1)/(3−1) = −2; m[15] = 1',
      },
      {
        name: 'the bottom row is (0, 0, 0, 1): no divide will happen',
        run: (f) => {
          const m = f.orthographic(10, 10, 1, 100);
          return [m[3], m[7], m[11], m[15]];
        },
        expect: [0, 0, 0, 1],
        hint: 'unlike perspective, m[11] is 0 and m[15] is 1, so output w = 1',
      },
      {
        name: 'the right edge x = width/2 maps to NDC x = +1',
        run: (f, lib) => {
          const m = f.orthographic(4, 2, 1, 3);
          return lib.perspectiveDivide(lib.transformPoint4(m, w(2, 0, -1))).x;
        },
        expect: 1,
      },
      {
        name: 'the near plane maps to NDC z = −1',
        run: (f, lib) => {
          const m = f.orthographic(4, 2, 1, 3);
          return lib.perspectiveDivide(lib.transformPoint4(m, w(0, 0, -1))).z;
        },
        expect: -1,
      },
      {
        name: 'no foreshortening: same x at two depths → same NDC x',
        run: (f, lib) => {
          const m = f.orthographic(4, 2, 1, 3);
          const near = lib.perspectiveDivide(lib.transformPoint4(m, w(2, 0, -1))).x;
          const far = lib.perspectiveDivide(lib.transformPoint4(m, w(2, 0, -2.9))).x;
          return [near, far];
        },
        expect: [1, 1],
        hint: 'depth never enters the x mapping — that is exactly what "parallel" means',
      },
    ],
    codeVersion: 1,
  },

  /* --------------------------- capstone --------------------------- */
  {
    id: '05/project3',
    title: 'Capstone: project3() un-boxed',
    signature: `function project3(mvp: Mat4, p: Vec3, width: number, height: number): Vec2 | null
// mvp = projection · view · model. Take a model-space point all the way to a
// screen pixel. Return null for points at or behind the camera (w ≤ 0).`,
    starter: `// The whole pipeline, in three calls you already wrote (provided here):
//   1. transformPoint4(mvp, p)  → a homogeneous clip-space point (with w)
//   2. cull if w ≤ 0            → it's at or behind the eye; nothing to draw
//   3. perspectiveDivide(...)   → NDC
//   4. viewport(..., w, h)      → the pixel
// This is project3() — the black box every diagram in this course leaned on,
// now entirely your code.
function project3(mvp, p, width, height) {
  // const clip = transformPoint4(mvp, p);
  // if (clip.w <= 0) return null;
  // return viewport(perspectiveDivide(clip), width, height);
}
`,
    solution: `function project3(mvp, p, width, height) {
  const clip = transformPoint4(mvp, p);
  if (clip.w <= 0) return null;
  return viewport(perspectiveDivide(clip), width, height);
}
`,
    exports: ['project3'],
    provides: ['transformPoint4', 'perspectiveDivide', 'viewport', 'vec2'],
    tests: [
      {
        name: 'a centered view point projects to the middle of the canvas',
        run: (f, lib) => f.project3(lib.perspective(HALF_PI, 1, 1, 10), w(0, 0, -2), 800, 600),
        expect: s(400, 300),
        hint: 'NDC (0,0) → viewport center (width/2, height/2)',
      },
      {
        name: 'a point behind the camera returns null',
        run: (f, lib) => f.project3(lib.perspective(HALF_PI, 1, 1, 10), w(0, 0, 5), 800, 600),
        expect: null,
        hint: 'a point with +z is behind the eye; its clip w = −z ≤ 0, so cull it',
      },
      {
        name: 'a point to the right lands right of center',
        run: (f, lib) => f.project3(lib.perspective(HALF_PI, 1, 1, 10), w(1, 0, -2), 800, 600),
        expect: s(600, 300),
        hint: 'NDC x = 0.5 → pixel x = (0.5+1)/2·800 = 600',
      },
      {
        name: 'a point above center lands higher on screen (smaller pixel y)',
        run: (f, lib) => f.project3(lib.perspective(HALF_PI, 1, 1, 10), w(0, 1, -2), 800, 600),
        expect: s(400, 150),
        hint: 'NDC y = 0.5 → pixel y = (1−0.5)/2·600 = 150, above the center line',
      },
      {
        name: 'full chain projection · view: the look-at target lands dead center',
        run: (f, lib) => {
          const proj = lib.perspective(HALF_PI, 1, 1, 10);
          const view = lib.lookAt(w(0, 0, 5), w(0, 0, 0), w(0, 1, 0));
          return f.project3(lib.mul4(proj, view), w(0, 0, 0), 800, 600);
        },
        expect: s(400, 300),
        hint: 'view sends the target to (0,0,−5); projection then centers it at (400, 300)',
      },
    ],
    codeVersion: 1,
  },
]
