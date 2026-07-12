/**
 * Module 1 widgets — Vectors.
 *
 * House style (established by tipToTail, the course's first widget):
 *  - factory receives the mount container, returns { setUserFns } when the
 *    widget is driven by an exercise
 *  - never trust learner return values: guard with isVec2/isVec3 etc.
 *  - widgets must look alive (and explain themselves) before any code runs
 */

import { v2, v3, type Vec2, type Vec3 } from '@/math'
import {
  CanvasWidget,
  Viewport2D,
  worldHandle,
  Camera3D,
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

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */

/** Call a learner function without letting a throw kill the frame. */
function safe<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1)
}

function rot2(v: Vec2, a: number): Vec2 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return v2.vec2(v.x * c - v.y * s, v.x * s + v.y * c)
}

function centerText(
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
  text: string,
  color: string,
  px = 15,
): void {
  ctx.save()
  ctx.font = MONO_FONT.replace('12px', `${px}px`)
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, size.width / 2, size.height / 2)
  ctx.restore()
}

function label3(
  ctx: CanvasRenderingContext2D,
  cam: Camera3D,
  size: { width: number; height: number },
  p: Vec3,
  text: string,
  color: string,
  dx = 8,
  dy = -8,
): void {
  const s = cam.toScreen(p, size)
  if (s) draw.drawLabel(ctx, text, v2.vec2(s.x + dx, s.y + dy), color)
}

/**
 * Vector playground (§1.1, not exercise-driven). One arrow, two handles:
 * the head reshapes the vector, the tail just relocates it — the (x, y)
 * readout never notices, because a displacement has no home address.
 */
const vectorPlayground: WidgetFactory = (container) => {
  let tail = v2.vec2(-4, -2)
  let vec = v2.vec2(5, 3)

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 320,
    draw(ctx, w) {
      draw.grid2(ctx, vp, w)
      const head = v2.add(tail, vec)
      const corner = v2.vec2(head.x, tail.y)

      // x-run / y-rise staircase
      draw.line2(ctx, vp, tail, corner, { color: COLORS.red, width: 1.5, dash: [5, 4] })
      draw.line2(ctx, vp, corner, head, { color: COLORS.green, width: 1.5, dash: [5, 4] })
      const mRun = vp.toScreen(v2.lerp(tail, corner, 0.5))
      const mRise = vp.toScreen(v2.lerp(corner, head, 0.5))
      draw.drawLabel(ctx, `x: ${fmt(vec.x)}`, v2.vec2(mRun.x - 16, mRun.y + 15), COLORS.red)
      draw.drawLabel(ctx, `y: ${fmt(vec.y)}`, v2.vec2(mRise.x + 9, mRise.y), COLORS.green)

      draw.arrow2(ctx, vp, tail, head, { color: COLORS.accent, width: 2.5 })
      draw.point2(ctx, vp, tail, { color: COLORS.yellow, r: 6, label: 'tail' })

      setHud(`v = (${fmt(vec.x)}, ${fmt(vec.y)})\nsame v wherever the tail sits`)
    },
  })

  const vp = new Viewport2D(widget, { unitsHigh: 12 })
  const setHud = hud(container)

  widget.handles.push(
    worldHandle(vp, () => v2.add(tail, vec), (p) => {
      vec = v2.sub(p, tail)
    }),
    worldHandle(vp, () => tail, (p) => {
      tail = p
    }),
  )

  widgetNote(
    container,
    'Drag the <b>arrowhead</b> to reshape the vector; drag the <b>yellow tail</b> to move the whole arrow. ' +
      'The (x, y) readout ignores the tail completely — a displacement has no home address.',
  )
}

/**
 * Tip-to-tail rover (drives: 01/add). The rover walks a, then b. The flag is
 * planted wherever the learner's add(a, b) says the journey ends — wrong code
 * puts the flag somewhere the rover visibly never reaches.
 */
const tipToTail: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let a = v2.vec2(3, 2)
  let b = v2.vec2(2, -3)
  let t = 0 // rover progress, 0..2 (one unit per leg)
  let showGhost = false

  const widget = new CanvasWidget(container, {
    mode: 'animated',
    height: 340,
    update(dt) {
      t = (t + dt * 0.6) % 2.4 // brief pause at the end of the loop
    },
    draw(ctx, w) {
      draw.grid2(ctx, vp, w)

      const head = v2.add(a, b) // reference chain for drawing the path
      draw.arrow2(ctx, vp, v2.vec2(0, 0), a, { color: COLORS.accent, label: 'a' })
      draw.arrow2(ctx, vp, a, head, { color: COLORS.green, label: 'b' })

      // Learner's claim about where the journey ends.
      const userSum = userFns ? userFns.add(a, b) : null
      if (isVec2(userSum)) {
        drawFlag(ctx, vp.toScreen(userSum), COLORS.yellow)
        draw.drawLabel(ctx, 'your add(a, b)', v2.add(vp.toScreen(userSum), v2.vec2(10, 4)), COLORS.yellow)
      }
      if (showGhost || !userFns) {
        draw.point2(ctx, vp, head, {
          color: COLORS.ghost,
          r: 4,
          label: showGhost ? 'reference a+b' : undefined,
        })
      }

      // Rover: walks leg a, then leg b.
      const progress = Math.min(t, 2)
      const pos =
        progress <= 1
          ? v2.lerp(v2.vec2(0, 0), a, progress)
          : v2.lerp(a, head, progress - 1)
      draw.point2(ctx, vp, pos, { color: COLORS.red, r: 6 })

      setHud(
        `a = (${a.x.toFixed(1)}, ${a.y.toFixed(1)})   b = (${b.x.toFixed(1)}, ${b.y.toFixed(1)})` +
          (isVec2(userSum)
            ? `\nyour add → (${userSum.x.toFixed(1)}, ${userSum.y.toFixed(1)})`
            : '\nsolve the exercise to plant your flag'),
      )
    },
  })

  const vp = new Viewport2D(widget, { unitsHigh: 12 })
  const setHud = hud(container)

  widget.handles.push(
    worldHandle(vp, () => a, (p) => (a = p)),
    worldHandle(vp, () => v2.add(a, b), (p) => (b = v2.sub(p, a))),
  )

  const bar = controlsBar(container)
  bar.toggle({ label: 'show reference a+b', onChange: (on) => (showGhost = on) })

  return {
    setUserFns(fns: UserFns | null) {
      userFns = fns
    },
  }
}

