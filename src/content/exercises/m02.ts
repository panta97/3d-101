/**
 * Module 2 exercises — Dot, Cross, and Planes. DOM-FREE (imported by the
 * worker and vitest).
 *
 * provides rule: only names taught in EARLIER exercises (Module 1 vector ops,
 * then this module's own exports as they accumulate). The learner is never
 * handed the thing the current exercise teaches.
 */

import type { ExerciseSpec } from '@/exercise/types'

const v = (x: number, y: number) => ({ x, y })
const v3 = (x: number, y: number, z: number) => ({ x, y, z })

export const M02_EXERCISES: ExerciseSpec[] = [
  /* ----------------------------- 02/dot ----------------------------- */
  {
    id: '02/dot',
    title: 'The dot product',
    signature: `function dot(a: Vec2, b: Vec2): number
function dot3(a: Vec3, b: Vec3): number`,
    starter: `// dot(a, b) multiplies matching components and sums them:
//   a.x * b.x + a.y * b.y
// One number out: how much does a go in b's direction?
function dot(a, b) {
  // your code here
}

// The 3D twin — same idea, one more axis.
function dot3(a, b) {
  // your code here
}
`,
    solution: `function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function dot3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
`,
    exports: ['dot', 'dot3'],
    tests: [
      {
        name: 'dot((1,0), (0,1)) — perpendicular',
        run: (f) => f.dot(v(1, 0), v(0, 1)),
        expect: 0,
        hint: 'perpendicular vectors share no direction at all — the meter reads exactly zero',
      },
      {
        name: 'dot((2,3), (4,5))',
        run: (f) => f.dot(v(2, 3), v(4, 5)),
        expect: 23,
      },
      {
        name: 'dot((2,3), (4,-5))',
        run: (f) => f.dot(v(2, 3), v(4, -5)),
        expect: -7,
      },
      {
        name: 'dot((3,4), (3,4)) — look familiar?',
        run: (f) => f.dot(v(3, 4), v(3, 4)),
        expect: 25,
        hint: "that's lengthSq — you already wrote a dot product last module: dot(v, v) === lengthSq(v)",
      },
      {
        name: 'dot((1,0), (-1,0)) — opposite',
        run: (f) => f.dot(v(1, 0), v(-1, 0)),
        expect: -1,
      },
      {
        name: 'dot3((1,2,3), (4,-5,6))',
        run: (f) => f.dot3(v3(1, 2, 3), v3(4, -5, 6)),
        expect: 12,
      },
    ],
    codeVersion: 1,
  },

  /* ------------------------ 02/project-reject ----------------------- */
  {
    id: '02/project-reject',
    title: 'Project and reject',
    signature: `function project(a: Vec2, b: Vec2): Vec2   // the part of a along b
function reject(a: Vec2, b: Vec2): Vec2    // the part of a across b`,
    starter: `// project(a, b) = scale(b, dot(a, b) / lengthSq(b))
// Mind the zero policy: project(a, (0,0)) must return (0,0), never NaN.
function project(a, b) {
  // your code here
}

// Whatever projection didn't capture:
// reject(a, b) = sub(a, project(a, b))
function reject(a, b) {
  // your code here
}
`,
    solution: `function project(a, b) {
  const bb = lengthSq(b);
  if (bb === 0) return { x: 0, y: 0 };
  return scale(b, dot(a, b) / bb);
}

function reject(a, b) {
  return sub(a, project(a, b));
}
`,
    exports: ['project', 'reject'],
    provides: ['add', 'sub', 'scale', 'dot', 'lengthSq'],
    tests: [
      {
        name: 'project((3,4), (10,0)) — shadow on the x-axis',
        run: (f) => f.project(v(3, 4), v(10, 0)),
        expect: v(3, 0),
        hint: "b's length must not matter — only its direction; that's the divide by lengthSq(b)",
      },
      {
        name: 'project((2,2), (0,5))',
        run: (f) => f.project(v(2, 2), v(0, 5)),
        expect: v(0, 2),
      },
      {
        name: 'project((3,4), (1,1))',
        run: (f) => f.project(v(3, 4), v(1, 1)),
        expect: v(3.5, 3.5),
      },
      {
        name: 'project((1,2), (0,0)) — the zero policy',
        run: (f) => f.project(v(1, 2), v(0, 0)),
        expect: v(0, 0),
        hint: 'projecting onto nothing is nothing — return (0,0) instead of dividing by zero',
      },
      {
        name: 'reject((3,4), (10,0))',
        run: (f) => f.reject(v(3, 4), v(10, 0)),
        expect: v(0, 4),
      },
      {
        name: 'property: project + reject rebuilds a',
        run: (f, lib) => {
          const a = v(7, -2)
          const b = v(3, 1)
          return lib.add(f.project(a, b), f.reject(a, b))
        },
        expect: v(7, -2),
        hint: 'the two pieces must sum back to the original — nothing lost, nothing invented',
      },
      {
        name: 'property: reject is perpendicular to b',
        run: (f, lib) => lib.dot(f.reject(v(3, 4), v(1, 1)), v(1, 1)),
        expect: 0,
        hint: 'the across part shares nothing with b, so its dot with b is exactly zero',
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 02/angles -------------------------- */
  {
    id: '02/angles',
    title: 'Angles and the FOV test',
    signature: `function angleBetween(a: Vec2, b: Vec2): number   // radians, in [0, π]
function isInFov(guardPos: Vec2, facing: Vec2, targetPos: Vec2, fov: number): boolean`,
    starter: `// Math.acos(dot(â, b̂)) — but floats can hand acos a cosine like
// 1.0000000000000002, and acos hands you back NaN.
// Clamp the cosine to [-1, 1] first. Return 0 if either vector is zero.
function angleBetween(a, b) {
  // your code here
}

// True when targetPos sits inside the guard's vision cone: the angle
// between facing and (targetPos - guardPos) is at most fov / 2.
// Do it WITHOUT acos: compare dot(facing^, toTarget^) >= Math.cos(fov / 2).
// Don't trust facing to be unit length.
function isInFov(guardPos, facing, targetPos, fov) {
  // your code here
}
`,
    solution: `function angleBetween(a, b) {
  const la = length(a);
  const lb = length(b);
  if (la === 0 || lb === 0) return 0;
  const c = dot(a, b) / (la * lb);
  return Math.acos(Math.min(1, Math.max(-1, c)));
}

function isInFov(guardPos, facing, targetPos, fov) {
  const toTarget = normalize(sub(targetPos, guardPos));
  return dot(normalize(facing), toTarget) >= Math.cos(fov / 2);
}
`,
    exports: ['angleBetween', 'isInFov'],
    provides: ['sub', 'dot', 'normalize', 'length', 'scale'],
    tests: [
      {
        name: 'angleBetween((1,0), (0,1)) — a right angle',
        run: (f) => f.angleBetween(v(1, 0), v(0, 1)),
        expect: Math.PI / 2,
      },
      {
        name: 'angleBetween((1,0), (1,1))',
        run: (f) => f.angleBetween(v(1, 0), v(1, 1)),
        expect: Math.PI / 4,
      },
      {
        name: 'angleBetween((1,0), (-1,0)) — opposite',
        run: (f) => f.angleBetween(v(1, 0), v(-1, 0)),
        expect: Math.PI,
      },
      {
        name: 'angleBetween((2,0), (4,0)) — parallel, lengths irrelevant',
        run: (f) => f.angleBetween(v(2, 0), v(4, 0)),
        expect: 0,
      },
      {
        name: 'angleBetween((0.1, 0.7), (0.1, 0.7)) — a vector with itself, float dirt',
        run: (f) => f.angleBetween(v(0.1, 0.7), v(0.1, 0.7)),
        expect: 0,
        hint: 'the angle of a vector with itself is plainly 0 — yet dot(v,v)/(|v||v|) rounds to 1.0000000000000002, a hair above 1, and naive Math.acos of that is NaN; clamp the cosine to [-1, 1] before acos',
      },
      {
        name: 'isInFov((0,0), facing (1,0), target (5,4), fov 90°) → spotted',
        run: (f) => f.isInFov(v(0, 0), v(1, 0), v(5, 4), Math.PI / 2),
        expect: true,
      },
      {
        name: 'isInFov((0,0), facing (1,0), target (5,6), fov 90°) → safe',
        run: (f) => f.isInFov(v(0, 0), v(1, 0), v(5, 6), Math.PI / 2),
        expect: false,
      },
      {
        name: 'isInFov((0,0), facing (10,0), target (5,6), fov 90°) — facing is NOT unit length',
        run: (f) => f.isInFov(v(0, 0), v(10, 0), v(5, 6), Math.PI / 2),
        expect: false,
        hint: 'a long facing vector inflates the dot product until everything "passes" — normalize facing before comparing',
      },
    ],
    codeVersion: 2,
  },

  /* ----------------------------- 02/cross --------------------------- */
  {
    id: '02/cross',
    title: 'The cross product',
    signature: `function cross(a: Vec3, b: Vec3): Vec3     // perpendicular to both — right-handed
function cross2(a: Vec2, b: Vec2): number  // the 2D shadow: just the z component`,
    starter: `// cross(a, b) = ( a.y*b.z - a.z*b.y,
//                 a.z*b.x - a.x*b.z,
//                 a.x*b.y - a.y*b.x )
// Each component skips its own axis and cross-multiplies the other two.
function cross(a, b) {
  // your code here
}

// Embed 2D vectors at z = 0 and only the z component survives:
//   a.x*b.y - a.y*b.x
// Its sign says whether b is to the left (+) or right (−) of a.
function cross2(a, b) {
  // your code here
}
`,
    solution: `function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function cross2(a, b) {
  return a.x * b.y - a.y * b.x;
}
`,
    exports: ['cross', 'cross2'],
    provides: ['dot3', 'normalize3', 'sub3'],
    tests: [
      {
        name: 'cross(x̂, ŷ) → ẑ — the right-hand check',
        run: (f) => f.cross(v3(1, 0, 0), v3(0, 1, 0)),
        expect: v3(0, 0, 1),
        hint: 'point your right hand’s fingers along x, curl toward y — the thumb is +z; if you got (0,0,−1) two terms are swapped',
      },
      {
        name: 'cross(ŷ, x̂) → −ẑ — order is meaning',
        run: (f) => f.cross(v3(0, 1, 0), v3(1, 0, 0)),
        expect: v3(0, 0, -1),
        hint: 'swapping the arguments flips the result — cross is anticommutative',
      },
      {
        name: 'cross((2,0,0), (4,0,0)) — parallel inputs',
        run: (f) => f.cross(v3(2, 0, 0), v3(4, 0, 0)),
        expect: v3(0, 0, 0),
        hint: 'parallel vectors pin down no perpendicular — there are infinitely many, so the answer collapses to zero',
      },
      {
        name: 'cross((1,2,3), (4,5,6))',
        run: (f) => f.cross(v3(1, 2, 3), v3(4, 5, 6)),
        expect: v3(-3, 6, -3),
      },
      {
        name: 'cross((3,0,0), (0,4,0)) — length reports area 12',
        run: (f) => f.cross(v3(3, 0, 0), v3(0, 4, 0)),
        expect: v3(0, 0, 12),
        hint: 'a 3×4 rectangle spans area 12 — |cross(a,b)| is the parallelogram’s area, for free',
      },
      {
        name: 'cross2((1,0), (0,1)) → +1 — b to the left',
        run: (f) => f.cross2(v(1, 0), v(0, 1)),
        expect: 1,
      },
      {
        name: 'cross2((1,0), (0,-1)) → −1 — b to the right',
        run: (f) => f.cross2(v(1, 0), v(0, -1)),
        expect: -1,
      },
      {
        name: 'property: cross(a,b) is perpendicular to a',
        run: (f, lib) => lib.dot3(f.cross(v3(2, -1, 5), v3(-3, 4, 1)), v3(2, -1, 5)),
        expect: 0,
        hint: 'whatever a and b are, dot3(cross(a,b), a) must be exactly 0 — that perpendicularity is the whole point',
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 02/planes -------------------------- */
  {
    id: '02/planes',
    title: 'Planes and signed distance',
    signature: `// Plane = { n: Vec3 (unit), d: number } — the plane is every p where dot3(n, p) = d
function signedDistance(plane: Plane, p: Vec3): number
function classifyPoint(plane: Plane, p: Vec3, eps?: number): 'front' | 'back' | 'on'
function planeFromPoints(a: Vec3, b: Vec3, c: Vec3): Plane
function sphereInFrustum(planes: Plane[], c: Vec3, r: number): boolean`,
    starter: `// The plane is every p where dot3(n, p) = d, so dot3(n, p) - d is how far
// p sits from it — signed: positive on the side n points toward.
function signedDistance(plane, p) {
  // your code here
}

// 'front' above +eps, 'back' below -eps, 'on' within ±eps.
// eps defaults to 1e-6 when not passed.
function classifyPoint(plane, p, eps) {
  // your code here
}

// Two edges span the plane; their cross is the normal:
//   n = normalize3(cross(sub3(b, a), sub3(c, a)))
// then d = dot3(n, a). Return plane(n, d).
// The winding a→b→c decides which way n points.
function planeFromPoints(a, b, c) {
  // your code here
}

// A sphere is OUT only when it is fully outside some plane:
//   signedDistance(plane, c) < -r
// Straddling a plane counts as in. No plane rejects it → true.
function sphereInFrustum(planes, c, r) {
  // your code here
}
`,
    solution: `function signedDistance(plane, p) {
  return dot3(plane.n, p) - plane.d;
}

function classifyPoint(plane, p, eps) {
  if (eps === undefined) eps = 1e-6;
  const sd = signedDistance(plane, p);
  if (sd > eps) return 'front';
  if (sd < -eps) return 'back';
  return 'on';
}

function planeFromPoints(a, b, c) {
  const n = normalize3(cross(sub3(b, a), sub3(c, a)));
  return plane(n, dot3(n, a));
}

function sphereInFrustum(planes, c, r) {
  for (const pl of planes) {
    if (signedDistance(pl, c) < -r) return false;
  }
  return true;
}
`,
    exports: ['signedDistance', 'classifyPoint', 'planeFromPoints', 'sphereInFrustum'],
    provides: ['dot3', 'sub3', 'cross', 'normalize3', 'vec3', 'plane'],
    tests: [
      {
        name: 'ground plane {n:(0,1,0), d:0}: signedDistance to (5,3,2)',
        run: (f) => f.signedDistance({ n: v3(0, 1, 0), d: 0 }, v3(5, 3, 2)),
        expect: 3,
        hint: 'for the ground plane the answer is just the height — dot3 with (0,1,0) reads off y',
      },
      {
        name: 'ground plane: signedDistance to (0,-2,0) — below',
        run: (f) => f.signedDistance({ n: v3(0, 1, 0), d: 0 }, v3(0, -2, 0)),
        expect: -2,
      },
      {
        name: '{n:(0,0,1), d:5}: signedDistance to (1,2,9)',
        run: (f) => f.signedDistance({ n: v3(0, 0, 1), d: 5 }, v3(1, 2, 9)),
        expect: 4,
        hint: 'don’t forget the − d: the plane sits at z = 5, not at the origin',
      },
      {
        name: '45°-tilted plane {n:normalize(1,1,0), d:0}: signedDistance to (1,1,0)',
        run: (f) =>
          f.signedDistance({ n: v3(Math.SQRT1_2, Math.SQRT1_2, 0), d: 0 }, v3(1, 1, 0)),
        expect: Math.SQRT2,
      },
      {
        name: "classifyPoint(ground, (3,0,7)) → 'on'",
        run: (f) => f.classifyPoint({ n: v3(0, 1, 0), d: 0 }, v3(3, 0, 7)),
        expect: 'on',
      },
      {
        name: "classifyPoint(ground, (3,2,7)) → 'front'",
        run: (f) => f.classifyPoint({ n: v3(0, 1, 0), d: 0 }, v3(3, 2, 7)),
        expect: 'front',
      },
      {
        name: 'planeFromPoints((0,0,0), (1,0,0), (0,1,0)) — the xy-plane',
        run: (f) => f.planeFromPoints(v3(0, 0, 0), v3(1, 0, 0), v3(0, 1, 0)),
        expect: { n: v3(0, 0, 1), d: 0 },
      },
      {
        name: 'planeFromPoints((0,2,0), (0,2,1), (1,2,0)) — winding determines the normal',
        run: (f) => f.planeFromPoints(v3(0, 2, 0), v3(0, 2, 1), v3(1, 2, 0)),
        expect: { n: v3(0, 1, 0), d: 2 },
        hint: 'walked the other way round, these three points would give n = (0,−1,0), d = −2 — the order of a, b, c is data, not style',
      },
      {
        name: 'sphereInFrustum([ground], c=(0,2,0), r=1) → in',
        run: (f) => f.sphereInFrustum([{ n: v3(0, 1, 0), d: 0 }], v3(0, 2, 0), 1),
        expect: true,
      },
      {
        name: 'sphereInFrustum([ground], c=(0,-3,0), r=1) → out',
        run: (f) => f.sphereInFrustum([{ n: v3(0, 1, 0), d: 0 }], v3(0, -3, 0), 1),
        expect: false,
      },
      {
        name: 'sphereInFrustum([ground], c=(0,-0.5,0), r=1) — straddling counts as in',
        run: (f) => f.sphereInFrustum([{ n: v3(0, 1, 0), d: 0 }], v3(0, -0.5, 0), 1),
        expect: true,
        hint: 'cull only when the WHOLE sphere is outside: signedDistance < -r, not < 0 — a sphere poking through the plane is still visible',
      },
      {
        name: 'two planes: passing one is not enough',
        run: (f) =>
          f.sphereInFrustum(
            [
              { n: v3(0, 1, 0), d: 0 },
              { n: v3(-1, 0, 0), d: 0 },
            ],
            v3(2, 5, 0),
            1,
          ),
        expect: false,
        hint: 'one rejecting plane is enough to cull — the sphere must survive every plane to stay',
      },
    ],
    codeVersion: 1,
  },

  /* ----------------------------- 02/reflect ------------------------- */
  {
    id: '02/reflect',
    title: 'Reflection',
    signature: `function reflect(v: Vec2, n: Vec2): Vec2    // n is unit length
function reflect3(v: Vec3, n: Vec3): Vec3`,
    starter: `// r = v - 2 * dot(v, n) * n
// dot(v, n) measures how much of v points into the surface; remove it
// twice — once to cancel the approach, once to push back out.
// n is guaranteed unit length.
function reflect(v, n) {
  // your code here
}

// The identical formula with the 3-suffixed functions.
function reflect3(v, n) {
  // your code here
}
`,
    solution: `function reflect(v, n) {
  return sub(v, scale(n, 2 * dot(v, n)));
}

function reflect3(v, n) {
  return sub3(v, scale3(n, 2 * dot3(v, n)));
}
`,
    exports: ['reflect', 'reflect3'],
    provides: ['sub', 'scale', 'dot', 'sub3', 'scale3', 'dot3'],
    tests: [
      {
        name: 'reflect((1,-1), (0,1)) — bounce off the floor',
        run: (f) => f.reflect(v(1, -1), v(0, 1)),
        expect: v(1, 1),
        hint: 'falling down-and-right leaves up-and-right: the sideways part survives, the downward part flips',
      },
      {
        name: 'reflect((2,-3), (0,1))',
        run: (f) => f.reflect(v(2, -3), v(0, 1)),
        expect: v(2, 3),
      },
      {
        name: 'reflect((0,-1), normalize(1,1)) — a 45° mirror',
        run: (f, lib) => f.reflect(v(0, -1), lib.normalize(v(1, 1))),
        expect: v(1, 0),
        hint: 'straight down hits the 45°-leaning mirror (normal pointing up-right) and leaves going right — if you got something else, check the factor of 2',
      },
      {
        name: 'reflect((1,0), (0,1)) — grazing along the surface, unchanged',
        run: (f) => f.reflect(v(1, 0), v(0, 1)),
        expect: v(1, 0),
        hint: 'dot(v, n) = 0 means nothing points into the surface — there is nothing to remove',
      },
      {
        name: 'reflect3((1,2,-1), (0,0,1))',
        run: (f) => f.reflect3(v3(1, 2, -1), v3(0, 0, 1)),
        expect: v3(1, 2, 1),
      },
      {
        name: 'property: reflection preserves length — |reflect((3,4), n̂)| = 5',
        run: (f, lib) => lib.length(f.reflect(v(3, 4), lib.normalize(v(2, 5)))),
        expect: 5,
        hint: 'a mirror changes direction, never speed — if the length drifted, the factor of 2 or the dot is off',
      },
    ],
    codeVersion: 1,
  },

  /* ------------------------- 02/capstone-sphere --------------------- */
  {
    id: '02/capstone-sphere',
    title: 'Capstone: shade a sphere with math alone',
    signature: `function sphereNormal(x: number, y: number): Vec3 | null  // unit-disc coords; null outside
function diffuse(x: number, y: number, L: Vec3): number   // Lambert: max(0, dot3(n, L)); 0 off the disc
function shadePixel(x: number, y: number, L: Vec3): number // diffuse + specular; 0 off the disc`,
    starter: `// The unit sphere seen head-on: at disc coords (x, y) the surface sits at
// z = Math.sqrt(1 - x*x - y*y), and for a unit sphere at the origin the
// position IS the normal. Outside the disc (x*x + y*y > 1) return null.
function sphereNormal(x, y) {
  // your code here
}

// Lambert lighting: brightness = max(0, dot3(n, L)).
// L is a unit vector pointing TOWARD the light. Return 0 off the disc.
function diffuse(x, y, L) {
  // your code here
}

// diffuse + specular. The viewer sits along +z at vec3(0, 0, 1).
// Bounce the INCOMING light (that's scale3(L, -1)) off the surface and ask
// how directly it flies at the viewer:
//   spec = Math.pow(Math.max(0, dot3(reflect3(scale3(L, -1), n), vec3(0, 0, 1))), 32)
// Return diffuse + spec, unclamped. Return 0 off the disc.
function shadePixel(x, y, L) {
  // your code here
}
`,
    solution: `function sphereNormal(x, y) {
  const rr = x * x + y * y;
  if (rr > 1) return null;
  return vec3(x, y, Math.sqrt(1 - rr));
}

function diffuse(x, y, L) {
  const n = sphereNormal(x, y);
  if (n === null) return 0;
  return Math.max(0, dot3(n, L));
}

function shadePixel(x, y, L) {
  const n = sphereNormal(x, y);
  if (n === null) return 0;
  const d = Math.max(0, dot3(n, L));
  const r = reflect3(scale3(L, -1), n);
  const s = Math.pow(Math.max(0, dot3(r, vec3(0, 0, 1))), 32);
  return d + s;
}
`,
    exports: ['sphereNormal', 'diffuse', 'shadePixel'],
    provides: ['dot3', 'scale3', 'normalize3', 'reflect3', 'vec3'],
    tests: [
      {
        name: 'sphereNormal(0, 0) — dead center looks straight back',
        run: (f) => f.sphereNormal(0, 0),
        expect: v3(0, 0, 1),
      },
      {
        name: 'sphereNormal(0.6, 0) — a 3-4-5 triangle on the sphere',
        run: (f) => f.sphereNormal(0.6, 0),
        expect: v3(0.6, 0, 0.8),
      },
      {
        name: 'sphereNormal(0.9, 0.9) — off the sphere',
        run: (f) => f.sphereNormal(0.9, 0.9),
        expect: null,
        hint: 'x² + y² > 1 means no sphere here — return null (not undefined), or sqrt hands you NaN',
      },
      {
        name: 'diffuse(0, 0, L=(0,0,1)) — light dead ahead',
        run: (f) => f.diffuse(0, 0, v3(0, 0, 1)),
        expect: 1,
      },
      {
        name: 'diffuse(0.6, 0, L=(0,0,1))',
        run: (f) => f.diffuse(0.6, 0, v3(0, 0, 1)),
        expect: 0.8,
      },
      {
        name: 'diffuse(0, 0, L=(0,0,-1)) — the clamp test',
        run: (f) => f.diffuse(0, 0, v3(0, 0, -1)),
        expect: 0,
        hint: 'a light behind the sphere must read 0, not −1 — that is what the max(0, …) is for; without it, faces glow from lights they cannot see',
      },
      {
        name: 'shadePixel(0, 0, ẑ) > 1 — the highlight stacks on top of diffuse',
        run: (f) => f.shadePixel(0, 0, v3(0, 0, 1)) > 1.5,
        expect: true,
        hint: 'head-on, diffuse is 1 and specular is 1 — return their unclamped sum (the widget clamps for display)',
      },
      {
        name: 'property: shadePixel ≥ diffuse everywhere (specular only adds light)',
        run: (f, lib) => {
          const L = lib.normalize3(lib.vec3(0.4, 0.5, 0.75))
          const samples: Array<[number, number]> = [
            [0, 0],
            [0.5, 0.2],
            [-0.3, 0.6],
            [0.1, -0.7],
          ]
          return samples.every(([x, y]) => {
            const s = f.shadePixel(x, y, L)
            const d = f.diffuse(x, y, L)
            return typeof s === 'number' && typeof d === 'number' && s >= d - 1e-9
          })
        },
        expect: true,
        hint: 'specular is extra shine on top of the diffuse base — it must never subtract',
      },
      {
        name: 'shadePixel(0.9, 0.9, L) — outside the disc shades to 0',
        run: (f, lib) => f.shadePixel(0.9, 0.9, lib.normalize3(lib.vec3(0.4, 0.5, 0.75))),
        expect: 0,
        hint: 'no sphere, no light: return 0 so the background stays dark',
      },
    ],
    codeVersion: 1,
  },
]
