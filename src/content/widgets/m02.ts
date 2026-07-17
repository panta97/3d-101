/**
 * Module 2 widgets — Dot, Cross, and Planes.
 *
 * House style (see m01.ts): factories receive the mount container and return
 * { setUserFns } when driven by an exercise; learner return values are NEVER
 * trusted (isVec2/isVec3/isFiniteNumber guards); every widget renders a
 * sensible, self-explaining state before any learner code exists.
 */

import { v2, v3, pl, type Vec2, type Vec3, type Plane } from '@/math'
import {
  CanvasWidget,
  Viewport2D,
  Camera3D,
  worldHandle,
  draw,
  COLORS,
  MONO_FONT,
  controlsBar,
  hud,
  widgetNote,
} from '@/widgets'
import type { UserFns } from '@/exercise/types'
import type { WidgetFactory } from '@/site/mount'
import { isVec2, isVec3, isFiniteNumber } from './util'

const TAU = Math.PI * 2
const DEG = Math.PI / 180

/** Deterministic pseudo-random stream (LCG) so scattered layouts are stable. */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/* ------------------------------------------------------------------------ */
/* 2.1 dot-meter (drives: 02/dot)                                            */
/* ------------------------------------------------------------------------ */

const dotMeter: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let a = v2.vec2(3.2, 1.1)
  let b = v2.vec2(1.2, 2.6)

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 340,
    draw(ctx, w) {
      const refDot = v2.dot(a, b)
      const raw: unknown = userFns ? userFns.dot(a, b) : null
      const shown = isFiniteNumber(raw) ? raw : refDot

      // Sign wash: green = agreement, red = opposition, faded by |cosine|.
      const denom = v2.length(a) * v2.length(b)
      const cos = denom > 1e-9 ? Math.max(-1, Math.min(1, shown / denom)) : 0
      if (Math.abs(cos) > 0.02) {
        ctx.fillStyle =
          cos > 0
            ? `rgba(152, 195, 121, ${(0.13 * cos).toFixed(3)})`
            : `rgba(224, 108, 117, ${(-0.13 * cos).toFixed(3)})`
        ctx.fillRect(0, 0, w.width, w.height)
      }

      draw.grid2(ctx, vp, w)

      // b's line, and a's shadow on it (reference project — a 2.2 preview).
      const bHat = v2.normalize(b)
      if (v2.lengthSq(bHat) > 0) {
        draw.line2(ctx, vp, v2.scale(bHat, -20), v2.scale(bHat, 20), {
          color: COLORS.grid,
          width: 1,
          dash: [5, 5],
        })
      }
      const shadow = v2.project(a, b)
      draw.line2(ctx, vp, a, shadow, { color: COLORS.ghost, width: 1, dash: [4, 4] })
      draw.line2(ctx, vp, v2.vec2(0, 0), shadow, { color: COLORS.ghost, width: 4 })
      draw.point2(ctx, vp, shadow, { color: COLORS.ghost, r: 3.5, label: 'shadow' })

      const angle = v2.angleBetween(a, b)
      draw.angleArc2(ctx, vp, v2.vec2(0, 0), a, b, {
        radiusPx: 34,
        label: `${Math.round(angle / DEG)}°`,
      })

      // Perpendicular flash: within ~2° of a right angle.
      if (Math.abs(angle - Math.PI / 2) < 2 * DEG) {
        const aHat = v2.normalize(a)
        const s = 0.55
        const p1 = vp.toScreen(v2.scale(aHat, s))
        const p2 = vp.toScreen(v2.add(v2.scale(aHat, s), v2.scale(bHat, s)))
        const p3 = vp.toScreen(v2.scale(bHat, s))
        ctx.save()
        ctx.strokeStyle = COLORS.cyan
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.lineTo(p3.x, p3.y)
        ctx.stroke()
        ctx.restore()
        draw.drawLabel(ctx, 'perpendicular — dot = 0', v2.vec2(p2.x + 10, p2.y), COLORS.cyan)
      }

      draw.arrow2(ctx, vp, v2.vec2(0, 0), a, { color: COLORS.accent, label: 'a' })
      draw.arrow2(ctx, vp, v2.vec2(0, 0), b, { color: COLORS.green, label: 'b' })

      const fmt = (p: Vec2) => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`
      let status: string
      if (!userFns) status = `dot(a, b) = ${refDot.toFixed(2)} (reference) — solve below to take over`
      else if (isFiniteNumber(raw)) status = `your dot(a, b) = ${raw.toFixed(2)}`
      else status = 'your dot returned something that is not a number'
      setHud(`a = ${fmt(a)}   b = ${fmt(b)}   θ = ${Math.round(angle / DEG)}°\n${status}`)
    },
  })

  const vp = new Viewport2D(widget, { unitsHigh: 9 })
  const setHud = hud(container)

  widget.handles.push(
    worldHandle(vp, () => a, (p) => (a = p)),
    worldHandle(vp, () => b, (p) => (b = p)),
  )

  widgetNote(
    container,
    'Drag either arrowhead. Green wash = agreement, red = opposition; the dashed drop is a’s shadow on b’s line — that’s Section 2.2 sneaking in early.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/** Small square marking the right angle at `corner`, opening toward p1 and p2. */
function rightAngle(
  ctx: CanvasRenderingContext2D,
  vp: Viewport2D,
  corner: Vec2,
  p1: Vec2,
  p2: Vec2,
  size = 0.3,
): void {
  const u = v2.normalize(v2.sub(p1, corner))
  const w = v2.normalize(v2.sub(p2, corner))
  if (v2.lengthSq(u) < 1e-9 || v2.lengthSq(w) < 1e-9) return
  const c1 = v2.add(corner, v2.scale(u, size))
  const c2 = v2.add(corner, v2.add(v2.scale(u, size), v2.scale(w, size)))
  const c3 = v2.add(corner, v2.scale(w, size))
  draw.line2(ctx, vp, c1, c2, { color: COLORS.dim, width: 1 })
  draw.line2(ctx, vp, c2, c3, { color: COLORS.dim, width: 1 })
}

/* ------------------------------------------------------------------------ */
/* 2.2 axis-reader (explanatory — no exercise drives it)                     */
/* ------------------------------------------------------------------------ */

const axisReader: WidgetFactory = (container) => {
  let a = v2.vec2(4, 3)
  let theta = 15 * DEG
  let angleSlider: { get(): number; set(v: number): void } | null = null

  const bHatOf = () => v2.vec2(Math.cos(theta), Math.sin(theta))

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 360,
    draw(ctx, w) {
      const bHat = bHatOf()
      const coord = v2.dot(a, bHat) // the measurement
      const p = v2.scale(bHat, coord) // measure, then rebuild
      const armColor = coord >= 0 ? COLORS.green : COLORS.red

      draw.grid2(ctx, vp, w)

      // b̂'s line runs both ways, so a negative coordinate has somewhere to land.
      draw.line2(ctx, vp, v2.scale(bHat, -20), v2.scale(bHat, 20), {
        color: COLORS.grid,
        width: 1,
        dash: [5, 5],
      })

      // The perpendicular drop — a's shadow onto b̂'s line.
      draw.line2(ctx, vp, a, p, { color: COLORS.ghost, width: 1, dash: [4, 4] })
      rightAngle(ctx, vp, p, v2.vec2(0, 0), a)

      draw.arrow2(ctx, vp, v2.vec2(0, 0), p, { color: armColor, width: 4 })
      draw.arrow2(ctx, vp, v2.vec2(0, 0), bHat, { color: COLORS.yellow, width: 3 })
      draw.arrow2(ctx, vp, v2.vec2(0, 0), a, { color: COLORS.accent, label: 'a' })

      const sp = vp.toScreen(p)
      draw.drawLabel(ctx, `a · b̂ = ${coord.toFixed(2)}`, v2.vec2(sp.x + 10, sp.y + 18), armColor)
      const sb = vp.toScreen(bHat)
      draw.drawLabel(ctx, 'b̂', v2.vec2(sb.x + 8, sb.y + 12), COLORS.yellow)

      const ang = v2.angleBetween(a, bHat)
      draw.angleArc2(ctx, vp, v2.vec2(0, 0), bHat, a, {
        radiusPx: 42,
        label: `${Math.round(ang / DEG)}°`,
      })

      const fmt = (q: Vec2) => `(${q.x.toFixed(2)}, ${q.y.toFixed(2)})`
      const verdict =
        coord >= 0
          ? 'positive — the shadow lands ahead of the origin'
          : 'negative — past 90°, the shadow lands behind the origin'
      setHud(
        `a = ${fmt(a)}   b̂ = ${fmt(bHat)}   θ = ${Math.round(ang / DEG)}°\n` +
          `a · b̂ = ${coord.toFixed(2)}   ${verdict}`,
      )
    },
  })

  // Centred on the action, not the origin: a lives up and to the right.
  const vp = new Viewport2D(widget, { center: v2.vec2(1.2, 0.8), unitsHigh: 8 })
  const setHud = hud(container)

  widget.handles.push(
    worldHandle(vp, () => a, (p) => (a = p)),
    worldHandle(vp, bHatOf, (p) => {
      if (v2.lengthSq(p) < 1e-6) return // dead centre has no direction to read
      theta = Math.atan2(p.y, p.x)
      const deg = ((theta / DEG) % 360 + 360) % 360
      angleSlider?.set(Math.round(deg))
    }),
  )

  const bar = controlsBar(container)
  angleSlider = bar.slider({
    label: 'b̂ angle',
    min: 0,
    max: 360,
    step: 1,
    value: 15,
    format: (v) => `${v.toFixed(0)}°`,
    onInput: (v) => {
      theta = v * DEG
      widget.requestDraw()
    },
  })
  bar.button({
    label: 'snap b̂ to x̂',
    onClick: () => {
      theta = 0
      angleSlider?.set(0)
      widget.requestDraw()
    },
  })

  widgetNote(
    container,
    'Drag <b>a</b>, or drag <b>b̂</b> around its circle. Snap b̂ to x̂ and the readout is just a’s x-coordinate — the dot product was reading coordinates all along. Swing b̂ past 90° from a and the number goes negative.',
  )
}

/* ------------------------------------------------------------------------ */
/* 2.2 split-lab (explanatory — no exercise drives it)                       */
/* ------------------------------------------------------------------------ */

const splitLab: WidgetFactory = (container) => {
  let a = v2.vec2(4, 3)
  let b = v2.vec2(3, 0)

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 360,
    draw(ctx, w) {
      const proj = v2.project(a, b)
      const rej = v2.reject(a, b)

      draw.grid2(ctx, vp, w)

      const bHat = v2.normalize(b)
      if (v2.lengthSq(bHat) > 0) {
        draw.line2(ctx, vp, v2.scale(bHat, -20), v2.scale(bHat, 20), {
          color: COLORS.grid,
          width: 1,
          dash: [5, 5],
        })
      }

      // The rejection is drawn where it lives: from the projection's tip to a's.
      draw.arrow2(ctx, vp, proj, a, { color: COLORS.purple, width: 4 })
      draw.arrow2(ctx, vp, v2.vec2(0, 0), proj, { color: COLORS.green, width: 4 })
      rightAngle(ctx, vp, proj, v2.vec2(0, 0), a)

      draw.arrow2(ctx, vp, v2.vec2(0, 0), b, { color: COLORS.yellow, width: 3, label: 'b' })
      draw.arrow2(ctx, vp, v2.vec2(0, 0), a, { color: COLORS.accent, label: 'a' })

      const sp = vp.toScreen(v2.lerp(v2.vec2(0, 0), proj, 0.5))
      draw.drawLabel(ctx, 'along', v2.vec2(sp.x - 16, sp.y + 20), COLORS.green)
      const sr = vp.toScreen(v2.lerp(proj, a, 0.5))
      draw.drawLabel(ctx, 'across', v2.vec2(sr.x + 12, sr.y), COLORS.purple)

      const fmt = (q: Vec2) => `(${q.x.toFixed(2)}, ${q.y.toFixed(2)})`
      const sum = v2.add(proj, rej)
      setHud(
        `project(a, b) = ${fmt(proj)}   along\n` +
          `reject(a, b)  = ${fmt(rej)}   across\n` +
          `project + reject = ${fmt(sum)} = a\n` +
          `|b| = ${v2.length(b).toFixed(2)}   lengthSq(b) = ${v2.lengthSq(b).toFixed(2)}`,
      )
    },
  })

  const vp = new Viewport2D(widget, { center: v2.vec2(1.4, 0.9), unitsHigh: 8 })
  const setHud = hud(container)

  widget.handles.push(
    worldHandle(vp, () => a, (p) => (a = p)),
    worldHandle(vp, () => b, (p) => (b = p)),
  )

  const bar = controlsBar(container)
  bar.button({
    label: 'double b',
    onClick: () => {
      b = v2.scale(b, 2)
      widget.requestDraw()
    },
  })
  bar.button({
    label: 'halve b',
    onClick: () => {
      b = v2.scale(b, 0.5)
      widget.requestDraw()
    },
  })

  widgetNote(
    container,
    'Drag <b>a</b> and <b>b</b>. Green plus purple always rebuilds <b>a</b> exactly — that’s along + across. Now hit <i>double b</i>: b’s arrow grows, and the projection does not move a pixel. That is <code>lengthSq(b)</code> in the denominator dividing b’s length back out, twice.',
  )
}

/* ------------------------------------------------------------------------ */
/* 2.2 ramp-split (explanatory — no exercise drives it)                      */
/* ------------------------------------------------------------------------ */

const rampSplit: WidgetFactory = (container) => {
  let slope = 30 * DEG
  const G = 9.8

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 340,
    draw(ctx, w) {
      // The ramp descends to the left, so its apex grows away from the HUD.
      const L = 6.4
      const baseY = -2.2
      const heel = v2.vec2(3.4, baseY)
      const top = v2.vec2(3.4, baseY + L * Math.sin(slope))
      const toe = v2.vec2(3.4 - L * Math.cos(slope), baseY)

      draw.grid2(ctx, vp, w)

      const s1 = vp.toScreen(heel)
      const s2 = vp.toScreen(top)
      const s3 = vp.toScreen(toe)
      ctx.save()
      ctx.fillStyle = 'rgba(198, 205, 217, 0.06)'
      ctx.strokeStyle = COLORS.dim
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(s1.x, s1.y)
      ctx.lineTo(s2.x, s2.y)
      ctx.lineTo(s3.x, s3.y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()

      // Down-slope direction, and the surface normal pointing up out of it.
      const sHat = v2.vec2(-Math.cos(slope), -Math.sin(slope))
      const nHat = v2.vec2(-Math.sin(slope), Math.cos(slope))
      const foot = v2.add(top, v2.scale(sHat, 0.42 * L))
      const box = v2.add(foot, v2.scale(nHat, 0.3))

      // The box, sitting square on the slope.
      const cs = [
        v2.add(box, v2.add(v2.scale(sHat, 0.3), v2.scale(nHat, 0.3))),
        v2.add(box, v2.add(v2.scale(sHat, -0.3), v2.scale(nHat, 0.3))),
        v2.add(box, v2.add(v2.scale(sHat, -0.3), v2.scale(nHat, -0.3))),
        v2.add(box, v2.add(v2.scale(sHat, 0.3), v2.scale(nHat, -0.3))),
      ]
      for (let i = 0; i < 4; i++) {
        draw.line2(ctx, vp, cs[i], cs[(i + 1) % 4], { color: COLORS.dim, width: 1.5 })
      }

      // One gravity vector, split by the slope into along + into.
      const gDisp = v2.vec2(0, -2.4)
      const along = v2.project(gDisp, sHat)
      const into = v2.reject(gDisp, sHat)
      const gTip = v2.add(box, gDisp)

      draw.line2(ctx, vp, v2.add(box, along), gTip, { color: COLORS.ghost, width: 1, dash: [3, 4] })
      draw.line2(ctx, vp, v2.add(box, into), gTip, { color: COLORS.ghost, width: 1, dash: [3, 4] })
      draw.arrow2(ctx, vp, box, gTip, { color: COLORS.accent, width: 2.5 })
      draw.arrow2(ctx, vp, box, v2.add(box, along), { color: COLORS.green, width: 4 })
      draw.arrow2(ctx, vp, box, v2.add(box, into), { color: COLORS.purple, width: 4 })

      // Gravity is labelled at its midpoint: flatten the slope and `into` converges
      // onto gravity, so tip-anchored labels would land on top of each other.
      const sg = vp.toScreen(v2.lerp(box, gTip, 0.5))
      draw.drawLabel(ctx, 'gravity', v2.vec2(sg.x + 10, sg.y), COLORS.accent)
      const sa = vp.toScreen(v2.add(box, along))
      draw.drawLabel(ctx, 'along → slides it', v2.vec2(sa.x - 130, sa.y + 32), COLORS.green)
      const si = vp.toScreen(v2.add(box, into))
      draw.drawLabel(ctx, 'into → ramp resists', v2.vec2(si.x + 12, si.y + 6), COLORS.purple)

      setHud(
        `slope θ = ${Math.round(slope / DEG)}°\n` +
          `along = |g| sin θ = ${(G * Math.sin(slope)).toFixed(2)} m/s²   slides the box\n` +
          `into  = |g| cos θ = ${(G * Math.cos(slope)).toFixed(2)} m/s²   the ramp pushes back`,
      )
    },
  })

  const vp = new Viewport2D(widget, { center: v2.vec2(0.2, -0.3), unitsHigh: 8.5 })
  const setHud = hud(container)

  const bar = controlsBar(container)
  bar.slider({
    label: 'slope',
    min: 5,
    max: 60,
    step: 1,
    value: 30,
    format: (v) => `${v.toFixed(0)}°`,
    onInput: (v) => {
      slope = v * DEG
      widget.requestDraw()
    },
  })

  widgetNote(
    container,
    'Gravity never changes — one arrow, always straight down. Drag the slope and watch the ramp re-split it: flatten it and <i>along</i> vanishes (nothing slides), steepen it and <i>along</i> takes over. Same project/reject as above, doing a physics job.',
  )
}

/* ------------------------------------------------------------------------ */
/* 2.2 quake-legs (drives: 02/project-reject)                                */
/* ------------------------------------------------------------------------ */

interface RoomWall {
  a: Vec2
  b: Vec2
  n: Vec2 // inward unit normal
}

const quakeLegs: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  const R = 0.42 // character radius
  const SPEED = 5
  let pos = v2.vec2(0, -1)
  let heading = v2.vec2(1, 0)
  let walls: RoomWall[] = []
  let touch: RoomWall | null = null
  let desired = v2.vec2(0, 0)
  let actual = v2.vec2(0, 0)
  let badReturn = false

  const widget = new CanvasWidget(container, {
    mode: 'animated',
    height: 320,
    update(dt, w) {
      // One convex room, sized to the canvas (precomputed inward normals).
      const halfW = Math.min(5.8, Math.max(3.2, w.width / vp.scale / 2 - 0.5))
      const halfH = 2.9
      walls = [
        { a: v2.vec2(-halfW, halfH), b: v2.vec2(halfW, halfH), n: v2.vec2(0, -1) },
        { a: v2.vec2(halfW, halfH), b: v2.vec2(halfW, -halfH), n: v2.vec2(-1, 0) },
        { a: v2.vec2(halfW, -halfH), b: v2.vec2(-halfW, -halfH), n: v2.vec2(0, 1) },
        { a: v2.vec2(-halfW, -halfH), b: v2.vec2(-halfW, halfH), n: v2.vec2(1, 0) },
      ]

      // Pointer-follow movement with a small deadzone.
      let vel = v2.vec2(0, 0)
      if (w.pointer) {
        const to = v2.sub(vp.toWorld(w.pointer), pos)
        if (v2.length(to) > 0.3) vel = v2.scale(v2.normalize(to), SPEED)
      }
      desired = vel
      touch = null
      badReturn = false
      for (const wall of walls) {
        const sd = v2.dot(v2.sub(pos, wall.a), wall.n) - R
        if (sd <= 0.06 && v2.dot(vel, wall.n) < -1e-9) {
          touch = touch ?? wall
          if (userFns) {
            const r: unknown = userFns.reject(vel, wall.n)
            if (isVec2(r)) {
              vel = r
            } else {
              vel = v2.vec2(0, 0)
              badReturn = true
            }
          } else {
            vel = v2.vec2(0, 0) // flypaper
          }
        }
      }
      actual = vel
      pos = v2.add(pos, v2.scale(vel, dt))
      // Penetration resolution (infrastructure): push out by the overlap.
      for (const wall of walls) {
        const sd = v2.dot(v2.sub(pos, wall.a), wall.n) - R
        if (sd < 0) pos = v2.add(pos, v2.scale(wall.n, -sd))
      }
      if (v2.lengthSq(vel) > 1e-6) heading = v2.normalize(vel)
    },
    draw(ctx, w) {
      draw.grid2(ctx, vp, w)
      for (const wall of walls) {
        draw.line2(ctx, vp, wall.a, wall.b, { color: '#4a5268', width: 6 })
        const mid = v2.lerp(wall.a, wall.b, 0.5)
        draw.arrow2(ctx, vp, mid, v2.add(mid, v2.scale(wall.n, 0.6)), {
          color: COLORS.dim,
          width: 1,
        })
      }
      if (w.pointer) {
        draw.point2(ctx, vp, vp.toWorld(w.pointer), { color: COLORS.yellow, r: 3 })
      }

      // Live decomposition while pushing into a wall.
      if (touch && v2.lengthSq(desired) > 1e-6) {
        const k = 0.38 // display scale: world units per (unit/s)
        const proj = v2.project(desired, touch.n)
        const rej = userFns && !badReturn ? actual : v2.reject(desired, touch.n)
        draw.arrow2(ctx, vp, pos, v2.add(pos, v2.scale(desired, k)), {
          color: COLORS.accent,
          label: 'velocity',
        })
        draw.arrow2(ctx, vp, pos, v2.add(pos, v2.scale(proj, k)), {
          color: COLORS.red,
          label: 'project(v, n)',
        })
        if (v2.lengthSq(rej) > 1e-6) {
          draw.arrow2(ctx, vp, pos, v2.add(pos, v2.scale(rej, k)), {
            color: COLORS.green,
            label: userFns ? 'your reject(v, n)' : 'reject(v, n) — yours soon',
          })
        }
      }

      // The character.
      draw.point2(ctx, vp, pos, { color: COLORS.accent, r: R * vp.scale })
      draw.point2(ctx, vp, v2.add(pos, v2.scale(heading, R * 0.7)), { color: '#1b1f27', r: 3 })

      const lines: string[] = []
      if (!userFns) {
        lines.push('flypaper walls: velocity zeroed on contact')
        lines.push('solve reject() below — then walk diagonally into a wall')
      } else if (badReturn) {
        lines.push('your reject(v, n) returned a non-vector — flypaper again')
      } else {
        lines.push('gliding: velocity = your reject(velocity, wallNormal)')
      }
      if (!w.pointer) lines.push('move the pointer inside the room to walk')
      setHud(lines.join('\n'))
    },
  })

  const vp = new Viewport2D(widget, { unitsHigh: 8 })
  const setHud = hud(container)

  widgetNote(
    container,
    'The character walks toward your pointer. The circle-vs-wall contact test is infrastructure; what happens <em>on</em> contact is your math: without <code>reject()</code> the wall is flypaper, with it you glide like a real FPS.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
    },
  }
}

/* ------------------------------------------------------------------------ */
/* 2.3 guard-duty (drives: 02/angles)                                        */
/* ------------------------------------------------------------------------ */

interface Guard {
  cx: number
  cy: number
  rx: number
  ry: number
  speed: number
  dir: number
  phase: number
  pos: Vec2
  facing: Vec2
  spotted: boolean
  ring: number
}

const guardDuty: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let fov = 70 * DEG
  let tt = 0
  const CONE_R = 4.6
  const IDLE_SPY = v2.vec2(0, 0)
  let spy = IDLE_SPY

  const guards: Guard[] = [
    { cx: -2.7, cy: 1.35, rx: 2.9, ry: 1.45, speed: 0.55, dir: 1, phase: 0.7, pos: v2.vec2(0, 0), facing: v2.vec2(1, 0), spotted: false, ring: 0 },
    { cx: 2.7, cy: -1.35, rx: 2.7, ry: 1.4, speed: 0.7, dir: -1, phase: 2.6, pos: v2.vec2(0, 0), facing: v2.vec2(1, 0), spotted: false, ring: 0 },
  ]

  const widget = new CanvasWidget(container, {
    mode: 'animated',
    height: 360,
    update(dt, w) {
      tt += dt
      spy = w.pointer ? vp.toWorld(w.pointer) : IDLE_SPY
      for (const g of guards) {
        const ang = g.phase + g.dir * g.speed * tt
        g.pos = v2.vec2(g.cx + g.rx * Math.cos(ang), g.cy + g.ry * Math.sin(ang))
        g.facing = v2.normalize(v2.vec2(-g.rx * Math.sin(ang) * g.dir, g.ry * Math.cos(ang) * g.dir))
        g.spotted = false
        if (userFns && v2.distance(g.pos, spy) <= CONE_R) {
          g.spotted = Boolean(userFns.isInFov(g.pos, g.facing, spy, fov))
        }
        g.ring = g.spotted ? (g.ring + dt * 1.5) % 1 : 0
      }
    },
    draw(ctx, w) {
      draw.grid2(ctx, vp, w)
      const anySpotted = guards.some((g) => g.spotted)

      for (const g of guards) {
        // Vision cone as a translucent wedge.
        const base = Math.atan2(g.facing.y, g.facing.x)
        const s0 = vp.toScreen(g.pos)
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(s0.x, s0.y)
        for (let i = 0; i <= 28; i++) {
          const a = base - fov / 2 + (fov * i) / 28
          const p = vp.toScreen(v2.add(g.pos, v2.scale(v2.vec2(Math.cos(a), Math.sin(a)), CONE_R)))
          ctx.lineTo(p.x, p.y)
        }
        ctx.closePath()
        ctx.fillStyle = !userFns
          ? 'rgba(138, 147, 165, 0.10)'
          : g.spotted
            ? 'rgba(224, 108, 117, 0.20)'
            : 'rgba(152, 195, 121, 0.10)'
        ctx.fill()
        ctx.strokeStyle = !userFns ? COLORS.dim : g.spotted ? COLORS.red : COLORS.green
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()

        draw.arrow2(ctx, vp, g.pos, v2.add(g.pos, v2.scale(g.facing, 0.9)), { color: COLORS.fg })
        draw.point2(ctx, vp, g.pos, { color: g.spotted ? COLORS.red : COLORS.cyan, r: 7 })

        if (g.spotted) {
          const rr = (0.4 + g.ring * 1.6) * vp.scale
          ctx.save()
          ctx.strokeStyle = `rgba(224, 108, 117, ${(1 - g.ring).toFixed(2)})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(s0.x, s0.y, rr, 0, TAU)
          ctx.stroke()
          ctx.restore()
          draw.drawLabel(ctx, 'SPOTTED', v2.vec2(s0.x + 12, s0.y - 14), COLORS.red)
        }
      }

      // The spy.
      draw.point2(ctx, vp, spy, {
        color: anySpotted ? COLORS.red : COLORS.purple,
        r: 6,
        label: w.pointer ? 'spy (you)' : 'spy idles here — move the pointer',
      })

      // The cosine meter: one bar per guard, threshold tick at cos(fov/2).
      const thr = Math.cos(fov / 2)
      const bw = Math.min(200, w.width * 0.3)
      const x0 = 12
      let y0 = w.height - 64
      ctx.save()
      ctx.font = MONO_FONT
      for (let i = 0; i < guards.length; i++) {
        const g = guards[i]
        const val = v2.dot(g.facing, v2.normalize(v2.sub(spy, g.pos)))
        const t = (val + 1) / 2
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
        ctx.fillRect(x0, y0, bw, 10)
        ctx.fillStyle = val >= thr ? COLORS.red : COLORS.accent
        ctx.fillRect(x0, y0, Math.max(0, t * bw), 10)
        const tx = x0 + ((thr + 1) / 2) * bw
        ctx.strokeStyle = COLORS.yellow
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(tx, y0 - 3)
        ctx.lineTo(tx, y0 + 13)
        ctx.stroke()
        ctx.fillStyle = COLORS.dim
        ctx.fillText(`guard ${i + 1}  dot = ${val.toFixed(2)}`, x0 + bw + 10, y0 + 9)
        y0 += 20
      }
      ctx.fillStyle = COLORS.yellow
      ctx.fillText(`▲ cos(fov/2) = ${thr.toFixed(2)}`, x0 + ((thr + 1) / 2) * bw - 4, y0 + 8)
      ctx.restore()

      setHud(
        userFns
          ? 'spotted = your isInFov(guardPos, facing, spyPos, fov)'
          : 'guards are blind — solve isInFov below to switch on their eyes',
      )
    },
  })

  const vp = new Viewport2D(widget, { unitsHigh: 10 })
  const setHud = hud(container)

  const bar = controlsBar(container)
  bar.slider({
    label: 'fov',
    min: 30,
    max: 150,
    step: 1,
    value: 70,
    format: (v) => `${Math.round(v)}°`,
    onInput: (v) => (fov = v * DEG),
  })

  widgetNote(
    container,
    'You are the spy — skirt the cones. The bars at the bottom are the whole test, drawn: each guard’s dot(facing, toSpy) — both normalized — against the yellow cos(fov/2) tick. The 4.6-unit cone range is infrastructure; the angle decision is your <code>isInFov</code>.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
    },
  }
}

