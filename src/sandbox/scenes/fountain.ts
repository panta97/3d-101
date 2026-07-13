/**
 * Module 1 capstone — the particle fountain, made steppable.
 *
 * Same simulation as the fountain widget on the module page, but every frame
 * is recorded, so you can stop on frame 137 and read the exact `pos`, `vel`
 * and `age` your `updateParticle` was handed and what it gave back.
 *
 * The payoff is `trace()`: for the selected particle it recomputes the frame
 * with the reference math and shows that arithmetic beside your result. If
 * you moved with the OLD velocity instead of the new one, you don't get a red
 * test row — you get pos′ = pos + vel·dt sitting next to pos′ = pos + vel′·dt
 * with the two numbers differing in the third decimal.
 */

import type { Vec3 } from '@/math'
import { v3 } from '@/math'
import type { UserFns } from '@/exercise/types'
import { Camera3D, COLORS, draw } from '@/widgets'
import type { Field, Params, SandboxScene, SceneEntity, StepApi, TraceLine } from '../types'

interface Particle {
  pos: Vec3
  vel: Vec3
  age: number
}

/** A particle plus the bookkeeping the sandbox needs to track it across frames. */
interface Tracked {
  id: string
  /** Frame it was spawned on. */
  born: number
  p: Particle
}

export interface FountainState {
  pool: Tracked[]
  nextId: number
  /** Fractional spawn carry, so a rate of 37/s doesn't quantize to 60/s. */
  spawnAcc: number
  spawned: number
  died: number
}

const MAX_PARTICLES = 220
const ORANGE = v3.vec3(230, 160, 60)
const GRAY = v3.vec3(110, 115, 125)

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const isVec3 = (v: unknown): v is Vec3 => {
  if (typeof v !== 'object' || v === null) return false
  const q = v as Vec3
  return isNum(q.x) && isNum(q.y) && isNum(q.z)
}
const isParticle = (p: unknown): p is Particle => {
  if (typeof p !== 'object' || p === null) return false
  const q = p as Particle
  return isVec3(q.pos) && isVec3(q.vel) && isNum(q.age)
}

const f2 = (n: number) => n.toFixed(2)
const f3 = (n: number) => n.toFixed(3)
const vs = (v: Vec3, f = f3) => `(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`

const rgb = (c: Vec3) => `rgb(${Math.round(c.x)}, ${Math.round(c.y)}, ${Math.round(c.z)})`

/** Age → the orange-to-gray fade, via the lerp3 the module just taught. */
const ageColor = (age: number, lifetime: number) =>
  rgb(v3.lerp(ORANGE, GRAY, Math.min(1, Math.max(0, age / lifetime))))