function drawFlag(ctx: CanvasRenderingContext2D, at: Vec2, color: string): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(at.x, at.y)
  ctx.lineTo(at.x, at.y - 18)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(at.x, at.y - 18)
  ctx.lineTo(at.x + 12, at.y - 14)
  ctx.lineTo(at.x, at.y - 10)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * Turret (drives: 01/sub). The barrel aims along the learner's
 * sub(mouse, turretPos). Swapped arguments aim it exactly backwards —
 * the bug is the demo.
 */
const turret: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let sweep = 0
  let aim = v2.vec2(1, 0) // unit barrel direction; persists through degenerate input
  const turretPos = v2.vec2(0, -0.5)

  const widget = new CanvasWidget(container, {
    mode: 'animated',
    height: 320,
    update(dt) {
      sweep += dt
    },
    draw(ctx, w) {
      draw.grid2(ctx, vp, w)

      const fns = userFns
      const mouse = w.pointer ? vp.toWorld(w.pointer) : null
      let status: string

      if (mouse) {
        const raw = fns ? safe(() => fns.sub(mouse, turretPos)) : v2.sub(mouse, turretPos)
        if (isVec2(raw)) {
          const dir = v2.normalize(raw)
          if (dir.x !== 0 || dir.y !== 0) aim = dir
          status = fns
            ? `your sub(mouse, turret) = (${fmt(raw.x)}, ${fmt(raw.y)})`
            : 'reference sub — yours takes over when 01/sub passes'
        } else {
          aim = rot2(v2.vec2(1, 0), sweep * 0.9)
          status = 'your sub returned something that is not a Vec2 — idle sweep'
        }
        draw.line2(ctx, vp, turretPos, mouse, { color: COLORS.ghost, width: 1, dash: [4, 5] })
        draw.point2(ctx, vp, mouse, { color: COLORS.red, r: 5, label: 'mouse' })
      } else {
        aim = rot2(v2.vec2(1, 0), sweep * 0.9)
        status = 'move the pointer over the range — the turret tracks it'
      }

      // barrel + base
      const muzzle = v2.add(turretPos, v2.scale(aim, 2.4))
      draw.line2(ctx, vp, turretPos, muzzle, { color: COLORS.accent, width: 7 })
      const base = vp.toScreen(turretPos)
      ctx.save()
      ctx.fillStyle = COLORS.grid
      ctx.strokeStyle = COLORS.accent
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(base.x, base.y, 15, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()

      setHud(status)
    },
  })

  const vp = new Viewport2D(widget, { unitsHigh: 11 })
  const setHud = hud(container)

  widgetNote(
    container,
    'Once your code drives it, deliberately swap the arguments — <code>sub(turretPos, mouse)</code> — ' +
      'and rerun: the turret aims exactly backwards. Every gameplay programmer ships that bug once; ' +
      'cheaper to ship it here.',
  )

  return {
    setUserFns(fns: UserFns | null) {
      userFns = fns
    },
  }
}

/**
 * Scale & length tape-measure (drives: 01/scale-length). Draggable vector,
 * a scale slider, and the dashed right triangle behind length — run, rise,
 * hypotenuse — with live numbers from the learner's functions.
 */
