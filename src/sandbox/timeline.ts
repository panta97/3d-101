/**
 * The frame recorder — the sandbox's reason to exist.
 *
 * A normal widget runs the sim with whatever dt the browser hands it and
 * throws each frame away. Here the sim runs at a FIXED dt and every frame is
 * kept: state, the RNG state to resume from, the logs your code printed, the
 * debug geometry it drew, and anything it threw. So "step back one frame" is
 * a restore, not a rewind-by-guessing, and the numbers in the inspector are
 * the numbers your functions actually saw.
 *
 * Two rules make that work, and both are borrowed from the capstone itself:
 *   - scenes return new state instead of mutating it, so a snapshot is just
 *     a reference (`updateParticle` not mutating `p` is what makes this free);
 *   - randomness comes from a seeded generator whose state is one number.
 *
 * Editing code resets to frame 0 (different code, different world). Moving a
 * parameter slider keeps the past and discards the future from the cursor
 * onward — "changing gravity rewrites what happens next", which is exactly
 * the mental model you want.
 */

import type { Vec3 } from '@/math'
import type { UserFns } from '@/exercise/types'
import { formatValue } from '@/exercise/assert'
import { mulberry32, type Rng } from './rng'
import type { DbgCmd, LogEntry, Params, SandboxScene, StepApi } from './types'

/** Fixed simulation step. 60 Hz — the dt your updateParticle is handed. */
export const DT = 1 / 60

/** ~20 s of history at 60 Hz. Frames share particle objects, so this is cheap. */
export const MAX_FRAMES = 1200

/** Per-frame log flood guard: 200 particles × a console.log each adds up fast. */
const MAX_LOGS_PER_FRAME = 200

/** A single frame slower than this almost certainly means runaway learner code. */
const SLOW_FRAME_MS = 200

export interface Frame<S> {
  index: number
  /** Simulated time, seconds. Not wall-clock. */
  t: number
  state: S
  logs: LogEntry[]
  dbg: DbgCmd[]
  errors: string[]
  /** Wall-clock cost of simulating this frame, ms. */
  ms: number
  /** RNG state *after* this frame — restoring it resumes the exact sequence. */
  rngState: number
}

export class Timeline<S> {
  readonly scene: SandboxScene<S>
  frames: Frame<S>[] = []
  cursor = 0
  playing = false
  /** Playback rate multiplier; the sim dt never changes. */
  speed = 1
  params: Record<string, number>
  seed: number
  /** Set when learner code is slow enough to be a runaway; playback stops. */
  stalled: string | null = null

  private fns: UserFns | null = null
  private rng: Rng
  private live!: S
  private readonly api: StepApi
  /** Unspent real time carried between playback ticks. */
  private acc = 0

  // Buffers for the frame currently being simulated.
  private recIndex = 0
  private recLogs: LogEntry[] = []
  private recDbg: DbgCmd[] = []
  private recErrors: string[] = []