export const fountain: SandboxScene<FountainState> = {
  id: 'm01-fountain',
  title: 'M1 capstone — particle fountain',
  blurb:
    'Every particle is your spawnParticle() and your updateParticle(), stepped at a fixed 60 Hz and recorded frame by frame.',
  exerciseId: '01/capstone-fountain',
  emptyHint: 'press Run (⌘⏎) to compile your code and start the fountain',

  params: [
    { key: 'rate', label: 'spawn rate', min: 0, max: 150, step: 1, value: 45, format: (v) => `${v.toFixed(0)}/s` },
    { key: 'gravity', label: 'gravity', min: 0, max: 25, step: 0.1, value: 9.8, format: f2 },
    { key: 'speed', label: 'speed', min: 0, max: 14, step: 0.1, value: 7, format: f2 },
    { key: 'lifetime', label: 'lifetime', min: 0.5, max: 6, step: 0.1, value: 2.4, format: (v) => `${f2(v)} s` },
  ],

  // Framed for the sandbox's wide, short viewport: focal is a multiple of the
  // canvas HEIGHT, so a short pane needs a closer camera to fill the frame.
  makeCamera: () => new Camera3D({ yaw: 0.7, pitch: 0.28, dist: 12, target: v3.vec3(0, 2.2, 0) }),

  init: (): FountainState => ({ pool: [], nextId: 1, spawnAcc: 0, spawned: 0, died: 0 }),

  step(state, fns: UserFns, dt, api: StepApi) {
    const { gravity, speed, rate, lifetime } = api.params
    const g = v3.vec3(0, -gravity, 0)

    // 1. Advance everything alive. `updateParticle` must return a NEW particle,
    //    which is also why the old one stays valid in the previous frame's snapshot.
    const pool: Tracked[] = []
    let died = 0
    for (const it of state.pool) {
      const r = api.safe('updateParticle', () => fns.updateParticle(it.p, g, dt))
      if (r === undefined) {
        died++
        continue
      }
      if (!isParticle(r)) {
        api.error('updateParticle must return { pos: Vec3, vel: Vec3, age: number }')
        died++
        continue
      }
      if (r.pos.y < 0 || r.age > lifetime) {
        died++
        continue
      }
      pool.push({ id: it.id, born: it.born, p: r })
    }

    // 2. Spawn this frame's new particles.
    let spawnAcc = state.spawnAcc + rate * dt
    let nextId = state.nextId
    let spawned = 0
    while (spawnAcc >= 1) {
      spawnAcc -= 1
      if (pool.length >= MAX_PARTICLES) continue
      const s = api.safe('spawnParticle', () => fns.spawnParticle(speed))
      if (s === undefined) {
        spawnAcc = 0
        break
      }
      if (!isParticle(s)) {
        api.error('spawnParticle must return { pos: Vec3, vel: Vec3, age: number }')
        spawnAcc = 0
        break
      }
      pool.push({ id: `p${nextId++}`, born: api.frame, p: s })
      spawned++
    }

    return { pool, nextId, spawnAcc, spawned, died }
  },

  entities(state): SceneEntity[] {
    return state.pool.map(({ id, p }) => ({
      id,
      label: id,
      pos: p.pos,
      fields: [
        { label: 'pos', value: vs(p.pos) },
        { label: 'vel', value: vs(p.vel) },
        { label: '|vel|', value: f3(v3.length(p.vel)) },
        { label: 'age', value: `${f3(p.age)} s` },
      ],
    }))
  },

  entityPos(state, id) {
    return state.pool.find((t) => t.id === id)?.p.pos ?? null
  },

  summary(state, prev): Field[] {
    const speeds = state.pool.map((t) => v3.length(t.p.vel))
    const peak = state.pool.reduce((m, t) => Math.max(m, t.p.pos.y), 0)
    return [
      { label: 'alive', value: String(state.pool.length) },
      { label: 'spawned', value: `+${state.spawned}`, color: state.spawned ? COLORS.green : undefined },
      { label: 'died', value: `−${state.died}`, color: state.died ? COLORS.red : undefined },
      { label: 'peak y', value: f2(peak) },
      {
        label: 'mean |vel|',
        value: speeds.length ? f2(speeds.reduce((a, b) => a + b, 0) / speeds.length) : '—',
      },
      { label: 'Δ alive', value: prev ? `${state.pool.length - prev.pool.length >= 0 ? '+' : ''}${state.pool.length - prev.pool.length}` : '—' },
    ]
  },

  /**
   * Reference semi-implicit Euler for this one particle on this one frame,
   * next to what the learner's function actually returned.
   */
  trace(prev, next, id, dt, params: Params): TraceLine[] {
    const before = prev.pool.find((t) => t.id === id)
    const after = next.pool.find((t) => t.id === id)
    const g = v3.vec3(0, -params.gravity, 0)

    // Spawned on this very frame — there is no previous state to step from.
    if (!before && after) {
      const got = v3.length(after.p.vel)
      return [
        {
          label: 'spawn',
          expr: 'pos = (0, 0, 0), age = 0',
          expect: `${vs(after.p.pos)}, ${f3(after.p.age)}`,
          got: `${vs(after.p.pos)}, ${f3(after.p.age)}`,
          ok: v3.length(after.p.pos) < 1e-9 && Math.abs(after.p.age) < 1e-9,
          note: 'a new particle starts at the origin with age 0',
        },
        {
          label: '|vel|',
          expr: `normalize3(dir) · speed  →  |vel| should equal ${f3(params.speed)}`,
          expect: f3(params.speed),
          got: f3(got),
          ok: Math.abs(got - params.speed) < 1e-6,
          note: 'normalize3 first, THEN scale3 by speed — a raw random vector is the wrong length',
        },
      ]
    }

    if (before && !after) {
      const p = before.p
      const wouldVel = v3.add(p.vel, v3.scale(g, dt))
      const wouldPos = v3.add(p.pos, v3.scale(wouldVel, dt))
      return [
        {
          label: 'died',
          expr: wouldPos.y < 0 ? 'pos.y < 0 — hit the floor' : `age > lifetime (${f2(params.lifetime)} s)`,
          expect: '—',
          note: 'the scene retires it here; your updateParticle is not called for it again',
        },
      ]
    }

    if (!before || !after) return []

    const p = before.p
    const q = after.p
    const gdt = v3.scale(g, dt)
    const expVel = v3.add(p.vel, gdt)
    const expPos = v3.add(p.pos, v3.scale(expVel, dt))
    const expAge = p.age + dt

    const near = (a: Vec3, b: Vec3) => v3.distance(a, b) < 1e-6
    // The classic capstone bug: moving with the OLD velocity (explicit Euler).
    const oldVelPos = v3.add(p.pos, v3.scale(p.vel, dt))
    const usedOldVel = !near(q.pos, expPos) && near(q.pos, oldVelPos)

    return [
      {
        label: 'g·dt',
        expr: `${vs(g)} · ${f3(dt)}`,
        expect: vs(gdt),
        note: 'the velocity change this frame — gravity is an acceleration, so it acts on vel, not pos',
      },
      {
        label: "vel′",
        expr: `vel + g·dt = ${vs(p.vel)} + ${vs(gdt)}`,
        expect: vs(expVel),
        got: vs(q.vel),
        ok: near(q.vel, expVel),
      },
      {
        label: "pos′",
        expr: `pos + vel′·dt = ${vs(p.pos)} + ${vs(expVel)}·${f3(dt)}`,
        expect: vs(expPos),
        got: vs(q.pos),
        ok: near(q.pos, expPos),
        note: usedOldVel
          ? 'you moved with the OLD velocity — that is explicit Euler. Update vel first, then move with vel′.'
          : undefined,
      },
      {
        label: "age′",
        expr: `age + dt = ${f3(p.age)} + ${f3(dt)}`,
        expect: f3(expAge),
        got: f3(q.age),
        ok: Math.abs(q.age - expAge) < 1e-6,
      },
    ]
  },

  draw(ctx, cam, size, state, view) {
    const lifetime = view.params.lifetime
    draw.grid3(ctx, cam, size, { extent: 6 })
    draw.axes3(ctx, cam, size, 1.5)

    // The path the selected particle has actually taken, straight from history.
    if (view.trail.length > 1) {
      ctx.save()
      ctx.strokeStyle = COLORS.yellow
      ctx.globalAlpha = 0.55
      ctx.lineWidth = 1.5
      ctx.beginPath()
      let started = false
      for (const p of view.trail) {
        const s = cam.project3(p, size)
        if (!s) {
          started = false
          continue
        }
        if (started) ctx.lineTo(s.x, s.y)
        else ctx.moveTo(s.x, s.y)
        started = true
      }
      ctx.stroke()
      ctx.restore()
    }

    // Painter's algorithm: far particles first, so near ones land on top.
    const items = state.pool
      .map((t) => ({ t, pr: cam.project3(t.p.pos, size) }))
      .filter((i): i is { t: Tracked; pr: NonNullable<typeof i.pr> } => i.pr !== null)
    items.sort((a, b) => b.pr.depth - a.pr.depth)

    ctx.save()
    for (const { t, pr } of items) {
      const selected = t.id === view.selectedId
      const r = Math.max(1.5, 0.07 * pr.scale)
      ctx.fillStyle = selected ? COLORS.yellow : ageColor(t.p.age, lifetime)
      ctx.beginPath()
      ctx.arc(pr.x, pr.y, selected ? r * 1.8 : r, 0, Math.PI * 2)
      ctx.fill()
      if (selected) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(pr.x, pr.y, r * 1.8 + 4, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    ctx.restore()

    // The selected particle's velocity, drawn where it acts.
    const sel = view.selectedId ? state.pool.find((t) => t.id === view.selectedId) : undefined
    if (sel) {
      const tip = v3.add(sel.p.pos, v3.scale(sel.p.vel, 0.18))
      draw.arrow3(ctx, cam, size, sel.p.pos, tip, {
        color: COLORS.cyan,
        width: 2,
        label: `vel ${f2(v3.length(sel.p.vel))}`,
      })
      // Drop line to the ground plane — makes the height readable in 3D.
      draw.line3(ctx, cam, size, sel.p.pos, v3.vec3(sel.p.pos.x, 0, sel.p.pos.z), {
        color: COLORS.ghost,
        width: 1,
        dash: [3, 3],
      })
    }

    draw.point3(ctx, cam, size, v3.vec3(0, 0, 0), { color: COLORS.dim, r: 0.05 })
  },
}