/* ------------------------------------------------------------------------ */
/* 2.4 cross-3d (drives: 02/cross)                                           */
/* ------------------------------------------------------------------------ */

const cross3d: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let a = v3.vec3(2, 0.4, -0.3)
  let b = v3.vec3(0.4, 1.7, 0.5)

  const cam = new Camera3D({ yaw: 0.9, pitch: 0.45, dist: 11 })

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 380,
    draw(ctx, w) {
      draw.grid3(ctx, cam, w, { extent: 4 })
      draw.axes3(ctx, cam, w, 1.6)

      const o = v3.vec3(0, 0, 0)

      // Translucent parallelogram spanned by a and b.
      const corners = [o, a, v3.add(a, b), b].map((p) => cam.project3(p, w))
      if (corners.every((c) => c !== null)) {
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(corners[0]!.x, corners[0]!.y)
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i]!.x, corners[i]!.y)
        ctx.closePath()
        ctx.fillStyle = 'rgba(229, 192, 123, 0.14)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(229, 192, 123, 0.45)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
      }

      draw.arrow3(ctx, cam, w, o, a, { color: COLORS.accent, label: 'a', width: 2.5 })
      draw.arrow3(ctx, cam, w, o, b, { color: COLORS.green, label: 'b', width: 2.5 })

      const ref = v3.cross(a, b)
      const raw: unknown = userFns ? userFns.cross(a, b) : null
      const mine = isVec3(raw)
      const n = mine ? raw : ref
      draw.arrow3(ctx, cam, w, o, n, {
        color: mine ? COLORS.purple : COLORS.ghost,
        width: 2.5,
        label: mine ? 'your cross(a, b)' : 'cross(a, b) (reference)',
      })

      const f = (p: Vec3) => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`
      setHud(
        `a = ${f(a)}   b = ${f(b)}\n` +
          `${mine ? 'your' : 'reference'} cross(a, b) = ${f(n)}\n` +
          `|cross(a, b)| = ${v3.length(n).toFixed(2)} = parallelogram area` +
          (userFns && !mine ? '\nyour cross returned a non-vector' : ''),
      )
    },
  })
  cam.attachOrbit(widget)
  const setHud = hud(container)

  const bar = controlsBar(container)
  bar.button({
    label: 'swap a ↔ b',
    primary: true,
    onClick: () => {
      const t = a
      a = b
      b = t
      sync()
    },
  })
  bar.button({ label: 'x̂ × ŷ', onClick: () => { a = v3.vec3(2, 0, 0); b = v3.vec3(0, 2, 0); sync() } })
  bar.button({ label: 'tilted', onClick: () => { a = v3.vec3(2, 0.4, -0.3); b = v3.vec3(0.4, 1.7, 0.5); sync() } })
  bar.button({ label: 'near-parallel', onClick: () => { a = v3.vec3(2, 0.5, 0); b = v3.vec3(1.8, 0.7, 0.15); sync() } })

  const comp = (label: string, get: () => number, set: (v: number) => void) =>
    bar.slider({
      label,
      min: -2.5,
      max: 2.5,
      step: 0.1,
      value: get(),
      format: (v) => v.toFixed(1),
      onInput: (v) => {
        set(v)
        widget.requestDraw()
      },
    })
  const sliders = [
    comp('a.x', () => a.x, (v) => (a = v3.vec3(v, a.y, a.z))),
    comp('a.y', () => a.y, (v) => (a = v3.vec3(a.x, v, a.z))),
    comp('a.z', () => a.z, (v) => (a = v3.vec3(a.x, a.y, v))),
    comp('b.x', () => b.x, (v) => (b = v3.vec3(v, b.y, b.z))),
    comp('b.y', () => b.y, (v) => (b = v3.vec3(b.x, v, b.z))),
    comp('b.z', () => b.z, (v) => (b = v3.vec3(b.x, b.y, v))),
  ]
  function sync(): void {
    const vals = [a.x, a.y, a.z, b.x, b.y, b.z]
    sliders.forEach((s, i) => s.set(vals[i]))
    widget.requestDraw()
  }

  widgetNote(
    container,
    'Drag to orbit. Hit <b>swap</b> and watch the normal flip: cross(b, a) = −cross(a, b) — argument order will decide which side of a triangle is “out” for the rest of the course.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ------------------------------------------------------------------------ */
/* 2.4 turn-signal (drives: 02/cross)                                        */
/* ------------------------------------------------------------------------ */

const turnSignal: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let ignoreSign = false
  let pos = v2.vec2(-3, -1.5)
  let heading = 0.4
  let tt = 0
  let lastTarget = v2.vec2(3, 1)
  let lastCross = 0
  let badReturn = false
  const trail: Vec2[] = []
  const SPEED = 3.1
  const TURN = 2.2

  const widget = new CanvasWidget(container, {
    mode: 'animated',
    height: 340,
    update(dt, w) {
      tt += dt
      lastTarget = w.pointer
        ? vp.toWorld(w.pointer)
        : v2.vec2(4 * Math.cos(tt * 0.41), 2.2 * Math.sin(tt * 0.67))
      const forward = v2.vec2(Math.cos(heading), Math.sin(heading))
      const toTarget = v2.sub(lastTarget, pos)
      const raw: unknown = userFns
        ? userFns.cross2(forward, toTarget)
        : v2.cross2(forward, toTarget)
      badReturn = userFns !== null && !isFiniteNumber(raw)
      let c = isFiniteNumber(raw) ? raw : 0
      lastCross = c
      if (ignoreSign) c = Math.abs(c)
      const dist = v2.length(toTarget)
      const sin = dist > 1e-6 ? c / dist : 0 // |forward| = 1, so c = dist·sin(θ)
      if (Math.abs(sin) > 0.05) heading += Math.sign(sin) * TURN * dt
      pos = v2.add(pos, v2.scale(forward, SPEED * dt))
      // Wrap at the edges so the long way round stays on screen.
      const bx = w.width / vp.scale / 2 + 0.4
      const by = vp.unitsHigh / 2 + 0.4
      if (pos.x > bx) pos = v2.vec2(-bx, pos.y)
      if (pos.x < -bx) pos = v2.vec2(bx, pos.y)
      if (pos.y > by) pos = v2.vec2(pos.x, -by)
      if (pos.y < -by) pos = v2.vec2(pos.x, by)
      trail.push(pos)
      if (trail.length > 130) trail.shift()
    },
    draw(ctx, w) {
      draw.grid2(ctx, vp, w)

      ctx.save()
      for (let i = 0; i < trail.length; i++) {
        const s = vp.toScreen(trail[i])
        ctx.fillStyle = `rgba(97, 175, 239, ${((0.3 * i) / trail.length).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, 2, 0, TAU)
        ctx.fill()
      }
      ctx.restore()

      const forward = v2.vec2(Math.cos(heading), Math.sin(heading))
      const perp = v2.vec2(-forward.y, forward.x)

      draw.point2(ctx, vp, lastTarget, {
        color: COLORS.yellow,
        r: 5,
        label: w.pointer ? 'target (you)' : 'target',
      })
      draw.arrow2(ctx, vp, pos, v2.add(pos, v2.scale(forward, 1.3)), {
        color: COLORS.accent,
        label: 'forward',
      })
      const to = v2.sub(lastTarget, pos)
      const tl = v2.length(to)
      if (tl > 0.01) {
        draw.arrow2(ctx, vp, pos, v2.add(pos, v2.scale(to, Math.min(1, 2.2 / tl))), {
          color: COLORS.yellow,
          width: 1.5,
          dash: [4, 4],
          label: 'toTarget',
        })
      }

      // The car.
      const p1 = vp.toScreen(v2.add(pos, v2.scale(forward, 0.55)))
      const p2 = vp.toScreen(v2.add(v2.sub(pos, v2.scale(forward, 0.32)), v2.scale(perp, 0.3)))
      const p3 = vp.toScreen(v2.sub(v2.sub(pos, v2.scale(forward, 0.32)), v2.scale(perp, 0.3)))
      ctx.save()
      ctx.fillStyle = ignoreSign ? COLORS.red : COLORS.accent
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.lineTo(p3.x, p3.y)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      const cEff = ignoreSign ? Math.abs(lastCross) : lastCross
      const steer =
        Math.abs(cEff) <= 0.05 * Math.max(tl, 1e-6) ? 'straight' : cEff > 0 ? 'left' : 'right'
      setHud(
        `cross2(forward, toTarget) = ${lastCross.toFixed(2)} → steer ${steer}` +
          (badReturn ? '\nyour cross2 returned a non-number — steering dead' : '') +
          (userFns ? '' : '\nreference cross2 — solve below to take the wheel') +
          (ignoreSign ? '\nsign ignored: always steering left — enjoy the 350° route' : ''),
      )
    },
  })

  const vp = new Viewport2D(widget, { unitsHigh: 8 })
  const setHud = hud(container)

  const bar = controlsBar(container)
  bar.toggle({
    label: 'ignore the sign (the classic bug)',
    onChange: (on) => (ignoreSign = on),
  })

  widgetNote(
    container,
    'The car’s turn rate is limited; its only steering input is the sign of <code>cross2(forward, toTarget)</code>: positive = target on the left, negative = on the right. Throw the sign away and a target 10° to the right means a 350° left turn.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
    },
  }
}

