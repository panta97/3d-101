/**
 * Immediate-mode drawing helpers for the course diagrams.
 * 2D helpers take a Viewport2D (y-up world coords); 3D helpers take a
 * Camera3D plus the widget for sizing. All styling matches styles.css.
 */

import type { Vec2, Vec3 } from '@/math'
import { v2 } from '@/math'
import type { Viewport2D } from './Viewport2D'
import type { Camera3D } from './Camera3D'

export const COLORS = {
  grid: '#2a3040',
  axis: '#3d4456',
  fg: '#c6cdd9',
  dim: '#8a93a5',
  accent: '#61afef',
  green: '#98c379',
  red: '#e06c75',
  yellow: '#e5c07b',
  purple: '#c678dd',
  cyan: '#56b6c2',
  ghost: 'rgba(198, 205, 217, 0.35)',
}

export const MONO_FONT = '12px "SF Mono", ui-monospace, Menlo, Consolas, monospace'

interface StrokeOpts {
  color?: string
  width?: number
  dash?: number[]
}

interface LabelOpts {
  label?: string
  labelColor?: string
}

function stroked(ctx: CanvasRenderingContext2D, opts: StrokeOpts, path: () => void): void {
  ctx.save()
  ctx.strokeStyle = opts.color ?? COLORS.fg
  ctx.lineWidth = opts.width ?? 2
  if (opts.dash) ctx.setLineDash(opts.dash)
  ctx.beginPath()
  path()
  ctx.stroke()
  ctx.restore()
}

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  at: Vec2,
  color = COLORS.fg,
): void {
  ctx.save()
  ctx.font = MONO_FONT
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(text, at.x, at.y)
  ctx.restore()
}

/**
 * Label centered on the screen segment a→b and rotated to lie along it, so a
 * long label never cuts across the line it annotates. `offset` nudges it
 * perpendicular, on the side of `toward` when that point is given. Both a and
 * b are screen-space (already through `vp.toScreen`).
 */
