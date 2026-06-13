/**
 * Module 1 exercises — Vectors. DOM-FREE (imported by the worker and vitest).
 *
 * This file establishes the ExerciseSpec house style:
 *  - starter declares every export with a commented body
 *  - test `run` receives (learner fns, reference lib) — property tests may
 *    combine both
 *  - trap tests carry a `hint` shown only on failure
 */

import type { ExerciseSpec } from '@/exercise/types'

const v = (x: number, y: number) => ({ x, y })
const v3 = (x: number, y: number, z: number) => ({ x, y, z })

export const M01_EXERCISES: ExerciseSpec[] = [
  {
    id: '01/add',
    title: 'Vector addition',
    signature: `function add(a: Vec2, b: Vec2): Vec2    // Vec2 = { x: number, y: number }`,
    starter: `// a and b are plain objects: { x, y }.
// Return a NEW { x, y } — never mutate the inputs.
function add(a, b) {
  // your code here
}
`,
    solution: `function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}
`,
    exports: ['add'],
    tests: [
      {
        name: 'add((1,2), (3,4))',
        run: (f) => f.add(v(1, 2), v(3, 4)),
        expect: v(4, 6),
      },
      {
        name: 'add((-1,5), (1,-5))',
        run: (f) => f.add(v(-1, 5), v(1, -5)),
        expect: v(0, 0),
        hint: 'opposite vectors cancel — a move out and the exact move back',
      },
      {
        name: 'add((0,0), (7,-3))',
        run: (f) => f.add(v(0, 0), v(7, -3)),
        expect: v(7, -3),
      },
      {
        name: 'add((0.1,0.2), (0.2,0.1)) — floats lie',
        run: (f) => f.add(v(0.1, 0.2), v(0.2, 0.1)),
        expect: v(0.3, 0.3),
        hint: '0.1 + 0.2 !== 0.3 in floating point; that is why this course never compares floats with ===',
      },
      {
        name: 'does not mutate its inputs',
        run: (f) => {
          const a = v(2, 3)
          f.add(a, v(5, 5))
          return a
        },
        expect: v(2, 3),
        hint: 'return a new object instead of writing into a',
      },
    ],
    codeVersion: 1,
  },

  {
    id: '01/sub',
    title: 'Subtraction: the arrow between',
    signature: `function sub(a: Vec2, b: Vec2): Vec2    // the move FROM b TO a
function neg(v: Vec2): Vec2             // the same move, reversed`,
    starter: `// sub(a, b) is the displacement that carries you FROM b TO a.
// Mnemonic: "sub points at the first argument."
function sub(a, b) {
  // your code here
}

// neg(v) is the exact opposite move.
function neg(v) {
  // your code here
}
`,
    solution: `function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function neg(v) {
  return { x: -v.x, y: -v.y };
}
`,
    exports: ['sub', 'neg'],
    provides: ['add'],
    tests: [
      {
        name: 'sub((5,7), (2,3))',
        run: (f) => f.sub(v(5, 7), v(2, 3)),
        expect: v(3, 4),
      },
      {
        name: 'sub((2,3), (5,7)) — order matters',
        run: (f) => f.sub(v(2, 3), v(5, 7)),
        expect: v(-3, -4),
        hint: 'sub(a, b) goes FROM b TO a — if you got (3,4), your arguments are swapped. Reversing them is the most common vector bug in the wild.',
      },
      {
        name: 'sub((4,4), (4,4))',
        run: (f) => f.sub(v(4, 4), v(4, 4)),
        expect: v(0, 0),
        hint: 'no distance between a point and itself — the zero vector',
      },
      {
        name: 'neg((3,-4))',
        run: (f) => f.neg(v(3, -4)),
        expect: v(-3, 4),
      },
      {
        name: 'property: add(b, sub(a, b)) lands on a',
        run: (f, lib) => {
          const a = v(9, -2)
          const b = v(4, 4)
          return lib.add(b, f.sub(a, b))
        },
        expect: v(9, -2),
        hint: 'start at b, walk the arrow from b to a — you must land exactly on a',
      },
    ],
    codeVersion: 1,
  },

  {
    id: '01/scale-length',
    title: 'Scaling and length',
    signature: `function scale(v: Vec2, s: number): Vec2   // stretch by s (negative flips)
function length(v: Vec2): number           // how long is the arrow?
function lengthSq(v: Vec2): number         // length squared — no sqrt`,
    starter: `// Multiply both components by s.
function scale(v, s) {
  // your code here
}

// Pythagoras: the arrow is the hypotenuse of its x/y staircase.
// Math.sqrt is your friend.
function length(v) {
  // your code here
}

// Same thing without the square root — for fast comparisons.
function lengthSq(v) {
  // your code here
}
`,
    solution: `function scale(v, s) {
  return { x: v.x * s, y: v.y * s };
}

function lengthSq(v) {
  return v.x * v.x + v.y * v.y;
}

function length(v) {
  return Math.sqrt(lengthSq(v));
}
`,
    exports: ['scale', 'length', 'lengthSq'],
    tests: [
      {
        name: 'scale((3,-2), 2)',
        run: (f) => f.scale(v(3, -2), 2),
        expect: v(6, -4),
      },
      {
        name: 'scale((3,-2), -1) — negative flips',
        run: (f) => f.scale(v(3, -2), -1),
        expect: v(-3, 2),
        hint: 'a negative scale spins the arrow 180° through its own tail',
      },
      {
        name: 'scale((1,2), 0.5)',
        run: (f) => f.scale(v(1, 2), 0.5),
        expect: v(0.5, 1),
      },
      {
        name: 'length((3,4))',
        run: (f) => f.length(v(3, 4)),
        expect: 5,
      },
      {
        name: 'length((-3,-4)) — signs vanish',
        run: (f) => f.length(v(-3, -4)),
        expect: 5,
        hint: 'length is never negative — squaring the components eats the signs',
      },
      {
        name: 'length((1,1))',
        run: (f) => f.length(v(1, 1)),
        expect: Math.SQRT2,
        hint: 'the unit diagonal is √2 ≈ 1.4142136 long — remember this number, it explains a famous bug in §1.4',
      },
      {
        name: 'length((0,0))',
        run: (f) => f.length(v(0, 0)),
        expect: 0,
      },
      {
        name: 'lengthSq((3,4))',
        run: (f) => f.lengthSq(v(3, 4)),
        expect: 25,
        hint: 'no square root anywhere — skipping it is the whole point',
      },
    ],
    codeVersion: 1,
  },

  {
    id: '01/normalize',
    title: 'Normalize, distance',
    signature: `function normalize(v: Vec2): Vec2           // same direction, length 1; normalize(0) → 0
function distance(a: Vec2, b: Vec2): number
function distanceSq(a: Vec2, b: Vec2): number`,
    starter: `// You have sub, scale, length and lengthSq in scope — use them.

// Shrink (or grow) v to length exactly 1, keeping its direction.
// COURSE POLICY: normalize of the zero vector returns the zero
// vector — never NaN. Guard it.
function normalize(v) {
  // your code here
}

// How far apart are the points a and b?
function distance(a, b) {
  // your code here
}

// Same, squared — no sqrt.
function distanceSq(a, b) {
  // your code here
}
`,
    solution: `function normalize(v) {
  const len = length(v);
  if (len === 0) return { x: 0, y: 0 };
  return scale(v, 1 / len);
}

function distance(a, b) {
  return length(sub(a, b));
}

function distanceSq(a, b) {
  return lengthSq(sub(a, b));
}
`,
    exports: ['normalize', 'distance', 'distanceSq'],
    provides: ['sub', 'scale', 'length', 'lengthSq'],
    tests: [
      {
        name: 'normalize((3,4))',
        run: (f) => f.normalize(v(3, 4)),
        expect: v(0.6, 0.8),
      },
      {
        name: 'normalize((0,5))',
        run: (f) => f.normalize(v(0, 5)),
        expect: v(0, 1),
      },
      {
        name: 'normalize((-5,0))',
        run: (f) => f.normalize(v(-5, 0)),
        expect: v(-1, 0),
      },
      {
        name: 'normalize((1,1))',
        run: (f) => f.normalize(v(1, 1)),
        expect: v(Math.SQRT1_2, Math.SQRT1_2),
        hint: 'both components become 1/√2 ≈ 0.7071068 — the diagonal, tamed',
      },
      {
        name: 'normalize((0,0)) — the NaN guard',
        run: (f) => f.normalize(v(0, 0)),
        expect: v(0, 0),
        hint: 'the zero vector has length 0, and dividing by it births NaN — which then infects every calculation it touches. Course policy: return (0,0) instead.',
      },
      {
        name: 'distance((1,2), (4,6))',
        run: (f) => f.distance(v(1, 2), v(4, 6)),
        expect: 5,
      },
      {
        name: 'distance((3,3), (3,3))',
        run: (f) => f.distance(v(3, 3), v(3, 3)),
        expect: 0,
      },
      {
        name: 'distanceSq((1,2), (4,6))',
        run: (f) => f.distanceSq(v(1, 2), v(4, 6)),
        expect: 25,
      },
    ],
    codeVersion: 1,
  },

  {
    id: '01/lerp',
    title: 'Lerp and damp',
    signature: `function lerp(a: Vec2, b: Vec2, t: number): Vec2   // a + (b − a)·t — do NOT clamp t
function damp(a: Vec2, b: Vec2, rate: number, dt: number): Vec2   // frame-rate-independent chase`,
    starter: `// You have add, sub and scale in scope.

// Start at a, walk fraction t of the way toward b.
// t = 0 → a, t = 1 → b, t = 0.5 → halfway. Leave t unclamped.
function lerp(a, b, t) {
  // your code here
}

// A lerp whose strength is corrected for this frame's dt, so a chase
// looks identical at 20, 60 or 144 fps:
//   lerp(a, b, 1 - Math.exp(-rate * dt))
function damp(a, b, rate, dt) {
  // your code here
}
`,
    solution: `function lerp(a, b, t) {
  return add(a, scale(sub(b, a), t));
}

function damp(a, b, rate, dt) {
  return lerp(a, b, 1 - Math.exp(-rate * dt));
}
`,
    exports: ['lerp', 'damp'],
    provides: ['add', 'sub', 'scale'],
    tests: [
      {
        name: 'lerp((0,0), (10,20), 0.5)',
        run: (f) => f.lerp(v(0, 0), v(10, 20), 0.5),
        expect: v(5, 10),
      },
      {
        name: 'lerp(a, b, 0) → a',
        run: (f) => f.lerp(v(2, 4), v(6, 8), 0),
        expect: v(2, 4),
      },
      {
        name: 'lerp(a, b, 1) → b',
        run: (f) => f.lerp(v(2, 4), v(6, 8), 1),
        expect: v(6, 8),
      },
      {
        name: 'lerp((2,4), (6,8), 0.25)',
        run: (f) => f.lerp(v(2, 4), v(6, 8), 0.25),
        expect: v(3, 5),
      },
      {
        name: 'lerp((0,0), (1,1), 2) — t is not clamped',
        run: (f) => f.lerp(v(0, 0), v(1, 1), 2),
        expect: v(2, 2),
        hint: 't past 1 extrapolates beyond b — sometimes that is exactly what you want, so lerp leaves clamping to the caller',
      },
      {
        name: 'damp((0,0), (10,0), rate 5, dt 0.2)',
        run: (f) => f.damp(v(0, 0), v(10, 0), 5, 0.2),
        expect: v(10 * (1 - Math.exp(-1)), 0),
        hint: 'damp(a, b, rate, dt) = lerp(a, b, 1 − e^(−rate·dt))',
      },
      {
        name: 'damp is frame-rate independent: 2 steps at 30 fps ≡ 4 steps at 60 fps',
        run: (f) => {
          let slow = v(0, 0)
          let fast = v(0, 0)
          const target = v(10, 0)
          for (let i = 0; i < 2; i++) slow = f.damp(slow, target, 5, 1 / 30)
          for (let i = 0; i < 4; i++) fast = f.damp(fast, target, 5, 1 / 60)
          return slow.x - fast.x
        },
        expect: 0,
        hint: 'a fixed lerp factor per frame takes bigger total bites at higher fps; the 1 − e^(−rate·dt) form takes the same total bite per second no matter how it is sliced',
      },
    ],
    codeVersion: 1,
  },

  {
    id: '01/vec3',
    title: 'Into the third dimension',
    signature: `// Vec3 = { x: number, y: number, z: number }
function add3(a: Vec3, b: Vec3): Vec3
function sub3(a: Vec3, b: Vec3): Vec3
function scale3(v: Vec3, s: number): Vec3
function length3(v: Vec3): number
function normalize3(v: Vec3): Vec3          // normalize3(0) → 0, same policy
function lerp3(a: Vec3, b: Vec3, t: number): Vec3
function distance3(a: Vec3, b: Vec3): number`,
    starter: `// Same recipes as 2D — one more component everywhere.

function add3(a, b) {
  // your code here
}

function sub3(a, b) {
  // your code here
}

function scale3(v, s) {
  // your code here
}

function length3(v) {
  // your code here
}

function normalize3(v) {
  // your code here
}

function lerp3(a, b, t) {
  // your code here
}

function distance3(a, b) {
  // your code here
}
`,
    solution: `function add3(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub3(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale3(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function length3(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize3(v) {
  const len = length3(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return scale3(v, 1 / len);
}

function lerp3(a, b, t) {
  return add3(a, scale3(sub3(b, a), t));
}

function distance3(a, b) {
  return length3(sub3(a, b));
}
`,
    exports: ['add3', 'sub3', 'scale3', 'length3', 'normalize3', 'lerp3', 'distance3'],
    tests: [
      {
        name: 'add3((1,2,3), (4,5,6))',
        run: (f) => f.add3(v3(1, 2, 3), v3(4, 5, 6)),
        expect: v3(5, 7, 9),
      },
      {
        name: 'sub3((5,7,9), (4,5,6))',
        run: (f) => f.sub3(v3(5, 7, 9), v3(4, 5, 6)),
        expect: v3(1, 2, 3),
        hint: 'still points at the first argument',
      },
      {
        name: 'scale3((1,-2,3), 2)',
        run: (f) => f.scale3(v3(1, -2, 3), 2),
        expect: v3(2, -4, 6),
      },
      {
        name: 'length3((2,3,6))',
        run: (f) => f.length3(v3(2, 3, 6)),
        expect: 7,
        hint: 'Pythagoras applied twice: √(x² + y² + z²)',
      },
      {
        name: 'length3((1,2,2))',
        run: (f) => f.length3(v3(1, 2, 2)),
        expect: 3,
      },
      {
        name: 'normalize3((0,3,4))',
        run: (f) => f.normalize3(v3(0, 3, 4)),
        expect: v3(0, 0.6, 0.8),
      },
      {
        name: 'lerp3((0,0,0), (10,-10,4), 0.5)',
        run: (f) => f.lerp3(v3(0, 0, 0), v3(10, -10, 4), 0.5),
        expect: v3(5, -5, 2),
      },
      {
        name: 'distance3((1,2,3), (3,5,9))',
        run: (f) => f.distance3(v3(1, 2, 3), v3(3, 5, 9)),
        expect: 7,
      },
      {
        name: 'normalize3((0,0,0)) — the NaN guard, again',
        run: (f) => f.normalize3(v3(0, 0, 0)),
        expect: v3(0, 0, 0),
        hint: 'same policy as 2D: the zero vector normalizes to itself, never to NaN',
      },
    ],
    codeVersion: 1,
  },

  {
    id: '01/capstone-fountain',
    title: 'Capstone: particle fountain',
    signature: `// Particle = { pos: Vec3, vel: Vec3, age: number }
function spawnParticle(speed: number): Particle    // at origin, random direction, |vel| = speed
function updateParticle(p: Particle, gravity: Vec3, dt: number): Particle   // semi-implicit Euler`,
    starter: `// You have add3, sub3, scale3, normalize3, lerp3 and length3 in scope.
// Math.random() gives a float in [0, 1).

// A new particle: pos at the origin, vel pointing in a RANDOM direction
// with length exactly \`speed\`, age 0.
function spawnParticle(speed) {
  // your code here
}

// One physics step. Semi-implicit Euler: update the velocity FIRST,
// then move the position using the NEW velocity, then age it.
// Return a brand-new particle — never mutate p.
function updateParticle(p, gravity, dt) {
  // your code here
}
`,
    solution: `function spawnParticle(speed) {
  // A random point in the [-1,1] cube, normalized into a direction.
  // normalize3 maps the (astronomically unlikely) all-zeros draw to
  // (0,0,0) — re-roll until we hold a real direction.
  let dir = { x: 0, y: 0, z: 0 };
  while (length3(dir) === 0) {
    dir = normalize3({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random() * 2 - 1,
    });
  }
  return { pos: { x: 0, y: 0, z: 0 }, vel: scale3(dir, speed), age: 0 };
}

function updateParticle(p, gravity, dt) {
  const vel = add3(p.vel, scale3(gravity, dt)); // velocity first…
  const pos = add3(p.pos, scale3(vel, dt));     // …then move with the NEW velocity
  return { pos: pos, vel: vel, age: p.age + dt };
}
`,
    exports: ['spawnParticle', 'updateParticle'],
    provides: ['add3', 'sub3', 'scale3', 'normalize3', 'lerp3', 'length3'],
    tests: [
      {
        name: 'one Euler step — velocity gains gravity·dt',
        run: (f) =>
          f.updateParticle(
            { pos: v3(0, 0, 0), vel: v3(3, 4, 0), age: 0 },
            v3(0, -10, 0),
            0.1,
          ).vel,
        expect: v3(3, 3, 0),
        hint: 'velocity first: vel′ = vel + gravity·dt — here (3,4,0) + (0,−10,0)·0.1 = (3,3,0)',
      },
      {
        name: 'one Euler step — position moves with the NEW velocity',
        run: (f) =>
          f.updateParticle(
            { pos: v3(0, 0, 0), vel: v3(3, 4, 0), age: 0 },
            v3(0, -10, 0),
            0.1,
          ).pos,
        expect: v3(0.3, 0.3, 0),
        hint: 'pos′ = pos + vel′·dt using the freshly updated velocity. If you got (0.3, 0.4, 0) you moved with the OLD velocity — that order is unstable in real simulations.',
      },
      {
        name: 'age accumulates',
        run: (f) =>
          f.updateParticle(
            { pos: v3(1, 1, 1), vel: v3(0, 0, 0), age: 0.5 },
            v3(0, -10, 0),
            0.25,
          ).age,
        expect: 0.75,
      },
      {
        name: 'updateParticle does not mutate the input',
        run: (f) => {
          const p = { pos: v3(1, 2, 3), vel: v3(4, 5, 6), age: 1 }
          f.updateParticle(p, v3(0, -10, 0), 0.1)
          return [p.pos.x, p.pos.y, p.pos.z, p.vel.x, p.vel.y, p.vel.z, p.age]
        },
        expect: [1, 2, 3, 4, 5, 6, 1],
        hint: 'build and return a new particle object — the caller still owns p',
      },
      {
        name: 'spawn: pos starts at the origin',
        run: (f) => f.spawnParticle(5).pos,
        expect: v3(0, 0, 0),
      },
      {
        name: 'spawn: age starts at 0',
        run: (f) => f.spawnParticle(5).age,
        expect: 0,
      },
      {
        name: 'spawn: |vel| equals the requested speed',
        run: (f, lib) => lib.length3(f.spawnParticle(7).vel),
        expect: 7,
        hint: 'pick a random direction, normalize3 it to length 1, then scale3 it by speed',
      },
      {
        name: 'spawn: direction varies between calls',
        run: (f) => {
          const first = f.spawnParticle(5).vel
          for (let i = 0; i < 8; i++) {
            const w = f.spawnParticle(5).vel
            if (
              Math.abs(w.x - first.x) > 1e-9 ||
              Math.abs(w.y - first.y) > 1e-9 ||
              Math.abs(w.z - first.z) > 1e-9
            ) {
              return true
            }
          }
          return false
        },
        expect: true,
        hint: 'use Math.random() in every component — without randomness all particles fly the same way and your fountain is a laser',
      },
    ],
    codeVersion: 1,
  },
]