/* ------------------------------------------------------------------------ */
/* 2.5 plane-swarm (reference-driven intro — not exercise-driven)            */
/* ------------------------------------------------------------------------ */

const planeSwarm: WidgetFactory = (container) => {
  let n = v3.vec3(0, 1, 0)
  let d = 0.8

  const rand = lcg(1234)
  const pts: Vec3[] = Array.from({ length: 40 }, () =>
    v3.vec3((rand() * 2 - 1) * 3.4, (rand() * 2 - 1) * 2.4, (rand() * 2 - 1) * 3.4),
  )

  const cam = new Camera3D({ yaw: 0.8, pitch: 0.42, dist: 12 })

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 380,
    draw(ctx, w) {
      draw.grid3(ctx, cam, w, { extent: 4 })

      const plane: Plane = pl.plane(n, d)

      // The plane as a grid-quad: orthonormal basis u, vv spanning it.
      const helper = Math.abs(n.y) < 0.9 ? v3.vec3(0, 1, 0) : v3.vec3(1, 0, 0)
      const u = v3.normalize(v3.cross(n, helper))
      const vv = v3.cross(n, u)
      const c = v3.scale(n, d)
      const E = 3
      const lineCol = 'rgba(86, 182, 194, 0.30)'
      for (let i = -E; i <= E; i++) {
        draw.line3(
          ctx, cam, w,
          v3.add(c, v3.add(v3.scale(u, i), v3.scale(vv, -E))),
          v3.add(c, v3.add(v3.scale(u, i), v3.scale(vv, E))),
          { color: lineCol, width: 1 },
        )
        draw.line3(
          ctx, cam, w,
          v3.add(c, v3.add(v3.scale(vv, i), v3.scale(u, -E))),
          v3.add(c, v3.add(v3.scale(vv, i), v3.scale(u, E))),
          { color: lineCol, width: 1 },
        )
      }
      draw.arrow3(ctx, cam, w, c, v3.add(c, n), { color: COLORS.cyan, label: 'n', width: 2.5 })

      // Painter-sorted swarm, classified by reference signedDistance.
      const order = pts
        .map((p) => ({ p, pr: cam.project3(p, w) }))
        .filter((o) => o.pr !== null)
        .sort((x, y) => y.pr!.depth - x.pr!.depth)
      let front = 0
      let back = 0
      let on = 0
      for (const o of order) {
        const side = pl.classifyPoint(plane, o.p, 0.18)
        if (side === 'front') front++
        else if (side === 'back') back++
        else on++
        const color = side === 'front' ? COLORS.green : side === 'back' ? COLORS.red : COLORS.yellow
        draw.point3(ctx, cam, w, o.p, { color, r: 0.075 })
      }

      setHud(
        `n = (${n.x.toFixed(2)}, ${n.y.toFixed(2)}, ${n.z.toFixed(2)})   d = ${d.toFixed(2)}\n` +
          `signedDistance = dot3(n, p) − d  →  ${front} front · ${back} back · ${on} on`,
      )
    },
  })
  cam.attachOrbit(widget)
  const setHud = hud(container)

  const bar = controlsBar(container)
  bar.slider({
    label: 'd',
    min: -2.5,
    max: 2.5,
    step: 0.05,
    value: d,
    onInput: (v) => {
      d = v
      widget.requestDraw()
    },
  })
  const preset = (label: string, nn: Vec3) =>
    bar.button({
      label,
      onClick: () => {
        n = v3.normalize(nn)
        widget.requestDraw()
      },
    })
  preset('n = ŷ', v3.vec3(0, 1, 0))
  preset('n = x̂', v3.vec3(1, 0, 0))
  preset('n = (1,1,0)', v3.vec3(1, 1, 0))
  preset('n = (1,1,1)', v3.vec3(1, 1, 1))

  widgetNote(
    container,
    'Drag to orbit. Slide d to push the plane along its own normal; every point re-asks the one question dot3(n, p) − d: green on the side n points toward, red behind, yellow within ±0.18 of the skin. (Reference math — your version powers the next widget.)',
  )
}