const scaleLength: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let base = v2.vec2(2.5, 1.5)
  let s = 1.5

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 340,
    draw(ctx, w) {
      draw.grid2(ctx, vp, w)
      const O = v2.vec2(0, 0)
      const fns = userFns

      const svUser = fns ? safe(() => fns.scale(base, s)) : undefined
      const svOk = isVec2(svUser)
      const sv = svOk ? svUser : v2.scale(base, s)

      const lenUser = fns ? safe(() => fns.length(sv)) : undefined
      const lenOk = isFiniteNumber(lenUser)
      const len = lenOk ? lenUser : v2.length(sv)

      const sqUser = fns ? safe(() => fns.lengthSq(sv)) : undefined
      const sqOk = isFiniteNumber(sqUser)
      const sq = sqOk ? sqUser : v2.lengthSq(sv)

      // tape-measure staircase for the scaled vector
      const corner = v2.vec2(sv.x, 0)
      draw.line2(ctx, vp, O, corner, { color: COLORS.red, width: 1.5, dash: [5, 4] })
      draw.line2(ctx, vp, corner, sv, { color: COLORS.green, width: 1.5, dash: [5, 4] })
      // Each leg label sits on the leg's outer side — which flips with the sign of
      // sv, since a negative s puts the triangle in the opposite quadrant.
      const mRun = vp.toScreen(v2.lerp(O, corner, 0.5))
      const mRise = vp.toScreen(v2.lerp(corner, sv, 0.5))
      const runText = `x: ${fmt(sv.x)}`
      const riseText = `y: ${fmt(sv.y)}`
      ctx.font = draw.MONO_FONT
      const runAt = v2.vec2(
        mRun.x - ctx.measureText(runText).width / 2,
        mRun.y + (sv.y >= 0 ? 15 : -15),
      )
      const riseAt = v2.vec2(
        sv.x >= 0 ? mRise.x + 9 : mRise.x - 9 - ctx.measureText(riseText).width,
        mRise.y,
      )
      draw.drawLabel(ctx, runText, runAt, COLORS.red)
      draw.drawLabel(ctx, riseText, riseAt, COLORS.green)

      // base vector (draggable) under the scaled one
      draw.arrow2(ctx, vp, O, base, { color: COLORS.ghost, width: 2, label: 'v' })
      draw.point2(ctx, vp, base, { color: COLORS.fg, r: 4 })
      draw.arrow2(ctx, vp, O, sv, { color: COLORS.accent, width: 2.5 })

      // Both of these labels annotate the same arrow, so they get their own
      // territory: the name sits past the arrowhead, the length rides the shaft
      // (rotated, on the triangle's inside, where it crosses nothing).
      const tail = vp.toScreen(O)
      const head = vp.toScreen(sv)
      const dir = v2.normalize(v2.sub(head, tail))
      const halfName = ctx.measureText('scale(v, s)').width / 2
      // Push off the tip far enough that the label's own box clears it, whichever
      // way the arrow points — its half-width matters when the arrow runs sideways,
      // its half-height when the arrow runs up or down.
      const clear = 12 + halfName * Math.abs(dir.x) + 7 * Math.abs(dir.y)
      const at = v2.add(head, v2.scale(dir, clear))
      draw.drawLabel(ctx, 'scale(v, s)', v2.vec2(at.x - halfName, at.y), COLORS.accent)

      // Drop the number (the HUD still has it) when the shaft is too short to
      // carry the full string, and the whole label once even the formula won't fit.
      const shaft = v2.length(v2.sub(head, tail))
      const withNum = `√(x²+y²) = ${len.toFixed(2)}`
      const lenText = ctx.measureText(withNum).width + 16 < shaft ? withNum : '√(x²+y²)'
      if (ctx.measureText(lenText).width < shaft) {
        draw.drawLabelAlong(ctx, lenText, tail, head, {
          offset: 13,
          toward: vp.toScreen(corner),
          color: COLORS.yellow,
        })
      }

      const tag = (ok: boolean) => (fns && ok ? '' : ' (reference)')
      setHud(
        `v = (${fmt(base.x)}, ${fmt(base.y)})   s = ${s.toFixed(1)}\n` +
          `scale(v, s) = (${fmt(sv.x)}, ${fmt(sv.y)})${tag(svOk)}\n` +
          `length = ${len.toFixed(2)}${tag(lenOk)}   lengthSq = ${sq.toFixed(2)}${tag(sqOk)}`,
      )
    },
  })

  const vp = new Viewport2D(widget, { unitsHigh: 12 })
  const setHud = hud(container)

  widget.handles.push(
    worldHandle(vp, () => base, (p) => {
      base = p
    }),
  )

  const bar = controlsBar(container)
  bar.slider({
    label: 's',
    min: -3,
    max: 3,
    step: 0.1,
    value: s,
    format: (v) => v.toFixed(1),
    onInput: (v) => {
      s = v
      widget.requestDraw()
    },
  })

  widgetNote(
    container,
    'Drag the arrowhead of <b>v</b>; slide <b>s</b> negative and watch the arrow flip 180° through its own tail. ' +
      'The dashed staircase is the right triangle behind <code>length</code> — run, rise, hypotenuse.',
  )

  return {
    setUserFns(fns: UserFns | null) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/**
 * Box diagonal (§1.3, not exercise-driven). An orbitable 2×6×3 box whose
 * floor diagonal (√13) and space diagonal (7) show Pythagoras nesting —
 * the first appearance of the project3() black box.
 */
const boxDiagonal: WidgetFactory = (container) => {
  const cam = new Camera3D({ yaw: 0.85, pitch: 0.38, dist: 13, target: v3.vec3(0, 2.6, 0), focal: 1.15 })

  // box: 2 wide (x), 6 tall (y), 3 deep (z) → floor diag √13, space diag 7
  const lo = v3.vec3(-1, 0, -1.5)
  const hi = v3.vec3(1, 6, 1.5)
  const A = v3.vec3(lo.x, 0, lo.z) // start corner
  const B = v3.vec3(hi.x, 0, lo.z) // after the x-run
  const F = v3.vec3(hi.x, 0, hi.z) // after the z-run (floor corner)
  const G = v3.vec3(hi.x, hi.y, hi.z) // up to the opposite corner

  const corners: Vec3[] = []
  for (let i = 0; i < 8; i++) {
    corners.push(v3.vec3(i & 1 ? hi.x : lo.x, i & 2 ? hi.y : lo.y, i & 4 ? hi.z : lo.z))
  }

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 380,
    draw(ctx, w) {
      draw.grid3(ctx, cam, w, { extent: 5 })

      // box edges, ghosted
      for (let i = 0; i < 8; i++) {
        for (const bit of [1, 2, 4]) {
          if ((i & bit) === 0) {
            draw.line3(ctx, cam, w, corners[i], corners[i | bit], { color: COLORS.ghost, width: 1 })
          }
        }
      }

      // triangle 1, flat on the floor: x-run, z-run, floor diagonal
      draw.line3(ctx, cam, w, A, B, { color: COLORS.red, width: 2 })
      draw.line3(ctx, cam, w, B, F, { color: COLORS.accent, width: 2 })
      draw.line3(ctx, cam, w, A, F, { color: COLORS.yellow, width: 2, dash: [6, 5] })
      // triangle 2, standing on the floor diagonal: rise + space diagonal
      draw.line3(ctx, cam, w, F, G, { color: COLORS.green, width: 2 })
      draw.line3(ctx, cam, w, A, G, { color: COLORS.purple, width: 2.5 })

      label3(ctx, cam, w, v3.lerp(A, B, 0.5), 'x = 2', COLORS.red, -16, 16)
      label3(ctx, cam, w, v3.lerp(B, F, 0.5), 'z = 3', COLORS.accent, 10, 12)
      label3(ctx, cam, w, v3.lerp(A, F, 0.6), '√(2²+3²) = √13', COLORS.yellow, 8, 18)
      label3(ctx, cam, w, v3.lerp(F, G, 0.5), 'y = 6', COLORS.green, 10, 0)
      label3(ctx, cam, w, v3.lerp(A, G, 0.45), '√(13 + 6²) = 7', COLORS.purple, -118, -10)

      draw.point3(ctx, cam, w, A, { color: COLORS.fg, r: 0.08 })
      draw.point3(ctx, cam, w, G, { color: COLORS.purple, r: 0.08 })
    },
  })

  cam.attachOrbit(widget)

  widgetNote(
    container,
    '<b>Drag to orbit.</b> The yellow floor diagonal is one right triangle (√(x²+z²)); ' +
      'it becomes a leg of a second triangle whose hypotenuse is the purple space diagonal: ' +
      '√(x²+z²+y²) = √(4+9+36) = 7. Pythagoras, applied twice.',
  )
}

