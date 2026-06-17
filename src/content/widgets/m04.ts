/**
 * Module 4 widgets — Coordinate Spaces & the Camera.
 *
 * House style (see m03.ts): factories receive the mount container, return
 * { setUserFns } when exercise-driven, and NEVER trust learner return values
 * (guards from ./util). Every widget renders something sensible before any
 * learner code exists.
 *
 * The capstone "fly-the-camera" is a split view: a god's-eye orbit on the
 * left and the world as the learner's view matrix sees it on the right. The
 * right-panel projection (perspective divide) is the one black box left in
 * the course — you build it in Module 5.
 */

import { v2, v3, m4, cam } from '@/math'
import type { Vec2, Vec3, Mat4, Basis } from '@/math'
import {
  CanvasWidget,
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
import { isVec3, isNumberArray } from './util'

/* ------------------------------------------------------------------ */
/* shared guards + helpers                                             */
/* ------------------------------------------------------------------ */

const asM4 = (a: readonly number[]): Mat4 => a as Mat4

/** Call a learner function expected to return a flat matrix of `len` numbers. */
function callMat(
  fns: UserFns | null,
  name: string,
  args: readonly unknown[],
  len: number,
): number[] | null {
  const f = fns?.[name]
  if (typeof f !== 'function') return null
  try {
    const r = f(...args.map((a) => (Array.isArray(a) ? a.slice() : a)))
    return isNumberArray(r, len) ? r : null
  } catch {
    return null
  }
}

/** Call a learner function expected to return a Vec3, else null. */
function callVec3(fns: UserFns | null, name: string, args: readonly unknown[]): Vec3 | null {
  const f = fns?.[name]
  if (typeof f !== 'function') return null
  try {
    const r = f(...args)
    return isVec3(r) ? r : null
  } catch {
    return null
  }
}

/** Call a learner function expected to return an orthonormal Basis, else null. */
function callBasis(fns: UserFns | null, name: string, args: readonly unknown[]): Basis | null {
  const f = fns?.[name]
  if (typeof f !== 'function') return null
  try {
    const r = f(...args) as Basis
    return r && isVec3(r.right) && isVec3(r.up) && isVec3(r.fwd) ? r : null
  } catch {
    return null
  }
}

type Size = { width: number; height: number }
type Projector = (p: Vec3) => Vec2 | null

/* The course's canonical unit cube (half-extent 1), corners + edges. */
const CUBE_CORNERS: readonly Vec3[] = [...Array(8)].map((_, i) =>
  v3.vec3(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1),
)
const CUBE_EDGES: readonly [number, number][] = (() => {
  const edges: [number, number][] = []
  for (let i = 0; i < 8; i++) {
    for (const b of [1, 2, 4]) if (!(i & b)) edges.push([i, i | b])
  }
  return edges
})()

/** Project + stroke a cube whose corners are already in the projector's space. */
function wireCube(
  ctx: CanvasRenderingContext2D,
  project: Projector,
  corners: readonly Vec3[],
  opts: { color: string; width?: number; dash?: number[] },
): void {
  const pts = corners.map(project)
  ctx.save()
  ctx.strokeStyle = opts.color
  ctx.lineWidth = opts.width ?? 1
  if (opts.dash) ctx.setLineDash(opts.dash)
  for (const [a, b] of CUBE_EDGES) {
    const pa = pts[a]
    const pb = pts[b]
    if (!pa || !pb) continue
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
  }
  ctx.restore()
}

/** A line through any projector; lifts the pen on null (behind camera). */
function seg(
  ctx: CanvasRenderingContext2D,
  project: Projector,
  a: Vec3,
  b: Vec3,
  opts: { color: string; width?: number; dash?: number[] },
): void {
  const sa = project(a)
  const sb = project(b)
  if (!sa || !sb) return
  ctx.save()
  ctx.strokeStyle = opts.color
  ctx.lineWidth = opts.width ?? 1
  if (opts.dash) ctx.setLineDash(opts.dash)
  ctx.beginPath()
  ctx.moveTo(sa.x, sa.y)
  ctx.lineTo(sb.x, sb.y)
  ctx.stroke()
  ctx.restore()
}

/** An arrow head + shaft through any projector (screen-space head). */
function arrow(
  ctx: CanvasRenderingContext2D,
  project: Projector,
  from: Vec3,
  to: Vec3,
  opts: { color: string; width?: number; label?: string },
): void {
  const sa = project(from)
  const sb = project(to)
  if (!sa || !sb) return
  const d = v2.normalize(v2.sub(sb, sa))
  if (d.x === 0 && d.y === 0) return
  const head = 9
  const base = v2.sub(sb, v2.scale(d, head))
  const perp = v2.vec2(-d.y, d.x)
  ctx.save()
  ctx.strokeStyle = opts.color
  ctx.fillStyle = opts.color
  ctx.lineWidth = opts.width ?? 2
  ctx.beginPath()
  ctx.moveTo(sa.x, sa.y)
  ctx.lineTo(base.x, base.y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(sb.x, sb.y)
  ctx.lineTo(base.x + perp.x * head * 0.45, base.y + perp.y * head * 0.45)
  ctx.lineTo(base.x - perp.x * head * 0.45, base.y - perp.y * head * 0.45)
  ctx.closePath()
  ctx.fill()
  if (opts.label) draw.drawLabel(ctx, opts.label, v2.vec2(sb.x + 7, sb.y - 7), opts.color)
  ctx.restore()
}

function dot3pt(
  ctx: CanvasRenderingContext2D,
  project: Projector,
  p: Vec3,
  opts: { color: string; r?: number; label?: string },
): void {
  const s = project(p)
  if (!s) return
  ctx.save()
  ctx.fillStyle = opts.color
  ctx.beginPath()
  ctx.arc(s.x, s.y, opts.r ?? 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  if (opts.label) draw.drawLabel(ctx, opts.label, v2.vec2(s.x + 8, s.y - 8), opts.color)
}

/** The three local axes (columns of m) as a red/green/blue tripod. */
function tripod(
  ctx: CanvasRenderingContext2D,
  project: Projector,
  m: readonly number[],
  len: number,
  labels?: [string, string, string],
): void {
  const o = m4.transformPoint3(asM4(m), v3.vec3(0, 0, 0))
  const cols: [Vec3, string][] = [
    [v3.vec3(m[0], m[1], m[2]), COLORS.red],
    [v3.vec3(m[4], m[5], m[6]), COLORS.green],
    [v3.vec3(m[8], m[9], m[10]), COLORS.accent],
  ]
  cols.forEach(([axis, color], i) => {
    arrow(ctx, project, o, v3.add(o, v3.scale(axis, len)), {
      color,
      width: 2,
      label: labels?.[i],
    })
  })
}

const f6 = (n: number) => (Object.is(n, -0) ? 0 : n).toFixed(2).padStart(6)
function mat4Rows(m: readonly number[]): string {
  return [0, 1, 2, 3]
    .map((r) => `${f6(m[r])} ${f6(m[4 + r])} ${f6(m[8 + r])} │ ${f6(m[12 + r])}`)
    .join('\n')
}
const fv = (p: Vec3) => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`

/** Ground grid + world axis tripod through any projector. */
function worldStage(ctx: CanvasRenderingContext2D, project: Projector, extent = 6): void {
  for (let i = -extent; i <= extent; i++) {
    const major = i === 0
    seg(ctx, project, v3.vec3(i, 0, -extent), v3.vec3(i, 0, extent), {
      color: major ? COLORS.axis : COLORS.grid,
      width: 1,
    })
    seg(ctx, project, v3.vec3(-extent, 0, i), v3.vec3(extent, 0, i), {
      color: major ? COLORS.axis : COLORS.grid,
      width: 1,
    })
  }
}

/** Camera3D bound to a fixed Size — the god's-eye projector used everywhere. */
function godProjector(cam3: Camera3D, size: Size): Projector {
  return (p) => cam3.toScreen(p, size)
}

/* ================================================================== */
/* 4.1 — space-frames: a frame is a matrix                            */
/* ================================================================== */

const spaceFrames: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  const cam3 = new Camera3D({ yaw: 0.8, pitch: 0.5, dist: 16, target: v3.vec3(0, 1, 0) })

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 400,
    draw(ctx, w) {
      const a = yaw.get()
      const c = Math.cos(a)
      const s = Math.sin(a)
      // A yaw-rotated orthonormal frame, lifted to (ox, oy, oz).
      const x = v3.vec3(c, 0, -s)
      const y = v3.vec3(0, 1, 0)
      const z = v3.vec3(s, 0, c)
      const o = v3.vec3(ox.get(), oy.get(), oz.get())

      const uM = callMat(userFns, 'frameMatrix', [x, y, z, o], 16)
      const M = uM ?? [...m4.frameMatrix(x, y, z, o)]
      const project = godProjector(cam3, w)

      worldStage(ctx, project, 6)
      tripod(ctx, project, [...m4.identity4()], 1.6, ['x', 'y', 'z']) // world axes at origin

      // The framed model: a unit cube, drawn in its LOCAL coordinates, placed
      // by M. Ghost cube at the origin shows where local space "starts".
      wireCube(ctx, project, CUBE_CORNERS, { color: COLORS.ghost, width: 1 })
      wireCube(ctx, (p) => project(m4.transformPoint3(asM4(M), p)), CUBE_CORNERS, {
        color: COLORS.yellow,
        width: 2,
      })
      tripod(ctx, project, M, 1.4) // the frame's own axes = columns of M

      // A single local probe corner, to read off local→world.
      const localProbe = v3.vec3(1, 1, 1)
      const worldProbe = m4.transformPoint3(asM4(M), localProbe)
      dot3pt(ctx, project, worldProbe, { color: COLORS.purple, r: 5, label: 'local (1,1,1)' })

      const status = !userFns
        ? 'reference frameMatrix — solve the exercise below to take over'
        : uM
          ? 'your frameMatrix builds the model→world matrix'
          : 'your frameMatrix returned a non-Mat4 — reference shown'
      setHud(
        `M = frameMatrix(x̂, ŷ, ẑ, o)\n${mat4Rows(M)}\n` +
          `local (1,1,1) → world ${fv(worldProbe)}\n${status}`,
      )
    },
  })
  const setHud = hud(container)
  cam3.attachOrbit(widget)

  const bar = controlsBar(container)
  const redraw = () => widget.requestDraw()
  const ox = bar.slider({ label: 'origin x', min: -4, max: 4, step: 0.1, value: 2, onInput: redraw })
  const oy = bar.slider({ label: 'origin y', min: 0, max: 4, step: 0.1, value: 1, onInput: redraw })
  const oz = bar.slider({ label: 'origin z', min: -4, max: 4, step: 0.1, value: -1, onInput: redraw })
  const yaw = bar.slider({
    label: 'frame yaw',
    min: -Math.PI,
    max: Math.PI,
    step: 0.01,
    value: 0.6,
    format: (v) => `${v.toFixed(2)} rad`,
    onInput: redraw,
  })

  widgetNote(
    container,
    'Drag to orbit. The yellow cube is a unit cube living in its own local space, placed in the ' +
      'world by your <code>frameMatrix</code>. The red/green/blue tripod on it is literally the ' +
      "matrix's first three columns; the purple dot is the local corner (1,1,1), and the readout " +
      'shows where it lands in the world.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ================================================================== */
/* 4.2 — change-of-basis: a point's coordinates in two frames         */
/* ================================================================== */

const changeOfBasis: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  const cam3 = new Camera3D({ yaw: 0.85, pitch: 0.5, dist: 15, target: v3.vec3(0, 0.5, 0) })
  const FRAME_O = v3.vec3(1.5, 0, -1)

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 400,
    draw(ctx, w) {
      const a = yaw.get()
      const c = Math.cos(a)
      const s = Math.sin(a)
      const X = v3.vec3(c, 0, -s)
      const Y = v3.vec3(0, 1, 0)
      const Z = v3.vec3(s, 0, c)
      const P = v3.vec3(px.get(), py.get(), pz.get())
      const project = godProjector(cam3, w)

      worldStage(ctx, project, 6)
      tripod(ctx, project, [...m4.identity4()], 1.4, ['x', 'y', 'z'])

      // The tilted frame: its origin and axes.
      const frameM = m4.frameMatrix(X, Y, Z, FRAME_O)
      tripod(ctx, project, [...frameM], 1.6, ["x'", "y'", "z'"])
      dot3pt(ctx, project, FRAME_O, { color: COLORS.dim, r: 4, label: "o'" })

      // Local coords via the learner; reference fallback.
      const uLocal = callVec3(userFns, 'worldToLocal', [FRAME_O, X, Y, Z, P])
      const local = uLocal ?? cam.worldToLocal(FRAME_O, X, Y, Z, P)

      // The reconstruction staircase: o' + lx·x' (red) + ly·y' (green) + lz·z' (blue).
      // If worldToLocal is right, the staircase ends exactly on P.
      const step1 = v3.add(FRAME_O, v3.scale(X, local.x))
      const step2 = v3.add(step1, v3.scale(Y, local.y))
      const step3 = v3.add(step2, v3.scale(Z, local.z))
      seg(ctx, project, FRAME_O, step1, { color: COLORS.red, width: 2 })
      seg(ctx, project, step1, step2, { color: COLORS.green, width: 2 })
      seg(ctx, project, step2, step3, { color: COLORS.accent, width: 2 })

      // The point itself, plus where the staircase actually landed.
      dot3pt(ctx, project, P, { color: COLORS.yellow, r: 6, label: 'P' })
      const landed = v3.distance(step3, P) < 1e-4
      if (!landed) dot3pt(ctx, project, step3, { color: COLORS.red, r: 4, label: 'reconstructed' })

      const status = !userFns
        ? 'reference worldToLocal — solve the exercise below to take over'
        : !uLocal
          ? 'your worldToLocal returned a non-vector — reference shown'
          : landed
            ? 'your worldToLocal ✓ — the staircase lands on P'
            : 'your worldToLocal ✗ — the red dot is where your coords actually point'
      setHud(
        `P world  ${fv(P)}\n` +
          `P local  (${local.x.toFixed(2)}, ${local.y.toFixed(2)}, ${local.z.toFixed(2)})  ` +
          `= ( dot(P−o', x'), dot(P−o', y'), dot(P−o', z') )\n${status}`,
      )
    },
  })
  const setHud = hud(container)
  cam3.attachOrbit(widget)

  const bar = controlsBar(container)
  const redraw = () => widget.requestDraw()
  const px = bar.slider({ label: 'P.x', min: -4, max: 4, step: 0.1, value: 2.5, onInput: redraw })
  const py = bar.slider({ label: 'P.y', min: 0, max: 4, step: 0.1, value: 1.5, onInput: redraw })
  const pz = bar.slider({ label: 'P.z', min: -4, max: 4, step: 0.1, value: 1, onInput: redraw })
  const yaw = bar.slider({
    label: "frame yaw",
    min: -Math.PI,
    max: Math.PI,
    step: 0.01,
    value: 0.7,
    format: (v) => `${v.toFixed(2)} rad`,
    onInput: redraw,
  })

  widgetNote(
    container,
    'Drag to orbit. The world frame sits at the origin; the dimmer primed frame is tilted and ' +
      "offset. <code>worldToLocal</code> reads P in the primed frame's axes, and the colored " +
      "staircase rebuilds P as o' + x'·local.x + y'·local.y + z'·local.z. Get the dot products " +
      'right and the staircase lands exactly on the yellow P.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ================================================================== */
/* 4.3 — gram-schmidt: manufacture an orthonormal frame               */
/* ================================================================== */

const gramSchmidt: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  const cam3 = new Camera3D({ yaw: 0.7, pitch: 0.5, dist: 6 })

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 400,
    draw(ctx, w) {
      const fy = fYaw.get()
      const fp = fPitch.get()
      const cp = Math.cos(fp)
      // Raw inputs: a forward direction and a deliberately-tilted, non-unit up.
      const rawFwd = v3.vec3(cp * Math.sin(fy), Math.sin(fp), cp * Math.cos(fy))
      const tilt = upTilt.get()
      const rawUp = v3.vec3(Math.sin(tilt), Math.cos(tilt), 0)
      const project = godProjector(cam3, w)
      const O = v3.vec3(0, 0, 0)

      worldStage(ctx, project, 3)

      // Raw inputs as ghost arrows.
      arrow(ctx, project, O, rawFwd, { color: 'rgba(229,192,123,0.5)', width: 1.5, label: 'raw fwd' })
      arrow(ctx, project, O, rawUp, { color: 'rgba(198,205,217,0.45)', width: 1.5, label: 'raw up' })

      const b = callBasis(userFns, 'orthonormalBasis', [rawFwd, rawUp])
      const basis = b ?? cam.orthonormalBasis(rawFwd, rawUp)

      // The clean orthonormal tripod.
      arrow(ctx, project, O, basis.right, { color: COLORS.red, width: 2.5, label: 'right' })
      arrow(ctx, project, O, basis.up, { color: COLORS.green, width: 2.5, label: 'up' })
      arrow(ctx, project, O, basis.fwd, { color: COLORS.accent, width: 2.5, label: 'fwd' })

      const d = (a: Vec3, c: Vec3) => v3.dot(a, c)
      const orient = `right·up=${d(basis.right, basis.up).toFixed(2)}  ` +
        `right·fwd=${d(basis.right, basis.fwd).toFixed(2)}  ` +
        `up·fwd=${d(basis.up, basis.fwd).toFixed(2)}`
      const lens = `|right|=${v3.length(basis.right).toFixed(2)}  ` +
        `|up|=${v3.length(basis.up).toFixed(2)}  |fwd|=${v3.length(basis.fwd).toFixed(2)}`
      const status = !userFns
        ? 'reference orthonormalBasis — solve the exercise below to take over'
        : !b
          ? 'your orthonormalBasis returned a bad shape — reference shown'
          : 'your orthonormalBasis ✓ — dots ≈ 0, lengths ≈ 1'
      setHud(`${orient}\n${lens}\n${status}`)
    },
  })
  const setHud = hud(container)
  cam3.attachOrbit(widget)

  const bar = controlsBar(container)
  const redraw = () => widget.requestDraw()
  const fYaw = bar.slider({ label: 'fwd yaw', min: -Math.PI, max: Math.PI, step: 0.01, value: 0.6, onInput: redraw })
  const fPitch = bar.slider({ label: 'fwd pitch', min: -1.2, max: 1.2, step: 0.01, value: 0.3, onInput: redraw })
  const upTilt = bar.slider({
    label: 'up tilt',
    min: -1.2,
    max: 1.2,
    step: 0.01,
    value: 0.5,
    format: (v) => `${v.toFixed(2)} rad`,
    onInput: redraw,
  })

  widgetNote(
    container,
    'Drag to orbit. The faint arrows are the raw, sloppy inputs — a forward of any length and an ' +
      'up that is deliberately not perpendicular. Your <code>orthonormalBasis</code> squares them ' +
      'into the bold red/green/blue tripod: re-tilt "up" and watch the clean frame snap to stay ' +
      'perpendicular. The readout proves it — every dot product ≈ 0, every length ≈ 1.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ================================================================== */
/* 4.4 — camera-rig: cameraToWorld places the camera                  */
/* ================================================================== */

const cameraRig: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  const cam3 = new Camera3D({ yaw: 0.9, pitch: 0.55, dist: 18, target: v3.vec3(0, 0.5, 0) })

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 410,
    draw(ctx, w) {
      const eye = v3.vec3(ex.get(), ey.get(), ez.get())
      const target = v3.vec3(tx.get(), 0, tz.get())
      const up = v3.vec3(0, 1, 0)
      const project = godProjector(cam3, w)

      const uC = callMat(userFns, 'cameraToWorld', [eye, target, up], 16)
      const C = uC ?? [...cam.cameraToWorld(eye, target, up)]

      worldStage(ctx, project, 6)
      tripod(ctx, project, [...m4.identity4()], 1.4, ['x', 'y', 'z'])

      // The target and the eye→target sight line.
      dot3pt(ctx, project, target, { color: COLORS.yellow, r: 5, label: 'target' })
      seg(ctx, project, eye, target, { color: 'rgba(229,192,123,0.5)', width: 1, dash: [5, 4] })

      // The camera body: its tripod (columns of C) + a little view frustum
      // pointing down its −z (= −back) toward the target.
      tripod(ctx, project, C, 1.3, ['right', 'up', 'back'])
      const right = v3.vec3(C[0], C[1], C[2])
      const upv = v3.vec3(C[4], C[5], C[6])
      const back = v3.vec3(C[8], C[9], C[10])
      const fwd = v3.neg(back)
      const apex = eye
      const d = 2.2
      const hw = 1.0
      const hh = 0.7
      const center = v3.add(apex, v3.scale(fwd, d))
      const corners = [
        v3.add(v3.add(center, v3.scale(right, hw)), v3.scale(upv, hh)),
        v3.add(v3.sub(center, v3.scale(right, hw)), v3.scale(upv, hh)),
        v3.sub(v3.sub(center, v3.scale(right, hw)), v3.scale(upv, hh)),
        v3.sub(v3.add(center, v3.scale(right, hw)), v3.scale(upv, hh)),
      ]
      for (let i = 0; i < 4; i++) {
        seg(ctx, project, apex, corners[i], { color: COLORS.cyan, width: 1 })
        seg(ctx, project, corners[i], corners[(i + 1) % 4], { color: COLORS.cyan, width: 1 })
      }
      dot3pt(ctx, project, eye, { color: COLORS.purple, r: 5, label: 'eye' })

      const status = !userFns
        ? 'reference cameraToWorld — solve the exercise below to take over'
        : uC
          ? 'your cameraToWorld places the camera frame'
          : 'your cameraToWorld returned a non-Mat4 — reference shown'
      setHud(
        `cameraToWorld(eye, target, up)\n${mat4Rows(C)}\n` +
          `column 3 = eye ${fv(eye)};  the cyan frustum looks down −z toward the target\n${status}`,
      )
    },
  })
  const setHud = hud(container)
  cam3.attachOrbit(widget)

  const bar = controlsBar(container)
  const redraw = () => widget.requestDraw()
  const ex = bar.slider({ label: 'eye x', min: -6, max: 6, step: 0.1, value: 4, onInput: redraw })
  const ey = bar.slider({ label: 'eye y', min: -1, max: 6, step: 0.1, value: 3, onInput: redraw })
  const ez = bar.slider({ label: 'eye z', min: -6, max: 6, step: 0.1, value: 5, onInput: redraw })
  const tx = bar.slider({ label: 'target x', min: -4, max: 4, step: 0.1, value: 0, onInput: redraw })
  const tz = bar.slider({ label: 'target z', min: -4, max: 4, step: 0.1, value: 0, onInput: redraw })

  widgetNote(
    container,
    'Drag to orbit. The purple eye, its red/green/blue axes, and the cyan frustum are all read ' +
      'straight out of your <code>cameraToWorld</code> matrix — column 3 is the eye, columns 0–2 ' +
      'are the camera’s right/up/back. The frustum points down −z (camera-forward) at the ' +
      'target, exactly the WebGL convention.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ================================================================== */
/* 4.5 — rigid-inverse: invertRigid undoes a rigid transform          */
/* ================================================================== */

const rigidInverse: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  const cam3 = new Camera3D({ yaw: 0.8, pitch: 0.5, dist: 16, target: v3.vec3(0, 0.5, 0) })

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 400,
    draw(ctx, w) {
      const t = v3.vec3(tx.get(), ty.get(), tz.get())
      const M = m4.mul4(m4.translation3(t.x, t.y, t.z), m4.rotationY(ry.get()))
      const project = godProjector(cam3, w)

      const uInv = callMat(userFns, 'invertRigid', [[...M]], 16)
      const inv = uInv ?? [...m4.invertRigid(M)]

      worldStage(ctx, project, 6)
      tripod(ctx, project, [...m4.identity4()], 1.4, ['x', 'y', 'z'])

      // Ghost cube at the identity — "home".
      wireCube(ctx, project, CUBE_CORNERS, { color: COLORS.ghost, width: 1.5 })
      // The scrambled cube: corners pushed through M.
      const scrambled = CUBE_CORNERS.map((c) => m4.transformPoint3(M, c))
      wireCube(ctx, project, scrambled, { color: COLORS.yellow, width: 2 })
      // Recover: push the scrambled corners back through invertRigid(M).
      const recovered = scrambled.map((c) => m4.transformPoint3(asM4(inv), c))
      const home = recovered.every((c, i) => v3.distance(c, CUBE_CORNERS[i]) < 1e-4)
      wireCube(ctx, project, recovered, {
        color: home ? COLORS.green : COLORS.red,
        width: 2,
        dash: home ? undefined : [6, 4],
      })

      // Numeric proof: invertRigid(M) · M should be the identity.
      const prod = m4.mul4(asM4(inv), M)
      let maxErr = 0
      const I = m4.identity4()
      for (let i = 0; i < 16; i++) maxErr = Math.max(maxErr, Math.abs(prod[i] - I[i]))

      const status = !userFns
        ? 'reference invertRigid — solve the exercise below to take over'
        : !uInv
          ? 'your invertRigid returned a non-Mat4 — reference shown'
          : home
            ? 'your invertRigid ✓ — the green cube lands back home'
            : 'your invertRigid ✗ — recovered cube (red) missed home; check the transpose'
      setHud(
        `M⁻¹ · M  (should be identity)\n${mat4Rows(prod)}\n` +
          `max error from identity: ${maxErr.toExponential(1)}\n${status}`,
      )
    },
  })
  const setHud = hud(container)
  cam3.attachOrbit(widget)

  const bar = controlsBar(container)
  const redraw = () => widget.requestDraw()
  const tx = bar.slider({ label: 'tx', min: -4, max: 4, step: 0.1, value: 2.5, onInput: redraw })
  const ty = bar.slider({ label: 'ty', min: -1, max: 4, step: 0.1, value: 1, onInput: redraw })
  const tz = bar.slider({ label: 'tz', min: -4, max: 4, step: 0.1, value: -1, onInput: redraw })
  const ry = bar.slider({
    label: 'ry',
    min: -Math.PI,
    max: Math.PI,
    step: 0.01,
    value: 0.9,
    format: (v) => `${v.toFixed(2)} rad`,
    onInput: redraw,
  })

  widgetNote(
    container,
    'Drag to orbit. The yellow cube is the home cube pushed out by a rigid M = T · Rᵧ. Your ' +
      '<code>invertRigid</code> then pushes those scrambled corners back: get the transpose-plus-' +
      '<nobr>−Rᵀt</nobr> right and the recovered cube turns green, sitting exactly on the ghost. ' +
      'The readout shows M⁻¹ · M collapsing to the identity.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ================================================================== */
/* capstone — fly-the-camera: world view + through-the-lens           */
/* ================================================================== */

interface SceneObject {
  model: Mat4
  color: string
  half: number
  label: string
}

const SCENE: readonly SceneObject[] = [
  { model: m4.translation3(0, 1, 0), color: COLORS.yellow, half: 1, label: 'A' },
  { model: m4.mul4(m4.translation3(4, 0.6, -2), m4.rotationY(0.6)), color: COLORS.green, half: 0.6, label: 'B' },
  { model: m4.translation3(-3, 0.4, 3), color: COLORS.purple, half: 0.4, label: 'C' },
  { model: m4.translation3(-1, 0.5, -4), color: COLORS.cyan, half: 0.5, label: 'D' },
]

const flyTheCamera: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  const UP = v3.vec3(0, 1, 0)
  // God's-eye orbit for the left panel.
  const god = new Camera3D({ yaw: 0.9, pitch: 0.55, dist: 22, target: v3.vec3(0, 0.5, 0) })
  const LENS_FOCAL = 1.0
  const NEAR = 0.05

  /** The one black box left in the course: camera-space → screen. (Module 5.) */
  const projectLens = (c: Vec3, size: Size): Vec2 | null => {
    if (-c.z <= NEAR) return null // behind the camera (looking down −z)
    const f = size.height * LENS_FOCAL
    return v2.vec2(size.width / 2 + (f * c.x) / -c.z, size.height / 2 - (f * c.y) / -c.z)
  }

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 440,
    draw(ctx, w) {
      const eye = flyEye()
      const target = v3.vec3(0, 0.5, 0)
      const half = { width: w.width / 2, height: w.height }

      /* ---------------- left: god's-eye view of the world ---------------- */
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, half.width, w.height)
      ctx.clip()
      const gp = godProjector(god, half)
      worldStage(ctx, gp, 7)
      for (const obj of SCENE) {
        wireCube(ctx, (p) => gp(m4.transformPoint3(obj.model, p)), CUBE_CORNERS.map((c) => v3.scale(c, obj.half)), {
          color: obj.color,
          width: 1.5,
        })
        dot3pt(ctx, gp, m4.transformPoint3(obj.model, v3.vec3(0, 0, 0)), { color: obj.color, r: 3, label: obj.label })
      }
      // The camera gizmo, placed by the reference cameraToWorld (this is the
      // INPUT to the learner's view matrix, drawn so you can see it move).
      const C = cam.cameraToWorld(eye, target, UP)
      drawGizmo(ctx, gp, [...C], eye, target)
      draw.drawLabel(ctx, "god's-eye view — drag to orbit", v2.vec2(12, w.height - 16), COLORS.dim)
      ctx.restore()

      /* ---------------- right: the world through the lens ---------------- */
      ctx.save()
      ctx.translate(w.width / 2, 0)
      ctx.beginPath()
      ctx.rect(0, 0, half.width, w.height)
      ctx.clip()

      const uView = callMat(userFns, 'modelView', [eye, target, UP, [...m4.identity4()]], 16)
      if (!userFns || !uView) {
        ctx.save()
        ctx.font = MONO_FONT
        ctx.textAlign = 'center'
        ctx.fillStyle = userFns ? COLORS.red : COLORS.yellow
        ctx.fillText(
          userFns ? 'your modelView returned a non-Mat4' : 'solve the capstone to look through the lens',
          half.width / 2,
          w.height / 2,
        )
        ctx.restore()
      } else {
        // Ground grid through the lens: world points, model = identity.
        const viewWorld: Projector = (p) =>
          projectLens(m4.transformPoint3(asM4(uView), p), half)
        worldStage(ctx, viewWorld, 7)
        // Each object: its own model→view matrix from the learner, then project.
        for (const obj of SCENE) {
          const mv = callMat(userFns, 'modelView', [eye, target, UP, [...obj.model]], 16)
          if (!mv) continue
          const proj: Projector = (p) => projectLens(m4.transformPoint3(asM4(mv), p), half)
          wireCube(ctx, proj, CUBE_CORNERS.map((c) => v3.scale(c, obj.half)), {
            color: obj.color,
            width: 1.5,
          })
        }
      }
      draw.drawLabel(ctx, 'through the lens (your view matrix)', v2.vec2(12, w.height - 16), COLORS.dim)
      ctx.restore()

      // Divider.
      ctx.save()
      ctx.strokeStyle = '#323845'
      ctx.beginPath()
      ctx.moveTo(w.width / 2, 0)
      ctx.lineTo(w.width / 2, w.height)
      ctx.stroke()
      ctx.restore()

      const status = !userFns
        ? 'reference camera shown on the left; the lens waits on your modelView'
        : !uView
          ? 'your modelView returned a non-Mat4'
          : 'flying with YOUR modelView = lookAt(eye, target, up) · model'
      setHud(`eye ${fv(eye)} → target (0, 0.5, 0)\n${status}`)
    },
  })
  const setHud = hud(container)

  // Draw the camera frustum gizmo for the left panel.
  function drawGizmo(
    ctx: CanvasRenderingContext2D,
    project: Projector,
    C: readonly number[],
    eye: Vec3,
    target: Vec3,
  ): void {
    seg(ctx, project, eye, target, { color: 'rgba(229,192,123,0.5)', width: 1, dash: [5, 4] })
    const right = v3.vec3(C[0], C[1], C[2])
    const upv = v3.vec3(C[4], C[5], C[6])
    const fwd = v3.neg(v3.vec3(C[8], C[9], C[10]))
    const center = v3.add(eye, v3.scale(fwd, 2.5))
    const hw = 1.1
    const hh = 0.78
    const corners = [
      v3.add(v3.add(center, v3.scale(right, hw)), v3.scale(upv, hh)),
      v3.add(v3.sub(center, v3.scale(right, hw)), v3.scale(upv, hh)),
      v3.sub(v3.sub(center, v3.scale(right, hw)), v3.scale(upv, hh)),
      v3.sub(v3.add(center, v3.scale(right, hw)), v3.scale(upv, hh)),
    ]
    for (let i = 0; i < 4; i++) {
      seg(ctx, project, eye, corners[i], { color: COLORS.fg, width: 1 })
      seg(ctx, project, corners[i], corners[(i + 1) % 4], { color: COLORS.fg, width: 1 })
    }
    dot3pt(ctx, project, eye, { color: COLORS.purple, r: 5, label: 'camera' })
  }

  // Orbit only on the left half (the god view); right half is slider-driven.
  god.attachOrbit(widget)
  const orbit = widget.onBackgroundDrag!
  widget.onBackgroundDrag = (dx, dy, pos) => {
    if (pos.x < widget.width / 2) orbit(dx, dy, pos)
  }

  const bar = controlsBar(container)
  const redraw = () => widget.requestDraw()
  const camYaw = bar.slider({
    label: 'cam yaw',
    min: -Math.PI,
    max: Math.PI,
    step: 0.01,
    value: 0.6,
    format: (v) => `${v.toFixed(2)} rad`,
    onInput: redraw,
  })
  const camPitch = bar.slider({ label: 'cam pitch', min: -1.2, max: 1.2, step: 0.01, value: 0.35, onInput: redraw })
  const camDist = bar.slider({ label: 'cam dist', min: 3, max: 16, step: 0.1, value: 9, onInput: redraw })

  function flyEye(): Vec3 {
    const target = v3.vec3(0, 0.5, 0)
    const cp = Math.cos(camPitch.get())
    const a = camYaw.get()
    return v3.add(
      target,
      v3.scale(v3.vec3(cp * Math.sin(a), Math.sin(camPitch.get()), cp * Math.cos(a)), camDist.get()),
    )
  }

  widgetNote(
    container,
    'Left: the world from a free orbit camera, with your flying camera drawn as a frustum — drag ' +
      'the left half to look around. Right: the very same world as <em>that</em> camera sees it, ' +
      'rendered by transforming every object through your <code>modelView</code> = ' +
      '<code>lookAt</code> · model. Fly the camera with the sliders and watch the two views stay ' +
      'in sync. (The final perspective squish is the one black box left — you build it in Module 5.)',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ------------------------------------------------------------------ */

export const M04_WIDGETS: Record<string, WidgetFactory> = {
  'space-frames': spaceFrames,
  'change-of-basis': changeOfBasis,
  'gram-schmidt': gramSchmidt,
  'camera-rig': cameraRig,
  'rigid-inverse': rigidInverse,
  'fly-the-camera': flyTheCamera,
}