/* ------------------------------------------------------------------------ */
/* 2.5 the-bouncer (drives: 02/planes)                                       */
/* ------------------------------------------------------------------------ */

const theBouncer: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let heading = 0.6
  let sweep = true
  const HALF = 28 * DEG
  const NEAR = 0.7
  const FAR = 5.4
  const TREE_R = 0.26

  const rand = lcg(99)
  const trees: Vec2[] = []
  while (trees.length < 200) {
    const p = v2.vec2((rand() * 2 - 1) * 6.6, (rand() * 2 - 1) * 3.3)
    if (v2.length(p) > 0.9) trees.push(p)
  }

  // Four frustum planes (course Vec3 Plane type, z = 0), apex at the origin.
  function frustum(h: number): Plane[] {
    const f = v3.vec3(Math.cos(h), Math.sin(h), 0)
    return [
      pl.plane(v3.vec3(Math.sin(h + HALF), -Math.cos(h + HALF), 0), 0), // left edge, inward
      pl.plane(v3.vec3(-Math.sin(h - HALF), Math.cos(h - HALF), 0), 0), // right edge, inward
      pl.plane(f, NEAR), // near
      pl.plane(v3.neg(f), -FAR), // far
    ]
  }

  const widget = new CanvasWidget(container, {
    mode: 'animated',
    height: 340,
    update(dt) {
      if (sweep) {
        heading += dt * 0.35
        if (heading > Math.PI) heading -= TAU
        headingSlider.set(heading / DEG)
      }
    },
    draw(ctx) {
      const planes = frustum(heading)

      // The camera wedge (trapezoid between near and far planes).
      const cosH = Math.cos(HALF)
      const dirL = v2.vec2(Math.cos(heading + HALF), Math.sin(heading + HALF))
      const dirR = v2.vec2(Math.cos(heading - HALF), Math.sin(heading - HALF))
      const quad = [
        v2.scale(dirL, NEAR / cosH),
        v2.scale(dirR, NEAR / cosH),
        v2.scale(dirR, FAR / cosH),
        v2.scale(dirL, FAR / cosH),
      ].map((p) => vp.toScreen(p))
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(quad[0].x, quad[0].y)
      for (let i = 1; i < 4; i++) ctx.lineTo(quad[i].x, quad[i].y)
      ctx.closePath()
      ctx.fillStyle = 'rgba(97, 175, 239, 0.10)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(97, 175, 239, 0.55)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()

      let visibleCount = 0
      for (const t of trees) {
        let visible = true
        if (userFns) {
          visible = Boolean(userFns.sphereInFrustum(planes, v3.vec3(t.x, t.y, 0), TREE_R))
        }
        if (visible) visibleCount++
        const s = vp.toScreen(t)
        ctx.save()
        ctx.fillStyle = visible ? 'rgba(152, 195, 121, 0.9)' : 'rgba(138, 147, 165, 0.22)'
        ctx.beginPath()
        ctx.arc(s.x, s.y, TREE_R * vp.scale, 0, TAU)
        ctx.fill()
        ctx.restore()
      }

      draw.point2(ctx, vp, v2.vec2(0, 0), { color: COLORS.yellow, r: 5, label: 'camera' })

      setHud(
        userFns
          ? `drawing ${visibleCount} / ${trees.length} — your sphereInFrustum culls the rest`
          : `drawing ${trees.length} / ${trees.length} — solve sphereInFrustum below to cull`,
      )
    },
  })

  const vp = new Viewport2D(widget, { unitsHigh: 7.5 })
  const setHud = hud(container)

  const bar = controlsBar(container)
  const sweepToggle = bar.toggle({ label: 'auto sweep', value: true, onChange: (on) => (sweep = on) })
  const headingSlider = bar.slider({
    label: 'heading',
    min: -180,
    max: 180,
    step: 1,
    value: heading / DEG,
    format: (v) => `${Math.round(v)}°`,
    onInput: (v) => {
      heading = v * DEG
      sweep = false
      sweepToggle.set(false)
    },
  })

  widgetNote(
    container,
    '2D on purpose, honest types throughout: these are the course’s Vec3 <code>Plane</code>s with z = 0, and the trees are “spheres” of radius 0.26. Four planes here; a real camera frustum is six — same loop. Trees straddling an edge stay green: cull only when signedDistance &lt; −r.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
    },
  }
}