  constructor(scene: SandboxScene<S>, seed = 1) {
    this.scene = scene
    this.seed = seed
    this.rng = mulberry32(seed)
    this.params = Object.fromEntries(scene.params.map((p) => [p.key, p.value]))

    const push = (c: DbgCmd) => {
      if (this.recDbg.length < 500) this.recDbg.push(c)
    }
    const dbg = {
      point: (p: Vec3, color?: string, label?: string) => push({ kind: 'point', p, color, label }),
      arrow: (from: Vec3, to: Vec3, color?: string, label?: string) =>
        push({ kind: 'arrow', from, to, color, label }),
      line: (from: Vec3, to: Vec3, color?: string) => push({ kind: 'line', from, to, color }),
      label: (p: Vec3, text: string, color?: string) => push({ kind: 'label', p, text, color }),
    }
    // `frame` and `params` are getters so the scene always reads the value as
    // of the call, not a copy taken when this object was built.
    this.api = {
      get frame(): number {
        return timeline.recIndex
      },
      get params(): Params {
        return timeline.params
      },
      rng: () => this.rng.next(),
      dbg,
      error: (msg: string) => this.recordError(msg),
      safe: <T>(label: string, fn: () => T): T | undefined => {
        try {
          return fn()
        } catch (err) {
          this.recordError(`${label} threw: ${err instanceof Error ? err.message : String(err)}`)
          return undefined
        }
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the getters above need it
    const timeline = this

    this.reset()
  }

  /* ---- learner code ------------------------------------------------------ */

  /**
   * The scope injected into the learner's compiled code. `Math` and `console`
   * here SHADOW the globals inside their functions (see compile.ts): random is
   * seeded so replays match, and logs land on the frame that produced them.
   */
  codeScope(): Record<string, unknown> {
    const seededMath: Math = Object.create(Math)
    Object.defineProperty(seededMath, 'random', { value: () => this.rng.next() })

    const emit = (level: LogEntry['level']) => (...args: unknown[]) => {
      if (this.recLogs.length >= MAX_LOGS_PER_FRAME) return
      if (this.recLogs.length === MAX_LOGS_PER_FRAME - 1) {
        this.recLogs.push({
          frame: this.recIndex,
          level: 'warn',
          text: `… ${MAX_LOGS_PER_FRAME}+ logs this frame — output truncated`,
        })
        return
      }
      this.recLogs.push({
        frame: this.recIndex,
        level,
        text: args.map((a) => (typeof a === 'string' ? a : formatValue(a))).join(' '),
      })
    }

    return {
      Math: seededMath,
      console: { log: emit('log'), info: emit('log'), debug: emit('log'), warn: emit('warn'), error: emit('error') },
      dbg: this.api.dbg,
    }
  }

  /** Install new learner functions (or null to clear) and restart from frame 0. */
  setFns(fns: UserFns | null): void {
    this.fns = fns
    this.reset()
  }

  hasFns(): boolean {
    return this.fns !== null
  }

  /* ---- recording --------------------------------------------------------- */

  private recordError(msg: string): void {
    if (this.recErrors.length < 8 && !this.recErrors.includes(msg)) this.recErrors.push(msg)
  }

  private beginFrame(index: number): void {
    this.recIndex = index
    this.recLogs = []
    this.recDbg = []
    this.recErrors = []
  }

  private commit(index: number, state: S, ms: number): void {
    this.live = state
    this.frames.length = index // drop anything stale at/after this index
    this.frames.push({
      index,
      t: index * DT,
      state,
      logs: this.recLogs,
      dbg: this.recDbg,
      errors: this.recErrors,
      ms,
      rngState: this.rng.state,
    })
    this.cursor = index
  }

  reset(): void {
    this.rng = mulberry32(this.seed)
    this.stalled = null
    this.playing = false
    this.acc = 0
    this.frames = []
    this.cursor = 0
    this.beginFrame(0)
    const t0 = performance.now()
    const state = this.scene.init(this.api)
    this.commit(0, state, performance.now() - t0)
  }

  /** Simulate one new frame from the live state and append it. */
  private simulate(): void {
    const index = this.cursor + 1
    this.beginFrame(index)
    const t0 = performance.now()
    let next = this.live
    if (this.fns) {
      try {
        next = this.scene.step(this.live, this.fns, DT, this.api)
      } catch (err) {
        this.recordError(`scene step threw: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    const ms = performance.now() - t0
    this.commit(index, next, ms)

    if (ms > SLOW_FRAME_MS) {
      this.playing = false
      this.stalled = `frame ${index} took ${ms.toFixed(0)} ms — playback paused. Check for a runaway loop in your code.`
    }
  }

  /* ---- transport --------------------------------------------------------- */

  get last(): number {
    return this.frames.length - 1
  }

  get current(): Frame<S> {
    return this.frames[this.cursor]
  }

  get atCap(): boolean {
    return this.frames.length >= MAX_FRAMES
  }

  /** Restore a recorded frame — state *and* the RNG stream resume exactly. */
  seek(index: number): void {
    const i = Math.max(0, Math.min(this.last, Math.round(index)))
    this.cursor = i
    this.live = this.frames[i].state
    this.rng.state = this.frames[i].rngState
  }

  /** Advance one frame: replay the next recorded one, or simulate a fresh one. */
  stepForward(): void {
    if (this.cursor < this.last) {
      this.seek(this.cursor + 1)
    } else if (!this.atCap) {
      this.simulate()
    } else {
      this.playing = false
    }
  }

  stepBack(): void {
    if (this.cursor > 0) this.seek(this.cursor - 1)
  }

  /**
   * A parameter changed: keep everything up to the cursor, discard the future.
   * The next step re-simulates from here under the new value.
   */
  setParam(key: string, value: number): void {
    this.params[key] = value
    this.frames.length = this.cursor + 1
  }

  /**
   * Drive playback from a real-time delta. Returns true if the cursor moved.
   *
   * The leftover time must CARRY between calls: a display refresh (16.67 ms)
   * and the sim step (16.67 ms) are nominally equal, so a delta that lands a
   * hair short would otherwise be discarded every single frame and the sim
   * would crawl. Accumulate, then spend whole steps.
   */
  advance(realDt: number): boolean {
    if (!this.playing) return false
    const before = this.cursor
    // Cap the backlog so a backgrounded tab doesn't stampede the sim on return.
    this.acc = Math.min(this.acc + realDt * this.speed, DT * 4)
    while (this.acc >= DT && this.playing) {
      this.stepForward()
      this.acc -= DT
    }
    return this.cursor !== before
  }

  /** Positions of one entity across the recent past, for the trail. */
  trail(id: string | null, span = 150): Vec3[] {
    if (!id) return []
    const out: Vec3[] = []
    for (let i = Math.max(0, this.cursor - span); i <= this.cursor; i++) {
      const p = this.scene.entityPos(this.frames[i].state, id)
      if (p) out.push(p)
    }
    return out
  }
}