/**
 * Heat seeker (drives: 01/normalize). A missile chases a fleeing target at
 * constant speed via scale(normalize(sub(target, pos)), SPEED). The toggle
 * removes the normalize; an exact catch demonstrates the NaN at zero.
 */
const heatSeeker: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let buggy = false
  let missile = v2.vec2(-6, -3)
  let nose = v2.vec2(1, 0)
  let targetPos = v2.vec2(4, 2)
  let tvel = v2.vec2(2.4, 1.1)
  let tClock = 0
  let flash = 0
  let flashText = ''
  let flashColor = COLORS.red
  let badNormalize = false
  let trail: Vec2[] = []

  const SPEED = 5.2
  const TSPEED = 3.4
  // Half-extents of the play area. BX is clamped to whatever the live canvas can
  // actually show (narrow viewports get a narrower arena) so the target never
  // bounces off an invisible wall past the right edge; recomputed each frame.
  let BX = 6.6
  const BY = 4.4

  const flashMsg = (text: string, color: string) => {
    flash = 1.8
    flashText = text
    flashColor = color
  }

  const respawn = () => {
    // far corner, diagonally opposite the target
    missile = v2.vec2(-Math.sign(targetPos.x || 1) * (BX - 0.4), -Math.sign(targetPos.y || 1) * (BY - 0.4))
    trail = []
  }

  const widget = new CanvasWidget(container, {
    mode: 'animated',
    height: 360,
    update(dt) {
      tClock += dt
      flash = Math.max(0, flash - dt)
      badNormalize = false
      // Keep the arena inside the visible canvas (leave a small margin for the
      // dashed border drawn at BX + 0.4); never wider than the 6.6 design bound.
      BX = Math.min(6.6, widget.width / (2 * vp.scale) - 0.6)
      const fns = userFns

      // --- target: smooth wander + flee + wall bounce ---
      const wobble = Math.sin(tClock * 0.9) * 1.5 + Math.sin(tClock * 2.27 + 1.3) * 0.9
      tvel = rot2(tvel, wobble * dt)
      const fromMissile = v2.sub(targetPos, missile)
      const gap = v2.length(fromMissile)
      if (gap < 3.5 && gap > 1e-9) {
        tvel = v2.add(tvel, v2.scale(v2.normalize(fromMissile), 8 * dt))
      }
      tvel = v2.scale(v2.normalize(tvel), TSPEED)
      targetPos = v2.add(targetPos, v2.scale(tvel, dt))
      if (Math.abs(targetPos.x) > BX) {
        targetPos = v2.vec2(Math.sign(targetPos.x) * BX, targetPos.y)
        tvel = v2.vec2(-tvel.x, tvel.y)
      }
      if (Math.abs(targetPos.y) > BY) {
        targetPos = v2.vec2(targetPos.x, Math.sign(targetPos.y) * BY)
        tvel = v2.vec2(tvel.x, -tvel.y)
      }

      // --- missile ---
      // sub and scale come from the reference lib; normalize is the learner's.
      let toTarget = v2.sub(targetPos, missile)
      let caught = false
      if (v2.length(toTarget) < 0.2) {
        missile = v2.vec2(targetPos.x, targetPos.y) // exact overlap →
        toTarget = v2.vec2(0, 0) //                    sub gives exactly (0,0)
        caught = true
      }

      let vel = v2.vec2(0, 0)
      if (buggy) {
        vel = toTarget // "speed" = distance: sprints when far, crawls when near
        if (caught) {
          flashMsg('caught — eventually. the last meter took forever', COLORS.yellow)
          respawn()
        }
      } else if (fns) {
        const n = safe(() => fns.normalize(toTarget))
        if (isVec2(n)) {
          vel = v2.scale(n, SPEED)
          if (caught) {
            flashMsg('caught! normalize(0,0) → (0,0) — your guard held', COLORS.green)
            respawn()
            vel = v2.vec2(0, 0)
          }
        } else if (caught) {
          flashMsg('your missile dissolved into NaN — normalize(0,0) divided by zero', COLORS.red)
          respawn()
        } else {
          badNormalize = true
          vel = v2.scale(v2.normalize(toTarget), SPEED)
        }
      } else {
        // reference path — deliberately UNGUARDED, to show why the policy exists
        const L = v2.length(toTarget)
        if (caught || L === 0) {
          flashMsg('the missile dissolved into NaN — normalize(0,0) divided by zero', COLORS.red)
          respawn()
        } else {
          vel = v2.scale(toTarget, SPEED / L)
        }
      }

      missile = v2.add(missile, v2.scale(vel, dt))
      if (vel.x !== 0 || vel.y !== 0) nose = v2.normalize(vel)
      trail.push(missile)
      if (trail.length > 60) trail.shift()
    },
    draw(ctx, w) {
      draw.grid2(ctx, vp, w)
      const fns = userFns

      // arena bounds
      const tl = v2.vec2(-BX - 0.4, BY + 0.4)
      const br = v2.vec2(BX + 0.4, -BY - 0.4)
      draw.line2(ctx, vp, tl, v2.vec2(br.x, tl.y), { color: COLORS.axis, width: 1, dash: [3, 5] })
      draw.line2(ctx, vp, v2.vec2(br.x, tl.y), br, { color: COLORS.axis, width: 1, dash: [3, 5] })
      draw.line2(ctx, vp, br, v2.vec2(tl.x, br.y), { color: COLORS.axis, width: 1, dash: [3, 5] })
      draw.line2(ctx, vp, v2.vec2(tl.x, br.y), tl, { color: COLORS.axis, width: 1, dash: [3, 5] })

      // missile trail, fading
      for (let i = 0; i < trail.length; i++) {
        const sp = vp.toScreen(trail[i])
        ctx.fillStyle = `rgba(86, 182, 194, ${(0.35 * i) / trail.length})`
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, 2, 0, Math.PI * 2)
        ctx.fill()
      }

      draw.point2(ctx, vp, targetPos, { color: COLORS.red, r: 7, label: 'target' })
      draw.point2(ctx, vp, missile, { color: COLORS.cyan, r: 6 })
      draw.line2(ctx, vp, missile, v2.add(missile, v2.scale(nose, 0.6)), {
        color: COLORS.cyan,
        width: 3,
      })

      const dUser = fns ? safe(() => fns.distance(missile, targetPos)) : undefined
      const dOk = isFiniteNumber(dUser)
      const dist = dOk ? dUser : v2.distance(missile, targetPos)

      const modeLine = buggy
        ? 'normalize removed: vel = sub(target, missile) — speed equals distance'
        : fns
          ? badNormalize
            ? 'your normalize returned a non-Vec2 — reference steering until it heals'
            : `steering: scale(your normalize(sub(target, missile)), ${SPEED})`
          : 'reference normalize (unguarded!) — yours takes over when 01/normalize passes'
      setHud(`${modeLine}\ndistance${dOk ? '' : ' (reference)'} = ${dist.toFixed(2)}`)

      if (flash > 0) {
        centerText(ctx, w, flashText, flashColor, 16)
      }
    },
  })

  const vp = new Viewport2D(widget, { unitsHigh: 11 })
  const setHud = hud(container)

  const bar = controlsBar(container)
  bar.toggle({
    label: 'remove the normalize (the classic bug)',
    onChange: (on) => {
      buggy = on
    },
  })

  widgetNote(
    container,
    'Without the normalize, the missile\'s speed <em>equals its distance</em>: it sprints across the arena ' +
      'and then tip-toes the last meter. Put the normalize back and it flies at one constant speed. ' +
      'When it catches the target exactly, <code>sub</code> returns (0,0) — and an unguarded normalize divides by zero.',
  )

  return {
    setUserFns(fns: UserFns | null) {
      userFns = fns
    },
  }
}