export function drawLabelAlong(
  ctx: CanvasRenderingContext2D,
  text: string,
  a: Vec2,
  b: Vec2,
  opts: { offset?: number; toward?: Vec2; color?: string } = {},
): void {
  let dir = v2.normalize(v2.sub(b, a))
  if (dir.x === 0 && dir.y === 0) return
  if (dir.x < 0) dir = v2.scale(dir, -1) // keep the text upright, never mirrored
  const mid = v2.lerp(a, b, 0.5)

  let perp = v2.vec2(-dir.y, dir.x)
  if (opts.toward && v2.dot(perp, v2.sub(opts.toward, mid)) < 0) perp = v2.scale(perp, -1)
  const at = v2.add(mid, v2.scale(perp, opts.offset ?? 0))

  ctx.save()
  ctx.font = MONO_FONT
  ctx.fillStyle = opts.color ?? COLORS.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.translate(at.x, at.y)
  ctx.rotate(Math.atan2(dir.y, dir.x))
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

/* ------------------------------- 2D ------------------------------- */

/** Unit grid with brighter axes. */
export function grid2(
  ctx: CanvasRenderingContext2D,
  vp: Viewport2D,
  size: { width: number; height: number },
  opts: { step?: number } = {},
): void {
  const step = opts.step ?? 1
  const tl = vp.toWorld(v2.vec2(0, 0))
  const br = vp.toWorld(v2.vec2(size.width, size.height))
  ctx.save()
  ctx.lineWidth = 1
  for (let x = Math.floor(br.x < tl.x ? br.x : tl.x); x <= Math.max(tl.x, br.x); x += step) {
    const gx = Math.round(x / step) * step
    ctx.strokeStyle = Math.abs(gx) < 1e-9 ? COLORS.axis : COLORS.grid
    ctx.beginPath()
    ctx.moveTo(vp.toScreen(v2.vec2(gx, tl.y)).x, 0)
    ctx.lineTo(vp.toScreen(v2.vec2(gx, br.y)).x, size.height)
    ctx.stroke()
  }
  for (let y = Math.floor(Math.min(tl.y, br.y)); y <= Math.max(tl.y, br.y); y += step) {
    const gy = Math.round(y / step) * step
    ctx.strokeStyle = Math.abs(gy) < 1e-9 ? COLORS.axis : COLORS.grid
    const sy = vp.toScreen(v2.vec2(0, gy)).y
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(size.width, sy)
    ctx.stroke()
  }
  ctx.restore()
}

export function line2(
  ctx: CanvasRenderingContext2D,
  vp: Viewport2D,
  a: Vec2,
  b: Vec2,
  opts: StrokeOpts = {},
): void {
  const sa = vp.toScreen(a)
  const sb = vp.toScreen(b)
  stroked(ctx, opts, () => {
    ctx.moveTo(sa.x, sa.y)
    ctx.lineTo(sb.x, sb.y)
  })
}

export function arrow2(
  ctx: CanvasRenderingContext2D,
  vp: Viewport2D,
  from: Vec2,
  to: Vec2,
  opts: StrokeOpts & LabelOpts = {},
): void {
  const sa = vp.toScreen(from)
  const sb = vp.toScreen(to)
  const dir = v2.normalize(v2.sub(sb, sa))
  if (dir.x === 0 && dir.y === 0) return
  const headLen = 10
  const base = v2.sub(sb, v2.scale(dir, headLen))
  const perp = v2.vec2(-dir.y, dir.x)
  const w1 = v2.add(base, v2.scale(perp, headLen * 0.45))
  const w2 = v2.sub(base, v2.scale(perp, headLen * 0.45))

  stroked(ctx, opts, () => {
    ctx.moveTo(sa.x, sa.y)
    ctx.lineTo(base.x, base.y)
  })
  ctx.save()
  ctx.fillStyle = opts.color ?? COLORS.fg
  ctx.beginPath()
  ctx.moveTo(sb.x, sb.y)
  ctx.lineTo(w1.x, w1.y)
  ctx.lineTo(w2.x, w2.y)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  if (opts.label) {
    const mid = v2.add(v2.lerp(sa, sb, 0.55), v2.scale(perp, -14))
    drawLabel(ctx, opts.label, mid, opts.labelColor ?? opts.color ?? COLORS.fg)
  }
}

export function point2(
  ctx: CanvasRenderingContext2D,
  vp: Viewport2D,
  p: Vec2,
  opts: { color?: string; r?: number } & LabelOpts = {},
): void {
  const s = vp.toScreen(p)
  ctx.save()
  ctx.fillStyle = opts.color ?? COLORS.fg
  ctx.beginPath()
  ctx.arc(s.x, s.y, opts.r ?? 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  if (opts.label) {
    drawLabel(ctx, opts.label, v2.vec2(s.x + 9, s.y - 9), opts.labelColor ?? opts.color)
  }
}

/** Arc marking the angle at `center` between directions a and b. */
export function angleArc2(
  ctx: CanvasRenderingContext2D,
  vp: Viewport2D,
  center: Vec2,
  a: Vec2,
  b: Vec2,
  opts: { radiusPx?: number; color?: string } & LabelOpts = {},
): void {
  const c = vp.toScreen(center)
  // Screen space is y-down, so screen angles run clockwise; negate.
  const a0 = -Math.atan2(a.y, a.x)
  const a1 = -Math.atan2(b.y, b.x)
  let sweep = a1 - a0
  while (sweep > Math.PI) sweep -= 2 * Math.PI
  while (sweep < -Math.PI) sweep += 2 * Math.PI
  const r = opts.radiusPx ?? 30
  ctx.save()
  ctx.strokeStyle = opts.color ?? COLORS.yellow
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(c.x, c.y, r, a0, a0 + sweep, sweep < 0)
  ctx.stroke()
  ctx.restore()
  if (opts.label) {
    const midA = a0 + sweep / 2
    drawLabel(
      ctx,
      opts.label,
      v2.vec2(c.x + Math.cos(midA) * (r + 14) - 8, c.y + Math.sin(midA) * (r + 14)),
      opts.labelColor ?? opts.color ?? COLORS.yellow,
    )
  }
}

/* ------------------------------- 3D ------------------------------- */

type Size = { width: number; height: number }

export function line3(
  ctx: CanvasRenderingContext2D,
  cam: Camera3D,
  size: Size,
  a: Vec3,
  b: Vec3,
  opts: StrokeOpts = {},
): void {
  const sa = cam.project3(a, size)
  const sb = cam.project3(b, size)
  if (!sa || !sb) return
  stroked(ctx, opts, () => {
    ctx.moveTo(sa.x, sa.y)
    ctx.lineTo(sb.x, sb.y)
  })
}

export function arrow3(
  ctx: CanvasRenderingContext2D,
  cam: Camera3D,
  size: Size,
  from: Vec3,
  to: Vec3,
  opts: StrokeOpts & LabelOpts = {},
): void {
  const sa = cam.project3(from, size)
  const sb = cam.project3(to, size)
  if (!sa || !sb) return
  const dir = v2.normalize(v2.vec2(sb.x - sa.x, sb.y - sa.y))
  const headLen = Math.min(10, 0.5 * sb.scale)
  const bx = sb.x - dir.x * headLen
  const by = sb.y - dir.y * headLen
  stroked(ctx, opts, () => {
    ctx.moveTo(sa.x, sa.y)
    ctx.lineTo(bx, by)
  })
  ctx.save()
  ctx.fillStyle = opts.color ?? COLORS.fg
  ctx.beginPath()
  ctx.moveTo(sb.x, sb.y)
  ctx.lineTo(bx - dir.y * headLen * 0.45, by + dir.x * headLen * 0.45)
  ctx.lineTo(bx + dir.y * headLen * 0.45, by - dir.x * headLen * 0.45)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  if (opts.label) {
    drawLabel(ctx, opts.label, v2.vec2(sb.x + 8, sb.y - 8), opts.labelColor ?? opts.color)
  }
}

export function point3(
  ctx: CanvasRenderingContext2D,
  cam: Camera3D,
  size: Size,
  p: Vec3,
  opts: { color?: string; r?: number } & LabelOpts = {},
): void {
  const s = cam.project3(p, size)
  if (!s) return
  // Perspective-scaled radius so nearer points read as nearer.
  const r = (opts.r ?? 0.06) * s.scale
  ctx.save()
  ctx.fillStyle = opts.color ?? COLORS.fg
  ctx.beginPath()
  ctx.arc(s.x, s.y, Math.max(1.5, r), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  if (opts.label) {
    drawLabel(ctx, opts.label, v2.vec2(s.x + 8, s.y - 8), opts.labelColor ?? opts.color)
  }
}

/** Ground grid on the y = 0 plane, centered at the origin. */
export function grid3(
  ctx: CanvasRenderingContext2D,
  cam: Camera3D,
  size: Size,
  opts: { extent?: number; step?: number } = {},
): void {
  const e = opts.extent ?? 6
  const step = opts.step ?? 1
  for (let i = -e; i <= e; i += step) {
    const major = Math.abs(i) < 1e-9
    line3(ctx, cam, size, { x: i, y: 0, z: -e }, { x: i, y: 0, z: e }, {
      color: major ? COLORS.axis : COLORS.grid,
      width: 1,
    })
    line3(ctx, cam, size, { x: -e, y: 0, z: i }, { x: e, y: 0, z: i }, {
      color: major ? COLORS.axis : COLORS.grid,
      width: 1,
    })
  }
}

/** x̂/ŷ/ẑ axis tripod at the origin (red/green/blue by convention). */
export function axes3(ctx: CanvasRenderingContext2D, cam: Camera3D, size: Size, len = 2): void {
  const o = { x: 0, y: 0, z: 0 }
  arrow3(ctx, cam, size, o, { x: len, y: 0, z: 0 }, { color: COLORS.red, label: 'x' })
  arrow3(ctx, cam, size, o, { x: 0, y: len, z: 0 }, { color: COLORS.green, label: 'y' })
  arrow3(ctx, cam, size, o, { x: 0, y: 0, z: len }, { color: COLORS.accent, label: 'z' })
}
