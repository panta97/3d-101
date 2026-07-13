/**
 * Sandbox scene contract.
 *
 * A scene is a deterministic simulation driven by the learner's compiled
 * exercise functions. The engine (timeline.ts) owns time: it steps the scene
 * at a fixed dt, snapshots the state after every step, and can restore any
 * recorded frame. That is what makes frame-by-frame scrubbing honest rather
 * than a re-guess — so scene state must be a *value*: never mutate the state
 * you were handed, always return a new one. (The same rule the capstone
 * teaches about particles, applied one level up.)
 */

import type { Vec3 } from '@/math'
import type { UserFns } from '@/exercise/types'
import { Camera3D } from '@/widgets'

export interface ParamSpec {
  key: string
  label: string
  min: number
  max: number
  step?: number
  value: number
  format?: (v: number) => string
}

export type Params = Readonly<Record<string, number>>

export type LogLevel = 'log' | 'warn' | 'error'

export interface LogEntry {
  frame: number
  level: LogLevel
  text: string
}

/** Debug geometry a scene — or the learner's own code, via `dbg` — draws for one frame. */
export type DbgCmd =
  | { kind: 'point'; p: Vec3; color?: string; label?: string }
  | { kind: 'arrow'; from: Vec3; to: Vec3; color?: string; label?: string }
  | { kind: 'line'; from: Vec3; to: Vec3; color?: string }
  | { kind: 'label'; p: Vec3; text: string; color?: string }

export interface Dbg {
  point(p: Vec3, color?: string, label?: string): void
  arrow(from: Vec3, to: Vec3, color?: string, label?: string): void
  line(from: Vec3, to: Vec3, color?: string): void
  label(p: Vec3, text: string, color?: string): void
}

/** Everything a scene's `init`/`step` may touch. No globals, no wall clock. */
export interface StepApi {
  /** Index of the frame being simulated. */
  readonly frame: number
  readonly params: Params
  /** Seeded PRNG — the same one backing the learner's `Math.random()`. */
  rng(): number
  dbg: Dbg
  /**
   * Call learner code. Catches throws, records them on the frame, and returns
   * undefined — one bad frame must never kill the timeline.
   */
  safe<T>(label: string, fn: () => T): T | undefined
  /** Record a problem on this frame — e.g. learner code returned the wrong shape. */
  error(msg: string): void
}

/** One row of the inspector's value table. */
export interface Field {
  label: string
  value: string
  /** CSS color for the value (used to flag suspicious numbers). */
  color?: string
}

/** A selectable, inspectable thing in the scene. */
export interface SceneEntity {
  id: string
  label: string
  pos: Vec3
  fields: Field[]
}

/**
 * One line of the math trace: the reference arithmetic for this frame, next
 * to what the learner's code actually returned.
 */
export interface TraceLine {
  label: string
  /** The formula with this frame's real numbers substituted in. */
  expr: string
  /** What the reference math predicts. */
  expect: string
  /** What the learner's function returned; omitted when there's nothing to compare. */
  got?: string
  ok?: boolean
  note?: string
}

export interface DrawView {
  params: Params
  selectedId: string | null
  /** Recorded positions of the selected entity over the last N frames. */
  trail: Vec3[]
}

export interface SandboxScene<S = unknown> {
  id: string
  title: string
  blurb: string
  /** Exercise whose functions drive this scene. */
  exerciseId: string
  params: ParamSpec[]
  makeCamera(): Camera3D
  /** Initial state. Called on reset, before any learner code runs. */
  init(api: StepApi): S
  /** Advance one fixed tick. Must not mutate `state`. */
  step(state: S, fns: UserFns, dt: number, api: StepApi): S
  draw(
    ctx: CanvasRenderingContext2D,
    cam: Camera3D,
    size: { width: number; height: number },
    state: S,
    view: DrawView,
  ): void
  /** Everything selectable this frame, for the inspector table and click-picking. */
  entities(state: S): SceneEntity[]
  /** Cheap single-entity lookup — called once per recorded frame to build trails. */
  entityPos(state: S, id: string): Vec3 | null
  /** Frame-level readouts (particle count, spawns, deaths…). */
  summary(state: S, prev: S | null): Field[]
  /** The teaching payoff: reference arithmetic vs. what the learner's code returned. */
  trace?(prev: S, next: S, id: string, dt: number, params: Params): TraceLine[]
  /** Shown over the viewport when no learner code is loaded. */
  emptyHint: string
}