/**
 * Chase cam (drives: 01/lerp). Two strips, one canvas: a hard-locked camera
 * on top, a learner-lerp follower below, with 20/60/144 fps simulated as
 * fixed-timestep accumulators inside the single rAF loop. Plain per-frame
 * lerp lags differently at each rate; damp does not.
 */
const chaseCam: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let simFps = 60
  let useDamp = false
  let t = 0
  let acc = 0
  let camN = 0 // follower position, normalized [-1, 1]
  let badFn = false

  const RATE = 7
  const SPAN = 0.36 // sweep amplitude as a fraction of canvas width

  const targetN = (time: number) => Math.sin(time * 0.85) * 0.78 + Math.sin(time * 2.13) * 0.22

  new CanvasWidget(container, {
    mode: 'animated',
    height: 300,
    update(dt) {
      t += dt
      acc += dt
      const step = 1 / simFps
      const fns = userFns
      let guard = 0
      while (acc >= step && guard++ < 16) {
        acc -= step
        const a = v2.vec2(camN, 0)
        const b = v2.vec2(targetN(t - acc), 0)
        let next: unknown
        if (fns) {
          next = useDamp ? safe(() => fns.damp(a, b, RATE, step)) : safe(() => fns.lerp(a, b, 0.1))
        } else {
          next = useDamp ? v2.damp(a, b, RATE, step) : v2.lerp(a, b, 0.1)
        }
        if (isVec2(next)) {
          camN = next.x
          badFn = false
        } else {
          badFn = true
          camN = (useDamp ? v2.damp(a, b, RATE, step) : v2.lerp(a, b, 0.1)).x
        }
      }
      if (acc > 1) acc = 0 // tab was hidden; drop the backlog
    },
    draw(ctx, w) {
      const yTop = w.height * 0.32
      const yBot = w.height * 0.74
      const cx = w.width / 2
      const span = w.width * SPAN
      const tx = cx + targetN(t) * span
      const fx = cx + camN * span

      // rails
      ctx.save()
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 1
      for (const y of [yTop, yBot]) {
        ctx.beginPath()
        ctx.moveTo(14, y)
        ctx.lineTo(w.width - 14, y)
        ctx.stroke()
      }
      ctx.strokeStyle = COLORS.axis
      ctx.beginPath()
      ctx.moveTo(0, w.height / 2 + 8)
      ctx.lineTo(w.width, w.height / 2 + 8)
      ctx.stroke()
      ctx.restore()

      const ring = (x: number, y: number, color: string) => {
        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x, y, 11, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
      const dot = (x: number, y: number, color: string) => {
        ctx.save()
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // top strip: hard lock — camera IS the target
      ring(tx, yTop, COLORS.dim)
      dot(tx, yTop, COLORS.green)
      draw.drawLabel(ctx, 'hard lock — camera = target', v2.vec2(14, yTop - 30), COLORS.dim)

      // bottom strip: follower
      ring(tx, yBot, COLORS.dim)
      dot(fx, yBot, COLORS.accent)
      const lagPx = Math.abs(tx - fx)
      ctx.save()
      ctx.strokeStyle = COLORS.yellow
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(fx, yBot + 20)
      ctx.lineTo(tx, yBot + 20)
      ctx.stroke()
      ctx.restore()
      draw.drawLabel(ctx, `lag ${lagPx.toFixed(0)} px`, v2.vec2(Math.min(tx, fx), yBot + 34), COLORS.yellow)
      draw.drawLabel(
        ctx,
        `${useDamp ? `damp(cam, target, ${RATE}, dt)` : 'lerp(cam, target, 0.1) per frame'} @ ${simFps} fps simulated`,
        v2.vec2(14, yBot - 30),
        COLORS.dim,
      )

      setHud(
        userFns
          ? badFn
            ? 'your lerp/damp returned a non-Vec2 — reference shown'
            : `running on your ${useDamp ? 'damp' : 'lerp'}`
          : 'reference lerp — yours takes over when 01/lerp passes',
      )
    },
  })

  const setHud = hud(container)
  const bar = controlsBar(container)
  const fpsValues = [20, 60, 144]
  const fpsButtons = fpsValues.map((f) =>
    bar.button({
      label: `${f} fps`,
      onClick: () => {
        simFps = f
        mark()
      },
    }),
  )
  const mark = () => {
    fpsValues.forEach((f, i) => fpsButtons[i].classList.toggle('primary', f === simFps))
  }
  mark()
  bar.toggle({
    label: 'use damp (frame-rate independent)',
    onChange: (on) => {
      useDamp = on
    },
  })

  widgetNote(
    container,
    'Click through 20 → 60 → 144. With <code>lerp(cam, target, 0.1)</code> per frame, the follower lags ' +
      'by a different amount at every frame rate — same code, different game on different machines. ' +
      'Flip on <b>damp</b> and the lag is identical at all three.',
  )

  return {
    setUserFns(fns: UserFns | null) {
      userFns = fns
    },
  }
}

/**
 * Bézier figure (§1.5, static, not exercise-driven). A quadratic Bézier as
 * nested lerps, with the construction shown frozen at t = 0.35.
 */
const bezierFigure: WidgetFactory = (container) => {
  const P0 = v2.vec2(-4, -2)
  const P1 = v2.vec2(0, 3.2)
  const P2 = v2.vec2(4.2, -1.4)
  const T = 0.35

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 300,
    draw(ctx, w) {
      draw.grid2(ctx, vp, w)

      // control polygon
      draw.line2(ctx, vp, P0, P1, { color: COLORS.ghost, width: 1, dash: [5, 4] })
      draw.line2(ctx, vp, P1, P2, { color: COLORS.ghost, width: 1, dash: [5, 4] })

      // the curve: lerp of lerps, sampled
      ctx.save()
      ctx.strokeStyle = COLORS.accent
      ctx.lineWidth = 2.5
      ctx.beginPath()
      for (let i = 0; i <= 48; i++) {
        const u = i / 48
        const p = vp.toScreen(v2.lerp(v2.lerp(P0, P1, u), v2.lerp(P1, P2, u), u))
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
      ctx.restore()

      // construction at t = 0.35
      const A = v2.lerp(P0, P1, T)
      const B = v2.lerp(P1, P2, T)
      const C = v2.lerp(A, B, T)
      draw.line2(ctx, vp, A, B, { color: COLORS.green, width: 1.5 })
      draw.point2(ctx, vp, A, { color: COLORS.green, r: 4, label: 'A = lerp(P0, P1, t)' })
      draw.point2(ctx, vp, B, { color: COLORS.green, r: 4, label: 'B = lerp(P1, P2, t)' })
      draw.point2(ctx, vp, C, { color: COLORS.red, r: 5, label: 'lerp(A, B, t)' })
      draw.point2(ctx, vp, P0, { color: COLORS.fg, r: 4, label: 'P0' })
      draw.point2(ctx, vp, P1, { color: COLORS.fg, r: 4, label: 'P1' })
      draw.point2(ctx, vp, P2, { color: COLORS.fg, r: 4, label: 'P2' })
      draw.drawLabel(ctx, 't = 0.35', v2.vec2(14, w.height - 16), COLORS.dim)
    },
  })

  const vp = new Viewport2D(widget, { unitsHigh: 9 })

  widgetNote(
    container,
    'A quadratic Bézier: lerp along P0→P1, lerp along P1→P2, then lerp between those two moving points. ' +
      'Curves are not new math — just lerps of lerps.',
  )
}

