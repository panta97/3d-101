/**
 * TypeScript declarations for the functions an exercise injects into the
 * learner's scope — fed to Monaco as an "extra lib" so `add3(` pops its real
 * signature and ⌃-space completes only what is actually in scope.
 *
 * This is the whole reason a heavyweight editor earns its bytes here. The
 * course hands these functions to learner code by destructuring them out of
 * `lib` inside a `new Function(...)` wrapper (see exercise/compile.ts), which
 * means no editor can infer them: as far as the source text is concerned they
 * are undeclared globals. Declaring them explicitly turns "what order do the
 * arguments go in again?" into a hover.
 *
 * Only names in the spec's `provides` are emitted. An exercise that hasn't
 * been given `cross` should not autocomplete `cross` — the gap is the lesson.
 */

/** name → ambient declaration, with the doc comment Monaco shows on hover. */
const SIGNATURES: Record<string, string> = {
  // vec2
  vec2: '/** Make a 2D vector. */\ndeclare function vec2(x: number, y: number): Vec2;',
  add: '/** a + b, componentwise. Returns a new vector. */\ndeclare function add(a: Vec2, b: Vec2): Vec2;',
  sub: '/** a − b: the arrow pointing from b to a. */\ndeclare function sub(a: Vec2, b: Vec2): Vec2;',
  neg: '/** −v. */\ndeclare function neg(v: Vec2): Vec2;',
  scale: '/** v · s — stretch a vector without turning it. */\ndeclare function scale(v: Vec2, s: number): Vec2;',
  length: '/** ‖v‖ = √(x² + y²). */\ndeclare function length(v: Vec2): number;',
  lengthSq: '/** ‖v‖² — no square root; use it when comparing lengths. */\ndeclare function lengthSq(v: Vec2): number;',
  distance: '/** ‖a − b‖. */\ndeclare function distance(a: Vec2, b: Vec2): number;',
  distanceSq: '/** ‖a − b‖², no square root. */\ndeclare function distanceSq(a: Vec2, b: Vec2): number;',
  normalize: '/** v scaled to length 1. The zero vector maps to zero, never NaN. */\ndeclare function normalize(v: Vec2): Vec2;',
  lerp: '/** Straight-line blend; t is NOT clamped. */\ndeclare function lerp(a: Vec2, b: Vec2, t: number): Vec2;',
  damp: '/** Frame-rate-independent lerp toward b. */\ndeclare function damp(a: Vec2, b: Vec2, rate: number, dt: number): Vec2;',
  dot: '/** a · b — how much of a points along b. */\ndeclare function dot(a: Vec2, b: Vec2): number;',
  cross2: '/** The scalar 2D cross product: sign tells you which side b is on. */\ndeclare function cross2(a: Vec2, b: Vec2): number;',

  // vec3 — the '3' suffix is the course-wide convention for the 3D twins.
  vec3: '/** Make a 3D vector. */\ndeclare function vec3(x: number, y: number, z: number): Vec3;',
  add3: '/** a + b, componentwise. Returns a NEW vector — inputs are never mutated. */\ndeclare function add3(a: Vec3, b: Vec3): Vec3;',
  sub3: '/** a − b: the arrow pointing from b to a. */\ndeclare function sub3(a: Vec3, b: Vec3): Vec3;',
  neg3: '/** −v. */\ndeclare function neg3(v: Vec3): Vec3;',
  scale3: '/** v · s — stretch a vector without turning it. */\ndeclare function scale3(v: Vec3, s: number): Vec3;',
  length3: '/** ‖v‖ = √(x² + y² + z²). */\ndeclare function length3(v: Vec3): number;',
  lengthSq3: '/** ‖v‖², no square root. */\ndeclare function lengthSq3(v: Vec3): number;',
  distance3: '/** ‖a − b‖. */\ndeclare function distance3(a: Vec3, b: Vec3): number;',
  distanceSq3: '/** ‖a − b‖², no square root. */\ndeclare function distanceSq3(a: Vec3, b: Vec3): number;',
  normalize3:
    '/** v scaled to length 1 — a pure direction. The zero vector maps to zero, never NaN. */\ndeclare function normalize3(v: Vec3): Vec3;',
  lerp3: '/** Straight-line blend from a to b; t is NOT clamped. */\ndeclare function lerp3(a: Vec3, b: Vec3, t: number): Vec3;',
  damp3: '/** Frame-rate-independent lerp toward b. */\ndeclare function damp3(a: Vec3, b: Vec3, rate: number, dt: number): Vec3;',
  dot3: '/** a · b — how much of a points along b. */\ndeclare function dot3(a: Vec3, b: Vec3): number;',
  cross: '/** The only vector perpendicular to both a and b. Right-handed: cross(x̂, ŷ) = ẑ. */\ndeclare function cross(a: Vec3, b: Vec3): Vec3;',
  project3v: '/** The part of a that lies along b. */\ndeclare function project3v(a: Vec3, b: Vec3): Vec3;',
  reject3: '/** The part of a that does NOT lie along b. */\ndeclare function reject3(a: Vec3, b: Vec3): Vec3;',
  angleBetween3: '/** Angle between a and b, in radians. */\ndeclare function angleBetween3(a: Vec3, b: Vec3): number;',
  reflect3: '/** Bounce v off a surface with unit normal n. */\ndeclare function reflect3(v: Vec3, n: Vec3): Vec3;',
}

/** Types and sandbox-only globals — always in scope, whatever the exercise. */
const PRELUDE = `
interface Vec2 { x: number; y: number }
interface Vec3 { x: number; y: number; z: number }

/** A particle: where it is, where it's going, and how long it has lived. */
interface Particle { pos: Vec3; vel: Vec3; age: number }

/** Draw into the 3D scene from your own code. Recorded per frame, so it scrubs with the timeline. */
declare const dbg: {
  point(p: Vec3, color?: string, label?: string): void
  arrow(from: Vec3, to: Vec3, color?: string, label?: string): void
  line(from: Vec3, to: Vec3, color?: string): void
  label(p: Vec3, text: string, color?: string): void
}
`

/**
 * An ambient .d.ts for one exercise's scope. Ambient means no import/export —
 * a single import statement would turn the file into a module and every
 * declaration in it would stop being global.
 */
export function libDeclarations(provides: readonly string[] = []): string {
  const fns = provides
    .map((name) => SIGNATURES[name] ?? `declare function ${name}(...args: any[]): any;`)
    .join('\n\n')

  return `${PRELUDE}
/* ---- in scope for this exercise ---- */

${fns}

/**
 * NOTE: inside the sandbox, Math.random() is a SEEDED generator. That is what
 * lets the timeline replay a run frame-for-frame instead of re-rolling a new
 * fountain every time you scrub.
 */
`
}