/* ------------------------------------------------------------------------ */
/* 2.6 laser-bounce (drives: 02/reflect)                                     */
/* ------------------------------------------------------------------------ */

/** First wall of the box [-bx,bx]×[-by,by] hit by the ray p + t·v. */
function nextWallHit(p: Vec2, v: Vec2, bx: number, by: number): { t: number; n: Vec2 } | null {
  let bestT = Infinity
  let bestN: Vec2 | null = null
  const consider = (t: number, n: Vec2): void => {
    if (t > 1e-6 && t < bestT) {
      bestT = t
      bestN = n
    }
  }
  if (v.x > 1e-9) consider((bx - p.x) / v.x, v2.vec2(-1, 0))
  if (v.x < -1e-9) consider((-bx - p.x) / v.x, v2.vec2(1, 0))
  if (v.y > 1e-9) consider((by - p.y) / v.y, v2.vec2(0, -1))
  if (v.y < -1e-9) consider((-by - p.y) / v.y, v2.vec2(0, 1))
  return bestN !== null ? { t: bestT, n: bestN } : null
}

const laserBounce: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let billiards = false
  let construction = false
  let mirrorAngle = -0.3
  const E = v2.vec2(-4.4, 2.3)
  const M = v2.vec2(0.5, -0.9)
  const MIRROR_HALF = 2.2

  const BX = 5.0
  const BY = 2.6
  const BALL_R = 0.22
  let ballPos = v2.vec2(-1, 0.4)
  let ballVel = v2.scale(v2.normalize(v2.vec2(1, 0.62)), 4.4)
  let badReturn = false

  /** Learner reflect with full guards; falls back to the reference. */
  function reflectSafe(vIn: Vec2, n: Vec2): Vec2 {
    if (userFns) {
      const r: unknown = userFns.reflect(vIn, n)
      if (isVec2(r) && v2.lengthSq(r) > 1e-9 && v2.length(r) < 50) return r
      badReturn = true
    }
    return v2.reflect(vIn, n)
  }

  const widget = new CanvasWidget(container, {
    mode: 'animated',
    height: 340,
    update(dt) {
      if (!billiards) return
      badReturn = false
      ballPos = v2.add(ballPos, v2.scale(ballVel, dt))
      const hits: Array<[boolean, Vec2]> = [
        [ballPos.x > BX - BALL_R && ballVel.x > 0, v2.vec2(-1, 0)],
        [ballPos.x < -BX + BALL_R && ballVel.x < 0, v2.vec2(1, 0)],
        [ballPos.y > BY - BALL_R && ballVel.y > 0, v2.vec2(0, -1)],
        [ballPos.y < -BY + BALL_R && ballVel.y < 0, v2.vec2(0, 1)],
      ]
      for (const [hit, n] of hits) {
        if (hit) ballVel = reflectSafe(ballVel, n)
      }
      // Infrastructure: whatever the math did, keep the ball in the box.
      ballPos = v2.vec2(
        Math.max(-BX + BALL_R, Math.min(BX - BALL_R, ballPos.x)),
        Math.max(-BY + BALL_R, Math.min(BY - BALL_R, ballPos.y)),
      )
      if (!Number.isFinite(ballPos.x + ballPos.y + ballVel.x + ballVel.y)) {
        ballPos = v2.vec2(0, 0)
        ballVel = v2.scale(v2.normalize(v2.vec2(1, 0.62)), 4.4)
      }
    },
    draw(ctx, w) {
      draw.grid2(ctx, vp, w)

      if (!billiards) {
        // --- laser mode ---
        const dir = v2.vec2(Math.cos(mirrorAngle), Math.sin(mirrorAngle))
        let nrm = v2.vec2(-dir.y, dir.x)
        if (v2.dot(nrm, v2.sub(E, M)) < 0) nrm = v2.neg(nrm)
        const vIn = v2.normalize(v2.sub(M, E))
        const refR = v2.reflect(vIn, nrm)
        const raw: unknown = userFns ? userFns.reflect(vIn, nrm) : null
        const mine = isVec2(raw)
        const rOut = mine ? raw : refR

        draw.line2(ctx, vp, v2.sub(M, v2.scale(dir, MIRROR_HALF)), v2.add(M, v2.scale(dir, MIRROR_HALF)), {
          color: '#4a5268',
          width: 6,
        })
        const knob = v2.add(M, v2.scale(dir, MIRROR_HALF))
        draw.point2(ctx, vp, knob, { color: COLORS.accent, r: 6, label: 'tilt me' })
        draw.point2(ctx, vp, E, { color: COLORS.red, r: 6, label: 'emitter' })
        draw.line2(ctx, vp, E, M, { color: COLORS.red, width: 2.5 })

        if (v2.lengthSq(rOut) > 1e-9) {
          const rHat = v2.normalize(rOut)
          draw.line2(ctx, vp, M, v2.add(M, v2.scale(rHat, 12)), {
            color: mine ? COLORS.yellow : COLORS.ghost,
            width: 2.5,
          })
          const lbl = vp.toScreen(v2.add(M, v2.scale(rHat, 2.6)))
          draw.drawLabel(
            ctx,
            mine ? 'your reflect(v, n)' : 'reference reflect — solve below',
            v2.vec2(lbl.x + 8, lbl.y - 10),
            mine ? COLORS.yellow : COLORS.dim,
          )
        }

        if (construction) {
          const L = 2.0
          const k = v2.dot(vIn, nrm)
          const tipV = v2.add(M, v2.scale(vIn, L))
          draw.arrow2(ctx, vp, v2.sub(M, v2.scale(vIn, L)), M, { color: COLORS.accent, label: 'v' })
          draw.line2(ctx, vp, M, tipV, { color: COLORS.ghost, width: 1, dash: [4, 4] })
          const midPt = v2.sub(tipV, v2.scale(nrm, k * L))
          draw.arrow2(ctx, vp, tipV, midPt, { color: COLORS.purple, label: '−dot(v,n)·n' })
          draw.arrow2(ctx, vp, midPt, v2.add(M, v2.scale(refR, L)), {
            color: COLORS.purple,
            label: '… and again',
          })
          draw.arrow2(ctx, vp, M, v2.add(M, nrm), { color: COLORS.cyan, label: 'n' })
        }

        setHud(
          `v = (${vIn.x.toFixed(2)}, ${vIn.y.toFixed(2)})   n = (${nrm.x.toFixed(2)}, ${nrm.y.toFixed(2)})   dot(v, n) = ${v2.dot(vIn, nrm).toFixed(2)}\n` +
            `r = v − 2·dot(v,n)·n = (${rOut.x.toFixed(2)}, ${rOut.y.toFixed(2)})` +
            (userFns && !mine ? '\nyour reflect returned a non-vector' : ''),
        )
      } else {
        // --- billiards mode ---
        const cs = [v2.vec2(-BX, -BY), v2.vec2(BX, -BY), v2.vec2(BX, BY), v2.vec2(-BX, BY)]
        for (let i = 0; i < 4; i++) {
          draw.line2(ctx, vp, cs[i], cs[(i + 1) % 4], { color: '#4a5268', width: 5 })
        }

        // Shot predictor: iterate reflect 5 bounces ahead.
        let p = ballPos
        let v = ballVel
        ctx.save()
        ctx.setLineDash([3, 6])
        ctx.strokeStyle = COLORS.ghost
        ctx.lineWidth = 1.5
        ctx.beginPath()
        const s0 = vp.toScreen(p)
        ctx.moveTo(s0.x, s0.y)
        for (let bounce = 0; bounce < 5; bounce++) {
          const hit = nextWallHit(p, v, BX - BALL_R, BY - BALL_R)
          if (!hit) break
          p = v2.add(p, v2.scale(v, hit.t))
          const sp = vp.toScreen(p)
          ctx.lineTo(sp.x, sp.y)
          v = reflectSafe(v, hit.n)
          if (v2.lengthSq(v) < 1e-9) break
        }
        ctx.stroke()
        ctx.restore()

        draw.point2(ctx, vp, ballPos, { color: COLORS.yellow, r: BALL_R * vp.scale })

        setHud(
          `every bounce: velocity = ${userFns ? 'your' : 'reference'} reflect(velocity, wallNormal)\n` +
            `|velocity| = ${v2.length(ballVel).toFixed(2)} — a correct mirror never changes speed` +
            (badReturn ? '\nyour reflect returned a non-vector — reference took over' : ''),
        )
      }
    },
  })

  const vp = new Viewport2D(widget, { unitsHigh: 7.5 })
  const setHud = hud(container)

  const mirrorHandle = {
    getScreen: () =>
      vp.toScreen(v2.add(M, v2.scale(v2.vec2(Math.cos(mirrorAngle), Math.sin(mirrorAngle)), MIRROR_HALF))),
    onDrag: (s: Vec2) => {
      const p = vp.toWorld(s)
      mirrorAngle = Math.atan2(p.y - M.y, p.x - M.x)
    },
  }
  widget.handles.push(mirrorHandle)

  const bar = controlsBar(container)
  bar.toggle({ label: 'show construction', onChange: (on) => (construction = on) })
  bar.toggle({
    label: 'billiards',
    onChange: (on) => {
      billiards = on
      widget.handles = on ? [] : [mirrorHandle]
    },
  })
  bar.button({
    label: 'kick ball',
    onClick: () => {
      const a = Math.random() * TAU
      ballVel = v2.scale(v2.vec2(Math.cos(a), Math.sin(a)), 4.4)
    },
  })

  widgetNote(
    container,
    'Drag the knob to tilt the mirror; “show construction” overlays the derivation. In billiards mode the dotted line is your <code>reflect</code> iterated five bounces ahead — a pool game’s aim assist is exactly this loop.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
    },
  }
}

