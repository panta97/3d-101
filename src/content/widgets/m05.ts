/**
 * Module 5 widgets — Projection: 3D onto the Screen.
 *
 * House style (see m04.ts): factories receive the mount container, return
 * { setUserFns } when exercise-driven, and NEVER trust learner return values
 * (guards from ./util). Every widget renders something sensible before any
 * learner code exists, falling back to the reference math.
 *
 * The arc rebuilds the one black box modules 1–4 leaned on — project3() — from
 * the perspective divide, the projection matrix, the homogeneous w, NDC and
 * the viewport transform, then reassembles them in the capstone renderer.
 */

import { v2, v3, m4, cam, proj } from '@/math'
import type { Vec2, Vec3, Vec4, Mat4 } from '@/math'
import {
  CanvasWidget,
  Camera3D,
  Viewport2D,
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
import { isVec2, isVec3, isNumberArray } from './util'

/* ------------------------------------------------------------------ */
/* shared guards + helpers                                             */
/* ------------------------------------------------------------------ */

const asM4 = (a: readonly number[]): Mat4 => a as Mat4

type Projector = (p: Vec3) => Vec2 | null

const isVec4 = (v: unknown): v is Vec4 =>
  typeof v === 'object' &&
  v !== null &&
  Number.isFinite((v as Vec4).x) &&
  Number.isFinite((v as Vec4).y) &&
  Number.isFinite((v as Vec4).z) &&
  Number.isFinite((v as Vec4).w)

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

function callVec2(fns: UserFns | null, name: string, args: readonly unknown[]): Vec2 | null {
  const f = fns?.[name]
  if (typeof f !== 'function') return null
  try {
    const r = f(...args)
    return isVec2(r) ? r : null
  } catch {
    return null
  }
}

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

function callVec4(fns: UserFns | null, name: string, args: readonly unknown[]): Vec4 | null {
  const f = fns?.[name]
  if (typeof f !== 'function') return null
  try {
    const r = f(...args)
    return isVec4(r) ? r : null
  } catch {
    return null
  }
}

/**
 * Call a learner project3, distinguishing a legitimate null (behind camera)
 * from a misbehaving return. Returns { ok: false } only when the shape is
 * wrong, so callers can fall back to the reference for the whole frame.
 */
function callProject3(
  fns: UserFns | null,
  mvp: readonly number[],
  p: Vec3,
  width: number,
  height: number,
): { ok: true; value: Vec2 | null } | { ok: false } {
  const f = fns?.project3
  if (typeof f !== 'function') return { ok: false }
  try {
    const r = f(mvp.slice(), p, width, height)
    if (r === null || isVec2(r)) return { ok: true, value: r }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

const f6 = (n: number) => (Object.is(n, -0) ? 0 : n).toFixed(2).padStart(6)
function mat4Rows(m: readonly number[]): string {
  return [0, 1, 2, 3]
    .map((r) => `${f6(m[r])} ${f6(m[4 + r])} ${f6(m[8 + r])} │ ${f6(m[12 + r])}`)
    .join('\n')
}

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

function dot3pt(
  ctx: CanvasRenderingContext2D,
  project: Projector,
  p: Vec3,
  opts: { color: string; r?: number; label?: string },
): void {
  const sPt = project(p)
  if (!sPt) return
  ctx.save()
  ctx.fillStyle = opts.color
  ctx.beginPath()
  ctx.arc(sPt.x, sPt.y, opts.r ?? 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  if (opts.label) draw.drawLabel(ctx, opts.label, v2.vec2(sPt.x + 8, sPt.y - 8), opts.color)
}

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

/* ================================================================== */
/* 5.1 — pinhole: the perspective divide by similar triangles         */
/* ================================================================== */

const pinhole: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let depth = 3 // distance in front of the eye (= −z)
  let height = 1.4 // the point's view-space y

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 380,
    draw(ctx, w) {
      const vp = new Viewport2D(widget, { center: v2.vec2(2.8, 0), unitsHigh: 7 })
      const focal = focalS.get()
      draw.grid2(ctx, vp, w)

      const eye = v2.vec2(0, 0)
      const obj = v2.vec2(depth, height)

      // The image plane: a vertical line `focal` units in front of the eye.
      draw.line2(ctx, vp, v2.vec2(focal, -3), v2.vec2(focal, 3), { color: COLORS.cyan, width: 2 })
      draw.drawLabel(ctx, 'image plane', vp.toScreen(v2.vec2(focal, 3.05)), COLORS.cyan)
      draw.line2(ctx, vp, v2.vec2(0, 0), v2.vec2(6.5, 0), { color: COLORS.axis, width: 1 })
      draw.drawLabel(ctx, 'depth  −z →', vp.toScreen(v2.vec2(5.3, -0.35)), COLORS.dim)

      // Learner's projection of the camera-space point (0, height, −depth).
      const camPt = v3.vec3(0, height, -depth)
      const uImg = callVec2(userFns, 'projectPinhole', [camPt, focal])
      const img = uImg ?? proj.projectPinhole(camPt, focal)
      const imgPt = v2.vec2(focal, img.y)

      // The sight ray from the object through the eye, and the similar-triangle
      // verticals that make "focal·h / depth" visible.
      draw.line2(ctx, vp, eye, v2.vec2(depth * 1.25, height * 1.25), {
        color: 'rgba(229,192,123,0.5)',
        width: 1,
        dash: [5, 4],
      })
      draw.line2(ctx, vp, obj, v2.vec2(depth, 0), { color: COLORS.grid, width: 1, dash: [3, 3] })
      draw.line2(ctx, vp, imgPt, v2.vec2(focal, 0), { color: COLORS.grid, width: 1, dash: [3, 3] })

      draw.point2(ctx, vp, eye, { color: COLORS.purple, r: 5, label: 'eye' })
      draw.point2(ctx, vp, obj, { color: COLORS.yellow, r: 6, label: 'point' })
      draw.point2(ctx, vp, imgPt, { color: COLORS.red, r: 5, label: "y' " })

      // Does the projected point actually sit on the eye→point ray?
      const onRay = Math.abs(height * focal - img.y * depth) < 1e-3 * (1 + Math.abs(height))
      const status = !userFns
        ? 'reference projectPinhole — solve the exercise below to take over'
        : !uImg
          ? 'your projectPinhole returned a non-vector — reference shown'
          : onRay
            ? "your projectPinhole ✓ — y' lands on the ray"
            : "your projectPinhole ✗ — y' is off the sight ray"
      setHud(
        `depth = −z = ${depth.toFixed(2)}   height y = ${height.toFixed(2)}   focal = ${focal.toFixed(2)}\n` +
          `y' = focal · y / depth = ${focal.toFixed(2)} · ${height.toFixed(2)} / ${depth.toFixed(2)} = ${img.y.toFixed(3)}\n` +
          status,
      )
    },
  })
  const setHud = hud(container)

  widget.handles = [
    worldHandle(
      new Viewport2D(widget, { center: v2.vec2(2.8, 0), unitsHigh: 7 }),
      () => v2.vec2(depth, height),
      (p) => {
        depth = Math.max(0.5, Math.min(6.2, p.x))
        height = Math.max(-2.8, Math.min(2.8, p.y))
        widget.requestDraw()
      },
    ),
  ]

  const bar = controlsBar(container)
  const focalS = bar.slider({
    label: 'focal',
    min: 0.5,
    max: 3,
    step: 0.05,
    value: 1.5,
    onInput: () => widget.requestDraw(),
  })

  widgetNote(
    container,
    'Drag the yellow point. The eye is at the origin looking right down −z; the cyan line is the ' +
      'image plane <code>focal</code> units away. Your <code>projectPinhole</code> places the red ' +
      "image point at <code>y' = focal · y / depth</code> — push the point deeper and the divide " +
      'shrinks it. The red dot must ride the dashed sight ray; if it drifts off, the divide is wrong.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ================================================================== */
/* 5.2 — frustum: the projection matrix defines a volume              */
/* ================================================================== */

const frustum: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let vy = 0.9 // probe point's view-space y
  let vDepth = 2.5 // probe point's depth (−z)

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 400,
    draw(ctx, w) {
      const vp = new Viewport2D(widget, { center: v2.vec2(3, 0), unitsHigh: 7 })
      const fovY = fovS.get()
      const near = nearS.get()
      const far = farS.get()
      const aspect = 1.6
      const tanH = Math.tan(fovY / 2)

      draw.grid2(ctx, vp, w)
      draw.line2(ctx, vp, v2.vec2(0, 0), v2.vec2(far + 0.6, 0), { color: COLORS.axis, width: 1 })

      // The frustum is the y–z slice between near and far, opening at ±fovY/2.
      const edge = (d: number) => v2.vec2(d, d * tanH)
      draw.line2(ctx, vp, edge(0.001), edge(far), { color: COLORS.dim, width: 1.5 })
      draw.line2(ctx, vp, v2.vec2(0.001, 0), v2.vec2(far, -far * tanH), { color: COLORS.dim, width: 1.5 })
      for (const [d, label] of [[near, 'near'], [far, 'far']] as const) {
        draw.line2(ctx, vp, v2.vec2(d, -d * tanH), v2.vec2(d, d * tanH), { color: COLORS.cyan, width: 2 })
        draw.drawLabel(ctx, label, vp.toScreen(v2.vec2(d, d * tanH + 0.25)), COLORS.cyan)
      }

      // Learner's matrix; map the probe + the near/far corners through it.
      const uM = callMat(userFns, 'perspective', [fovY, aspect, near, far], 16)
      const P = uM ?? [...proj.perspective(fovY, aspect, near, far)]
      const ndcOf = (p: Vec3) => proj.perspectiveDivide(proj.transformPoint4(asM4(P), p))

      const probe = v2.vec2(vDepth, vy)
      const ndc = ndcOf(v3.vec3(0, vy, -vDepth))
      const inside = Math.abs(ndc.y) <= 1.0001 && Math.abs(ndc.z) <= 1.0001
      draw.point2(ctx, vp, probe, { color: inside ? COLORS.green : COLORS.red, r: 6, label: 'probe' })
      draw.point2(ctx, vp, v2.vec2(0, 0), { color: COLORS.purple, r: 5, label: 'eye' })

      // Sanity: the near-top corner must map to NDC (0, 1, −1).
      const corner = ndcOf(v3.vec3(0, near * tanH, -near))
      const cornerOk = Math.abs(corner.y - 1) < 1e-3 && Math.abs(corner.z + 1) < 1e-3

      const status = !userFns
        ? 'reference perspective — solve the exercise below to take over'
        : !uM
          ? 'your perspective returned a non-Mat4 — reference shown'
          : cornerOk
            ? 'your perspective ✓ — the frustum corners map to the NDC cube'
            : 'your perspective ✗ — the near-top corner should hit NDC (0, 1, −1)'
      setHud(
        `perspective(fovY=${fovY.toFixed(2)}, aspect=${aspect}, near=${near.toFixed(1)}, far=${far.toFixed(1)})\n` +
          `${mat4Rows(P)}\n` +
          `probe (y=${vy.toFixed(2)}, depth=${vDepth.toFixed(2)}) → NDC y=${ndc.y.toFixed(2)}, z=${ndc.z.toFixed(2)}  ${inside ? '(inside)' : '(clipped)'}\n` +
          status,
      )
    },
  })
  const setHud = hud(container)

  widget.handles = [
    worldHandle(
      new Viewport2D(widget, { center: v2.vec2(3, 0), unitsHigh: 7 }),
      () => v2.vec2(vDepth, vy),
      (p) => {
        vDepth = Math.max(0.3, Math.min(9, p.x))
        vy = Math.max(-3, Math.min(3, p.y))
        widget.requestDraw()
      },
    ),
  ]

  const bar = controlsBar(container)
  const redraw = () => widget.requestDraw()
  const fovS = bar.slider({
    label: 'fovY',
    min: 0.4,
    max: 2.4,
    step: 0.01,
    value: 1.2,
    format: (v) => `${v.toFixed(2)} rad`,
    onInput: redraw,
  })
  const nearS = bar.slider({ label: 'near', min: 0.2, max: 2, step: 0.1, value: 1, onInput: redraw })
  const farS = bar.slider({ label: 'far', min: 3, max: 9, step: 0.1, value: 6, onInput: redraw })

  widgetNote(
    container,
    'A side view of the view frustum — the volume the camera can see. <code>fovY</code> sets how ' +
      'wide it opens; <code>near</code> and <code>far</code> are the clipping planes. Your ' +
      '<code>perspective</code> matrix is exactly the recipe that squashes this trapezoid into the ' +
      'NDC cube: drag the probe and watch it report green inside, red once it is clipped, while the ' +
      'readout confirms the frustum corners land on ±1.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ================================================================== */
/* 5.3 — clip space: the homogeneous w and the divide                 */
/* ================================================================== */

const clipSpace: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let vx = 1.0 // view-space x
  let vDepth = 2.5 // depth (−z)

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 400,
    draw(ctx, w) {
      const fovY = 1.2
      const aspect = 1
      const near = 1
      const far = 8
      const tanH = Math.tan(fovY / 2)
      const P = proj.perspective(fovY, aspect, near, far)

      // Left half: the frustum + the point in view space (depth → right, x → up).
      const half = w.width / 2
      // A hand-rolled view-space → left-panel mapping (depth on x, view-x on y).
      const toL = (p: Vec2) =>
        v2.vec2(half / 2 + (p.x - 3.6) * (widget.height / 8), widget.height / 2 - p.y * (widget.height / 8))

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, half, w.height)
      ctx.clip()
      const lineL = (a: Vec2, b: Vec2, color: string, dash?: number[]) => {
        const sa = toL(a)
        const sb = toL(b)
        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        if (dash) ctx.setLineDash(dash)
        ctx.beginPath()
        ctx.moveTo(sa.x, sa.y)
        ctx.lineTo(sb.x, sb.y)
        ctx.stroke()
        ctx.restore()
      }
      const dotL = (p: Vec2, color: string, label?: string, r = 5) => {
        const s = toL(p)
        ctx.save()
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        if (label) draw.drawLabel(ctx, label, v2.vec2(s.x + 8, s.y - 8), color)
      }
      lineL(v2.vec2(0, 0), v2.vec2(far + 0.5, 0), COLORS.axis)
      lineL(v2.vec2(0, 0), v2.vec2(far, far * tanH), COLORS.dim)
      lineL(v2.vec2(0, 0), v2.vec2(far, -far * tanH), COLORS.dim)
      lineL(v2.vec2(near, -near * tanH), v2.vec2(near, near * tanH), COLORS.cyan)
      lineL(v2.vec2(far, -far * tanH), v2.vec2(far, far * tanH), COLORS.cyan)
      lineL(v2.vec2(0, 0), v2.vec2(vDepth * 1.15, vx * 1.15), 'rgba(229,192,123,0.5)', [5, 4])
      dotL(v2.vec2(0, 0), COLORS.purple, 'eye')
      dotL(v2.vec2(vDepth, vx), COLORS.yellow, 'point', 6)
      draw.drawLabel(ctx, 'view space', v2.vec2(12, w.height - 14), COLORS.dim)
      ctx.restore()

      // Right half: the NDC square [−1,1]², and where the point divides to.
      const camPt = v3.vec3(vx, 0, -vDepth)
      const uClip = callVec4(userFns, 'transformPoint4', [[...P], camPt])
      const clip = uClip ?? proj.transformPoint4(P, camPt)
      const uNdc = callVec3(userFns, 'perspectiveDivide', [clip])
      const ndc = uNdc ?? proj.perspectiveDivide(clip)

      ctx.save()
      ctx.translate(half, 0)
      ctx.beginPath()
      ctx.rect(0, 0, half, w.height)
      ctx.clip()
      const cx = half / 2
      const cy = w.height / 2
      const u = Math.min(half, w.height) * 0.32 // pixels per NDC unit
      const toN = (nx: number, ny: number) => v2.vec2(cx + nx * u, cy - ny * u)
      // NDC cube outline + crosshair.
      ctx.save()
      ctx.strokeStyle = COLORS.axis
      ctx.lineWidth = 1
      ctx.strokeRect(cx - u, cy - u, 2 * u, 2 * u)
      ctx.beginPath()
      ctx.moveTo(cx - u, cy)
      ctx.lineTo(cx + u, cy)
      ctx.moveTo(cx, cy - u)
      ctx.lineTo(cx, cy + u)
      ctx.strokeStyle = COLORS.grid
      ctx.stroke()
      ctx.restore()
      draw.drawLabel(ctx, '+1', toN(1.02, 0), COLORS.dim)
      draw.drawLabel(ctx, '−1', toN(-1.16, 0), COLORS.dim)
      const np = toN(Math.max(-1.4, Math.min(1.4, ndc.x)), Math.max(-1.4, Math.min(1.4, ndc.y)))
      ctx.save()
      ctx.fillStyle = Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 ? COLORS.green : COLORS.red
      ctx.beginPath()
      ctx.arc(np.x, np.y, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      draw.drawLabel(ctx, 'NDC after ÷w', v2.vec2(12, w.height - 14), COLORS.dim)
      ctx.restore()

      // Divider.
      ctx.save()
      ctx.strokeStyle = '#323845'
      ctx.beginPath()
      ctx.moveTo(half, 0)
      ctx.lineTo(half, w.height)
      ctx.stroke()
      ctx.restore()

      const status = !userFns
        ? 'reference transformPoint4 / perspectiveDivide — solve the exercise to take over'
        : !uClip
          ? 'your transformPoint4 returned a non-Vec4 — reference shown'
          : !uNdc
            ? 'your perspectiveDivide returned a non-vector — reference shown'
            : 'your clip → NDC ✓ — w carries the depth, the divide squeezes it home'
      setHud(
        `clip = M·(x,y,z,1) = (${clip.x.toFixed(2)}, ${clip.y.toFixed(2)}, ${clip.z.toFixed(2)}, w=${clip.w.toFixed(2)})\n` +
          `w = −z = depth = ${vDepth.toFixed(2)}\n` +
          `NDC = clip / w = (${ndc.x.toFixed(2)}, ${ndc.y.toFixed(2)}, ${ndc.z.toFixed(2)})\n` +
          status,
      )
    },
  })
  const setHud = hud(container)

  // Drag the point in the LEFT (view-space) panel.
  widget.onBackgroundDrag = (_dx, _dy, pos) => {
    if (pos.x >= widget.width / 2) return
    const half = widget.width / 2
    const worldX = 3.6 + (pos.x - half / 2) / (widget.height / 8)
    const worldY = (widget.height / 2 - pos.y) / (widget.height / 8)
    vDepth = Math.max(0.3, Math.min(9, worldX))
    vx = Math.max(-3, Math.min(3, worldY))
    widget.requestDraw()
  }

  widgetNote(
    container,
    'Left: a point in view space and the frustum it lives in (drag the left panel to move it). ' +
      'Right: the same point after <code>transformPoint4</code> stashes its depth in <code>w</code> ' +
      'and <code>perspectiveDivide</code> divides through by it, landing in the NDC square. Deeper ' +
      'points have a larger <code>w</code>, so the divide pulls them harder toward the center — that ' +
      'is perspective, in one division.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ================================================================== */
/* 5.4 — viewport: NDC square → pixel canvas, with the y-flip          */
/* ================================================================== */

const viewportMap: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let ndc = v2.vec2(0.4, 0.5)

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 400,
    draw(ctx, w) {
      // The whole canvas IS the viewport: NDC (−1,−1) → bottom-left, (1,1) → top-right.
      const W = w.width
      const H = w.height
      const uPix = callVec2(userFns, 'viewport', [v3.vec3(ndc.x, ndc.y, 0), W, H])
      const pix = uPix ?? proj.viewport(v3.vec3(ndc.x, ndc.y, 0), W, H)
      const ref = proj.viewport(v3.vec3(ndc.x, ndc.y, 0), W, H)

      // NDC gridlines at −1,−0.5,0,0.5,1 mapped through the reference viewport.
      ctx.save()
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 1
      for (const g of [-1, -0.5, 0, 0.5, 1]) {
        const a = proj.viewport(v3.vec3(g, -1, 0), W, H)
        const b = proj.viewport(v3.vec3(g, 1, 0), W, H)
        ctx.strokeStyle = g === 0 ? COLORS.axis : COLORS.grid
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        const c = proj.viewport(v3.vec3(-1, g, 0), W, H)
        const d = proj.viewport(v3.vec3(1, g, 0), W, H)
        ctx.beginPath()
        ctx.moveTo(c.x, c.y)
        ctx.lineTo(d.x, d.y)
        ctx.stroke()
      }
      ctx.restore()

      // Corner labels make the y-flip explicit.
      const corner = (nx: number, ny: number, text: string) => {
        const p = proj.viewport(v3.vec3(nx, ny, 0), W, H)
        draw.drawLabel(ctx, text, v2.vec2(p.x + (nx < 0 ? 6 : -118), p.y + (ny > 0 ? 14 : -8)), COLORS.dim)
      }
      corner(-1, 1, 'NDC (−1, 1) → (0, 0)')
      corner(-1, -1, 'NDC (−1,−1) → (0, H)')
      corner(1, 1, 'NDC (1, 1) → (W, 0)')

      // The mapped pixel.
      const offRef = !uPix && userFns ? false : v2.distance(pix, ref) > 0.5
      ctx.save()
      ctx.fillStyle = COLORS.yellow
      ctx.beginPath()
      ctx.arc(pix.x, pix.y, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      if (uPix && offRef) {
        ctx.save()
        ctx.strokeStyle = COLORS.red
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.arc(ref.x, ref.y, 7, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
      draw.drawLabel(ctx, 'drag me', v2.vec2(pix.x + 10, pix.y - 10), COLORS.yellow)

      const status = !userFns
        ? 'reference viewport — solve the exercise below to take over'
        : !uPix
          ? 'your viewport returned a non-vector — reference shown'
          : offRef
            ? 'your viewport ✗ — yellow drifted from the dashed reference (check the y-flip)'
            : 'your viewport ✓ — NDC maps onto the pixel rectangle'
      setHud(
        `canvas = ${Math.round(W)} × ${Math.round(H)} px\n` +
          `NDC (${ndc.x.toFixed(2)}, ${ndc.y.toFixed(2)}) → pixel (${pix.x.toFixed(0)}, ${pix.y.toFixed(0)})\n` +
          'x: (ndc.x+1)/2 · W      y: (1−ndc.y)/2 · H   ← flipped\n' +
          status,
      )
    },
  })
  const setHud = hud(container)

  widget.onBackgroundDrag = (_dx, _dy, pos) => {
    // Invert the reference viewport to recover the dragged NDC coordinate.
    const nx = (pos.x / widget.width) * 2 - 1
    const ny = 1 - (pos.y / widget.height) * 2
    ndc = v2.vec2(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny)))
    widget.requestDraw()
  }

  widgetNote(
    container,
    'The whole canvas is the viewport. Drag anywhere: the dragged spot is read back as an NDC ' +
      'coordinate, and your <code>viewport</code> places the yellow pixel. The corners spell out the ' +
      'mapping — note that NDC <em>top</em> (y = +1) lands at pixel y = 0, because screen y points ' +
      'down. Miss the flip and the yellow dot peels away from the dashed reference.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ================================================================== */
/* 5.5 — orthographic vs perspective: projection with no divide       */
/* ================================================================== */

/* A row of equal cubes marching away down −z — the classic foreshortening test. */
const ROW: readonly Vec3[] = [0, 1, 2, 3, 4].map((i) => v3.vec3(0, 0.6, -i * 2.4))

const orthoCompare: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  const UP = v3.vec3(0, 1, 0)
  const cam3 = new Camera3D({ yaw: 0.6, pitch: 0.5, dist: 14, target: v3.vec3(0, 0.5, -4) })
  const NEAR = 0.1
  const FAR = 60

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 420,
    draw(ctx, w) {
      const eye = cam3.eye()
      const target = cam3.target
      const half = w.width / 2
      const view = cam.lookAt(eye, target, UP)
      const aspect = half / w.height

      const persp = proj.perspective(1.0, aspect, NEAR, FAR)
      const uOrtho = callMat(userFns, 'orthographic', [12 * aspect, 12, NEAR, FAR], 16)
      const ortho = uOrtho ?? [...proj.orthographic(12 * aspect, 12, NEAR, FAR)]

      const renderPanel = (P: readonly number[], xoff: number, title: string, color: string) => {
        ctx.save()
        ctx.translate(xoff, 0)
        ctx.beginPath()
        ctx.rect(0, 0, half, w.height)
        ctx.clip()
        const pv = m4.mul4(asM4(P), view)
        const project: Projector = (p) => proj.project3(pv, p, half, w.height)
        worldStage(ctx, project, 6)
        ROW.forEach((c, i) => {
          wireCube(ctx, (p) => project(v3.add(c, p)), CUBE_CORNERS.map((q) => v3.scale(q, 0.7)), {
            color,
            width: 1.5,
          })
          dot3pt(ctx, project, c, { color, r: 3, label: String(i) })
        })
        draw.drawLabel(ctx, title, v2.vec2(12, w.height - 14), COLORS.dim)
        ctx.restore()
      }

      renderPanel(persp, 0, 'perspective — distance shrinks', COLORS.yellow)
      renderPanel(ortho, half, 'orthographic (yours) — no shrink', COLORS.green)

      ctx.save()
      ctx.strokeStyle = '#323845'
      ctx.beginPath()
      ctx.moveTo(half, 0)
      ctx.lineTo(half, w.height)
      ctx.stroke()
      ctx.restore()

      const status = !userFns
        ? 'reference orthographic on the right — solve the exercise below to take over'
        : !uOrtho
          ? 'your orthographic returned a non-Mat4 — reference shown'
          : 'your orthographic ✓ — five equal cubes stay equal; w stayed 1, so no divide'
      setHud(`five identical cubes recede down −z\n${status}`)
    },
  })
  const setHud = hud(container)
  cam3.attachOrbit(widget)

  widgetNote(
    container,
    'Five identical cubes march away from the camera. Left, through a perspective matrix, the far ' +
      'ones shrink — the divide at work. Right, through <em>your</em> <code>orthographic</code> ' +
      'matrix, they stay exactly equal: its bottom row is (0, 0, 0, 1), so w = 1 and the perspective ' +
      'divide does nothing. Drag to orbit both panels together.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ================================================================== */
/* capstone — project3: the whole pipeline is now your code           */
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

const fullPipeline: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  const UP = v3.vec3(0, 1, 0)
  const cam3 = new Camera3D({ yaw: 0.7, pitch: 0.45, dist: 12, target: v3.vec3(0, 0.6, 0) })
  const NEAR = 0.1
  const FAR = 100

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 440,
    draw(ctx, w) {
      const eye = cam3.eye()
      const aspect = w.width / w.height
      const view = cam.lookAt(eye, cam3.target, UP)
      const P = proj.perspective(fovS.get(), aspect, NEAR, FAR)
      const PV = m4.mul4(P, view)

      // Decide once whether the learner's project3 is usable this frame.
      const probe = callProject3(userFns, [...PV], v3.vec3(0, 0.6, 0), w.width, w.height)
      const userOk = userFns != null && probe.ok && probe.value != null
      const useUser = userFns != null && probe.ok

      const projectMvp = (mvp: readonly number[]): Projector => (p) => {
        if (useUser) {
          const r = callProject3(userFns, mvp, p, w.width, w.height)
          return r.ok ? r.value : null
        }
        return proj.project3(asM4(mvp), p, w.width, w.height)
      }

      const worldProj = projectMvp([...PV])
      worldStage(ctx, worldProj, 7)

      for (const obj of SCENE) {
        const mvp = m4.mul4(PV, obj.model)
        const project = projectMvp([...mvp])
        wireCube(ctx, (p) => project(v3.scale(p, obj.half)), CUBE_CORNERS, {
          color: obj.color,
          width: 1.5,
        })
        dot3pt(ctx, project, m4.transformPoint3(obj.model, v3.vec3(0, 0, 0)), {
          color: obj.color,
          r: 3,
          label: obj.label,
        })
      }

      if (userFns && !probe.ok) {
        ctx.save()
        ctx.font = MONO_FONT
        ctx.textAlign = 'center'
        ctx.fillStyle = COLORS.red
        ctx.fillText('your project3 returned a bad shape — reference shown', w.width / 2, 24)
        ctx.restore()
      }

      const status = !userFns
        ? 'reference project3 — solve the capstone below to render with your own pipeline'
        : !probe.ok
          ? 'your project3 misbehaved — reference shown'
          : !userOk
            ? 'your project3 culled the scene center (w ≤ 0?) — check the cull test'
            : 'rendering entirely through YOUR project3 = viewport ∘ ÷w ∘ (P·V·model)'
      setHud(
        `eye ${`(${eye.x.toFixed(1)}, ${eye.y.toFixed(1)}, ${eye.z.toFixed(1)})`}   fovY ${fovS.get().toFixed(2)} rad\n` +
          status,
      )
    },
  })
  const setHud = hud(container)
  cam3.attachOrbit(widget)

  const bar = controlsBar(container)
  const fovS = bar.slider({
    label: 'fovY',
    min: 0.5,
    max: 2.0,
    step: 0.01,
    value: 1.0,
    format: (v) => `${v.toFixed(2)} rad`,
    onInput: () => widget.requestDraw(),
  })

  widgetNote(
    container,
    'Every line on this canvas is drawn by your <code>project3</code>: each cube vertex flows ' +
      'through projection · view · model, keeps its <code>w</code>, gets divided, and lands on a ' +
      'pixel. Drag to orbit, widen the <code>fovY</code>, and watch the perspective respond. This is ' +
      'the black box from Module 1 — gone. The renderer behind every diagram in this course is now ' +
      'entirely functions you wrote.',
  )

  return {
    setUserFns(fns) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ------------------------------------------------------------------ */

export const M05_WIDGETS: Record<string, WidgetFactory> = {
  pinhole,
  frustum,
  'clip-space': clipSpace,
  viewport: viewportMap,
  'ortho-compare': orthoCompare,
  'full-pipeline': fullPipeline,
}