/**
 * Comet (drives: 01/vec3). An orbitable scene: a point-cube whose corners
 * come from add3/scale3, and a comet riding lerp3 between waypoints with a
 * normalize3(sub3(...)) heading arrow — all through the learner's Vec3 fns.
 */
const comet: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let anyRef = false
  const cam = new Camera3D({ yaw: 0.7, pitch: 0.35, dist: 15, target: v3.vec3(0, 2, 0) })

  const WP = [v3.vec3(4.5, 1, 0.5), v3.vec3(-2, 4.5, 3.5), v3.vec3(-4.5, 1.2, -2.5), v3.vec3(2.5, 4, -4)]
  const CUBE_C = v3.vec3(0, 2.4, 0)
  const H = 1.15
  const SIGNS: Vec3[] = []
  for (let i = 0; i < 8; i++) {
    SIGNS.push(v3.vec3(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1))
  }

  let seg = 0
  let segT = 0
  let pos = WP[0]
  let head = v3.vec3(1, 0, 0)
  let trail: Vec3[] = []

  const uAdd3 = (a: Vec3, b: Vec3): Vec3 => {
    const fns = userFns
    if (fns) {
      const r = safe(() => fns.add3(a, b))
      if (isVec3(r)) return r
      anyRef = true
    }
    return v3.add(a, b)
  }
  const uSub3 = (a: Vec3, b: Vec3): Vec3 => {
    const fns = userFns
    if (fns) {
      const r = safe(() => fns.sub3(a, b))
      if (isVec3(r)) return r
      anyRef = true
    }
    return v3.sub(a, b)
  }
  const uScale3 = (v: Vec3, s: number): Vec3 => {
    const fns = userFns
    if (fns) {
      const r = safe(() => fns.scale3(v, s))
      if (isVec3(r)) return r
      anyRef = true
    }
    return v3.scale(v, s)
  }
  const uNormalize3 = (v: Vec3): Vec3 => {
    const fns = userFns
    if (fns) {
      const r = safe(() => fns.normalize3(v))
      if (isVec3(r)) return r
      anyRef = true
    }
    return v3.normalize(v)
  }
  const uLerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => {
    const fns = userFns
    if (fns) {
      const r = safe(() => fns.lerp3(a, b, t))
      if (isVec3(r)) return r
      anyRef = true
    }
    return v3.lerp(a, b, t)
  }
  const uDistance3 = (a: Vec3, b: Vec3): number => {
    const fns = userFns
    if (fns) {
      const r = safe(() => fns.distance3(a, b))
      if (isFiniteNumber(r)) return r
      anyRef = true
    }
    return v3.distance(a, b)
  }

  const widget = new CanvasWidget(container, {
    mode: 'animated',
    height: 400,
    update(dt) {
      anyRef = false
      segT += dt * 0.45
      if (segT >= 1) {
        segT -= 1
        seg = (seg + 1) % WP.length
      }
      const a = WP[seg]
      const b = WP[(seg + 1) % WP.length]
      const e = segT * segT * (3 - 2 * segT) // smoothstep eases the hops
      pos = uLerp3(a, b, e)
      const h = uNormalize3(uSub3(b, pos))
      if (v3.length(h) > 1e-9) head = h
      trail.push(pos)
      if (trail.length > 80) trail.shift()
    },
    draw(ctx, w) {
      draw.grid3(ctx, cam, w, { extent: 5 })
      draw.axes3(ctx, cam, w, 2)

      // waypoint circuit
      for (let i = 0; i < WP.length; i++) {
        draw.line3(ctx, cam, w, WP[i], WP[(i + 1) % WP.length], {
          color: COLORS.ghost,
          width: 1,
          dash: [4, 6],
        })
        draw.point3(ctx, cam, w, WP[i], { color: COLORS.yellow, r: 0.06, label: `W${i}` })
      }

      // point-cube: corners via add3(center, scale3(sign, H))
      const corners = SIGNS.map((sgn) => uAdd3(CUBE_C, uScale3(sgn, H)))
      for (let i = 0; i < 8; i++) {
        for (const bit of [1, 2, 4]) {
          if ((i & bit) === 0) {
            draw.line3(ctx, cam, w, corners[i], corners[i | bit], { color: COLORS.ghost, width: 1 })
          }
        }
      }
      for (const c of corners) draw.point3(ctx, cam, w, c, { color: COLORS.cyan, r: 0.06 })

      // comet trail, fading
      for (let i = 0; i < trail.length; i++) {
        const pr = cam.project3(trail[i], w)
        if (!pr) continue
        ctx.fillStyle = `rgba(229, 192, 123, ${(0.4 * i) / trail.length})`
        ctx.beginPath()
        ctx.arc(pr.x, pr.y, Math.max(1, 0.035 * pr.scale), 0, Math.PI * 2)
        ctx.fill()
      }

      // comet + heading arrow
      const next = WP[(seg + 1) % WP.length]
      draw.arrow3(ctx, cam, w, pos, uAdd3(pos, uScale3(head, 1.7)), { color: COLORS.red })
      draw.point3(ctx, cam, w, pos, { color: COLORS.yellow, r: 0.12 })

      const status = userFns
        ? anyRef
          ? 'some of your vec3 fns misbehaved — reference filling in'
          : 'flying on your add3 / sub3 / scale3 / normalize3 / lerp3'
        : 'reference math — solve 01/vec3 below to fly it yourself'
      setHud(
        `${status}\n` +
          `comet = lerp3(W${seg}, W${(seg + 1) % WP.length}, t)   ` +
          `distance3(comet, W${(seg + 1) % WP.length}) = ${uDistance3(pos, next).toFixed(2)}`,
      )
    },
  })

  const setHud = hud(container)
  cam.attachOrbit(widget)

  widgetNote(
    container,
    '<b>Drag to orbit.</b> The cube\'s 8 corners are <code>add3(center, scale3(corner, h))</code>; ' +
      'the comet rides <code>lerp3</code> between waypoints; its nose is ' +
      '<code>normalize3(sub3(next, pos))</code>. Break one function and watch which part of the scene falls apart.',
  )

  return {
    setUserFns(fns: UserFns | null) {
      userFns = fns
    },
  }
}