/* ------------------------------------------------------------------------ */
/* Capstone shaded-sphere (drives: 02/capstone-sphere)                       */
/* ------------------------------------------------------------------------ */

const shadedSphere: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let light = v3.normalize(v3.vec3(0.45, 0.55, 0.7))
  let mode: 'shaded' | 'diffuse' | 'normals' = 'shaded'
  let dirty = true

  const SIZE = 128
  const PAD_R = 52
  const off = document.createElement('canvas')
  off.width = SIZE
  off.height = SIZE
  const octx = off.getContext('2d')!
  const img = octx.createImageData(SIZE, SIZE)

  function reshade(): void {
    const data = img.data
    const fns = userFns
    try {
      for (let j = 0; j < SIZE; j++) {
        const y = 1 - (j + 0.5) * (2 / SIZE)
        for (let i = 0; i < SIZE; i++) {
          const x = (i + 0.5) * (2 / SIZE) - 1
          let r = 16
          let g = 18
          let bl = 24
          if (fns) {
            if (mode === 'normals') {
              const n: unknown = fns.sphereNormal(x, y)
              if (isVec3(n)) {
                r = (n.x * 0.5 + 0.5) * 255
                g = (n.y * 0.5 + 0.5) * 255
                bl = (n.z * 0.5 + 0.5) * 255
              }
            } else {
              const s: unknown =
                mode === 'diffuse' ? fns.diffuse(x, y, light) : fns.shadePixel(x, y, light)
              const b = isFiniteNumber(s) ? Math.min(1, Math.max(0, s)) : 0
              r = 16 + b * 239
              g = 18 + b * 212
              bl = 24 + b * 176
            }
          }
          const k = (j * SIZE + i) * 4
          data[k] = r
          data[k + 1] = g
          data[k + 2] = bl
          data[k + 3] = 255
        }
      }
    } catch {
      /* the watchdog already detached the offending fns */
    }
    octx.putImageData(img, 0, 0)
  }

  function padCenter(w: { width: number }): Vec2 {
    return v2.vec2(w.width - 80, 88)
  }

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 340,
    draw(ctx, w) {
      if (dirty) {
        reshade()
        dirty = false
      }

      // 128×128 image, upscaled with smoothing.
      const s = Math.max(80, Math.min(w.height - 24, w.width - 170))
      const sx = 18
      const sy = (w.height - s) / 2
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(off, sx, sy, s, s)
      ctx.save()
      ctx.strokeStyle = 'rgba(198, 205, 217, 0.15)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(sx + s / 2, sy + s / 2, s / 2 - 1, 0, TAU)
      ctx.stroke()
      ctx.restore()

      if (!userFns) {
        ctx.save()
        ctx.font = MONO_FONT
        ctx.fillStyle = COLORS.dim
        ctx.textAlign = 'center'
        ctx.fillText('solve the exercise below', sx + s / 2, sy + s / 2 - 8)
        ctx.fillText('to light the sphere', sx + s / 2, sy + s / 2 + 10)
        ctx.restore()
      }

      // The light pad: a 2D disc mapped onto the unit hemisphere.
      const c = padCenter(w)
      ctx.save()
      ctx.strokeStyle = COLORS.dim
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(c.x, c.y, PAD_R, 0, TAU)
      ctx.stroke()
      ctx.strokeStyle = COLORS.grid
      ctx.beginPath()
      ctx.moveTo(c.x - PAD_R, c.y)
      ctx.lineTo(c.x + PAD_R, c.y)
      ctx.moveTo(c.x, c.y - PAD_R)
      ctx.lineTo(c.x, c.y + PAD_R)
      ctx.stroke()
      const lp = v2.vec2(c.x + light.x * PAD_R, c.y - light.y * PAD_R)
      ctx.fillStyle = COLORS.yellow
      ctx.beginPath()
      ctx.arc(lp.x, lp.y, 7, 0, TAU)
      ctx.fill()
      ctx.restore()
      draw.drawLabel(ctx, 'drag the light', v2.vec2(c.x - 44, c.y + PAD_R + 16), COLORS.dim)

      setHud(
        `L = (${light.x.toFixed(2)}, ${light.y.toFixed(2)}, ${light.z.toFixed(2)})` +
          (userFns ? `\nview: ${mode}` : '\nwaiting for your shadePixel'),
      )
    },
  })

  widget.handles.push({
    getScreen: () => {
      const c = padCenter(widget)
      return v2.vec2(c.x + light.x * PAD_R, c.y - light.y * PAD_R)
    },
    onDrag: (s) => {
      const c = padCenter(widget)
      let px = (s.x - c.x) / PAD_R
      let py = (c.y - s.y) / PAD_R
      const rr = px * px + py * py
      if (rr > 0.999) {
        const f = Math.sqrt(0.999 / rr)
        px *= f
        py *= f
      }
      light = v3.vec3(px, py, Math.sqrt(Math.max(0, 1 - px * px - py * py)))
      dirty = true
    },
    radius: 18,
  })

  const setHud = hud(container)

  const bar = controlsBar(container)
  const setMode = (m: typeof mode) => () => {
    mode = m
    dirty = true
    widget.requestDraw()
  }
  bar.button({ label: 'shaded', primary: true, onClick: setMode('shaded') })
  bar.button({ label: 'diffuse only', onClick: setMode('diffuse') })
  bar.button({ label: 'normals (debug)', onClick: setMode('normals') })

  widgetNote(
    container,
    '128 × 128 pixels, re-shaded only when the light or your code changes; each pixel is one call to your <code>shadePixel(x, y, L)</code> (or <code>diffuse</code> / <code>sphereNormal</code> in the other views). The normals view maps (n + 1)/2 to RGB — the debug rainbow every engine ships.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      dirty = true
      widget.requestDraw()
    },
  }
}

/* ------------------------------------------------------------------------ */

export const M02_WIDGETS: Record<string, WidgetFactory> = {
  'dot-meter': dotMeter,
  'axis-reader': axisReader,
  'split-lab': splitLab,
  'ramp-split': rampSplit,
  'quake-legs': quakeLegs,
  'guard-duty': guardDuty,
  'cross-3d': cross3d,
  'turn-signal': turnSignal,
  'plane-swarm': planeSwarm,
  'the-bouncer': theBouncer,
  'laser-bounce': laserBounce,
  'shaded-sphere': shadedSphere,
}