/**
 * Particle fountain (drives: 01/capstone-fountain). ~200-particle pool run
 * entirely by the learner's spawnParticle(speed) / updateParticle(p, g, dt).
 * No learner code → no fountain; this one has no reference fallback.
 */
interface Particle {
  pos: Vec3
  vel: Vec3
  age: number
}

function isParticle(p: unknown): p is Particle {
  if (typeof p !== 'object' || p === null) return false
  const q = p as Particle
  return isVec3(q.pos) && isVec3(q.vel) && isFiniteNumber(q.age)
}

const particleFountain: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  const cam = new Camera3D({ yaw: 0.7, pitch: 0.3, dist: 17, target: v3.vec3(0, 2.5, 0) })

  const MAX = 200
  const LIFETIME = 2.4
  const ORANGE = v3.vec3(230, 160, 60)
  const GRAY = v3.vec3(110, 115, 125)

  let pool: Particle[] = []
  let spawnAcc = 0
  let rate = 60
  let gravity = 9.8
  let speed = 7
  // Seconds left to keep showing each warning. A single bad return lights it for
  // ~3 s, then it fades — so fixing the code clears the message on its own
  // instead of latching it on screen until the next reveal/reset.
  let badSpawnT = 0
  let badUpdateT = 0
  const WARN_HOLD = 3

  const widget = new CanvasWidget(container, {
    mode: 'animated',
    height: 400,
    update(dt) {
      badSpawnT = Math.max(0, badSpawnT - dt)
      badUpdateT = Math.max(0, badUpdateT - dt)
      const fns = userFns
      if (!fns) {
        pool = []
        return
      }
      const g = v3.vec3(0, -gravity, 0)

      const next: Particle[] = []
      for (const p of pool) {
        const r = safe(() => fns.updateParticle(p, g, dt))
        if (isParticle(r)) {
          if (r.pos.y >= 0 && r.age <= LIFETIME) next.push(r)
        } else {
          badUpdateT = WARN_HOLD
        }
      }
      pool = next

      spawnAcc += rate * dt
      while (spawnAcc >= 1) {
        spawnAcc -= 1
        if (pool.length >= MAX) continue
        const s = safe(() => fns.spawnParticle(speed))
        if (isParticle(s)) {
          pool.push(s)
        } else {
          badSpawnT = WARN_HOLD
          spawnAcc = 0
          break
        }
      }
    },
    draw(ctx, w) {
      draw.grid3(ctx, cam, w, { extent: 6 })
      draw.axes3(ctx, cam, w, 1.5)

      // painter sort: far particles first
      const items = pool
        .map((p) => ({ p, pr: cam.project3(p.pos, w) }))
        .filter((i) => i.pr !== null)
      items.sort((a, b) => b.pr!.depth - a.pr!.depth)
      ctx.save()
      for (const { p, pr } of items) {
        const age = Math.min(1, Math.max(0, p.age / LIFETIME))
        const c = v3.lerp(ORANGE, GRAY, age)
        ctx.fillStyle = `rgb(${Math.round(c.x)}, ${Math.round(c.y)}, ${Math.round(c.z)})`
        ctx.beginPath()
        ctx.arc(pr!.x, pr!.y, Math.max(1.5, 0.07 * pr!.scale), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      if (!userFns) {
        centerText(ctx, w, 'solve the exercise below to start the fountain', COLORS.dim)
        setHud('waiting for your spawnParticle / updateParticle')
      } else {
        setHud(
          `${pool.length} particles alive — all of them running your code` +
            (badSpawnT > 0 ? '\nspawnParticle returned a non-particle — fix and rerun' : '') +
            (badUpdateT > 0 ? '\nupdateParticle returned a non-particle — fix and rerun' : ''),
        )
      }
    },
  })

  const setHud = hud(container)
  cam.attachOrbit(widget)

  const bar = controlsBar(container)
  bar.slider({
    label: 'spawn rate',
    min: 5,
    max: 150,
    step: 1,
    value: rate,
    format: (v) => `${v.toFixed(0)}/s`,
    onInput: (v) => {
      rate = v
    },
  })
  bar.slider({
    label: 'gravity',
    min: 0,
    max: 25,
    step: 0.1,
    value: gravity,
    format: (v) => v.toFixed(1),
    onInput: (v) => {
      gravity = v
    },
  })
  bar.slider({
    label: 'speed',
    min: 2,
    max: 14,
    step: 0.1,
    value: speed,
    format: (v) => v.toFixed(1),
    onInput: (v) => {
      speed = v
    },
  })

  widgetNote(
    container,
    '<b>Drag to orbit.</b> Particles spawn at the origin with |vel| = speed in a random direction, ' +
      'fall under gravity, and die at the floor or at 2.4 s — colored orange → gray by age ' +
      'via <code>lerp3</code>. Try gravity 0, then 25.',
  )

  return {
    setUserFns(fns: UserFns | null) {
      userFns = fns
      badSpawnT = 0
      badUpdateT = 0
    },
  }
}

export const M01_WIDGETS: Record<string, WidgetFactory> = {
  'vector-playground': vectorPlayground,
  'tip-to-tail': tipToTail,
  turret,
  'scale-length': scaleLength,
  'box-diagonal': boxDiagonal,
  'heat-seeker': heatSeeker,
  'chase-cam': chaseCam,
  'bezier-figure': bezierFigure,
  comet,
  'particle-fountain': particleFountain,
}
