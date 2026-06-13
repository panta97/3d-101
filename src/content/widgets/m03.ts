/**
 * Module 3 widgets — Matrices: Transforming Space.
 *
 * House style (see m01.ts): factories receive the mount container, return
 * { setUserFns } when exercise-driven, and NEVER trust learner return values
 * (guards from ./util). Every widget renders something sensible before any
 * learner code exists.
 *
 * The grid deformer is built once (makeGridDeformer) and registered twice:
 * 'grid-deformer' (3.1, drag the basis) and 'matrix-factory' (3.2, sliders).
 */

import { v2, v3, m2, m3, m4 } from '@/math'
import type { Vec2, Vec3, Mat2, Mat3, Mat4 } from '@/math'
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
import { isVec2, isVec3, isFiniteNumber, isNumberArray } from './util'

/* ------------------------------------------------------------------ */
/* shared guards + drawing helpers                                     */
/* ------------------------------------------------------------------ */

const asM2 = (a: readonly number[]): Mat2 => a as Mat2
const asM3 = (a: readonly number[]): Mat3 => a as Mat3
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
    // Fresh array copies per call: learner mutation can't poison our frame.
    const r = f(...args.map((a) => (Array.isArray(a) ? a.slice() : a)))
    return isNumberArray(r, len) ? r : null
  } catch {
    return null
  }
}

/** Guarded (matrix, Vec2) → Vec2 learner call as a reusable point mapper. */
function matVec2Map(
  fns: UserFns | null,
  name: string,
  m: readonly number[],
): ((p: Vec2) => Vec2 | null) | null {
  const f = fns?.[name]
  if (typeof f !== 'function') return null
  return (p) => {
    try {
      const r = f(m.slice(), { x: p.x, y: p.y })
      return isVec2(r) ? r : null
    } catch {
      return null
    }
  }
}

/** Guarded (matrix, Vec3) → Vec3 learner call. */
function matVec3Map(
  fns: UserFns | null,
  name: string,
  m: readonly number[],
): ((p: Vec3) => Vec3 | null) | null {
  const f = fns?.[name]
  if (typeof f !== 'function') return null
  return (p) => {
    try {
      const r = f(m.slice(), { x: p.x, y: p.y, z: p.z })
      return isVec3(r) ? r : null
    } catch {
      return null
    }
  }
}

/** Polyline/polygon through world points; null entries break the pen. */
function path2(
  ctx: CanvasRenderingContext2D,
  vp: Viewport2D,
  pts: readonly (Vec2 | null)[],
  opts: { color: string; width?: number; dash?: number[]; close?: boolean; fill?: string },
): void {
  ctx.save()
  ctx.strokeStyle = opts.color
  ctx.lineWidth = opts.width ?? 2
  if (opts.dash) ctx.setLineDash(opts.dash)
  ctx.beginPath()
  let pen = false
  let broken = false
  for (const p of pts) {
    if (!p) {
      pen = false
      broken = true
      continue
    }
    const s = vp.toScreen(p)
    if (pen) ctx.lineTo(s.x, s.y)
    else ctx.moveTo(s.x, s.y)
    pen = true
  }
  if (opts.close && !broken) ctx.closePath()
  if (opts.fill && !broken) {
    ctx.fillStyle = opts.fill
    ctx.fill()
  }
  ctx.stroke()
  ctx.restore()
}

/** 3D polyline through the camera; null points (or behind-camera) lift the pen. */
function path3(
  ctx: CanvasRenderingContext2D,
  cam: Camera3D,
  size: { width: number; height: number },
  pts: readonly (Vec3 | null)[],
  opts: { color: string; width?: number; dash?: number[] },
): void {
  ctx.save()
  ctx.strokeStyle = opts.color
  ctx.lineWidth = opts.width ?? 1
  if (opts.dash) ctx.setLineDash(opts.dash)
  ctx.beginPath()
  let pen = false
  for (const p of pts) {
    const s = p ? cam.project3(p, size) : null
    if (!s) {
      pen = false
      continue
    }
    if (pen) ctx.lineTo(s.x, s.y)
    else ctx.moveTo(s.x, s.y)
    pen = true
  }
  ctx.stroke()
  ctx.restore()
}

function labelAtCentroid(
  ctx: CanvasRenderingContext2D,
  vp: Viewport2D,
  pts: readonly (Vec2 | null)[],
  text: string,
  color: string,
): void {
  let sx = 0
  let sy = 0
  let n = 0
  for (const p of pts) {
    if (!p) continue
    sx += p.x
    sy += p.y
    n++
  }
  if (n === 0) return
  const s = vp.toScreen(v2.vec2(sx / n, sy / n))
  draw.drawLabel(ctx, text, v2.vec2(s.x - 18, s.y), color)
}

/** Corner Mat2 readout, column 1 in red, column 2 in green (matches arrows). */
function mat2Readout(
  ctx: CanvasRenderingContext2D,
  m: readonly number[],
  right: number,
  top: number,
): void {
  const f = (n: number) => (Object.is(n, -0) ? 0 : n).toFixed(2).padStart(6)
  const colW = 54
  const x0 = right - 2 * colW - 22
  const y0 = top
  const y1 = top + 17
  ctx.save()
  ctx.font = MONO_FONT
  ctx.textBaseline = 'middle'
  // brackets
  ctx.strokeStyle = COLORS.dim
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x0 + 5, y0 - 9)
  ctx.lineTo(x0, y0 - 9)
  ctx.lineTo(x0, y1 + 9)
  ctx.lineTo(x0 + 5, y1 + 9)
  ctx.moveTo(right - 5, y0 - 9)
  ctx.lineTo(right, y0 - 9)
  ctx.lineTo(right, y1 + 9)
  ctx.lineTo(right - 5, y1 + 9)
  ctx.stroke()
  ctx.fillStyle = COLORS.red
  ctx.fillText(f(m[0]), x0 + 8, y0)
  ctx.fillText(f(m[1]), x0 + 8, y1)
  ctx.fillStyle = COLORS.green
  ctx.fillText(f(m[2]), x0 + 8 + colW, y0)
  ctx.fillText(f(m[3]), x0 + 8 + colW, y1)
  ctx.restore()
}

/** The letter F — the course's canonical "did space flip?" test shape. */
const F_OUTLINE: readonly Vec2[] = [
  v2.vec2(0, 0),
  v2.vec2(0.4, 0),
  v2.vec2(0.4, 0.8),
  v2.vec2(1.0, 0.8),
  v2.vec2(1.0, 1.1),
  v2.vec2(0.4, 1.1),
  v2.vec2(0.4, 1.6),
  v2.vec2(1.2, 1.6),
  v2.vec2(1.2, 2),
  v2.vec2(0, 2),
]

/* ------------------------------------------------------------------ */
/* the grid deformer (3.1 + 3.2)                                       */
/* ------------------------------------------------------------------ */

interface DeformerModel {
  /** Matrix on display — guarded finite numbers, column-major [ix,iy,jx,jy]. */
  m: readonly number[]
  /** Where points go; null = learner code broke on that input (skip, flag). */
  map(p: Vec2): Vec2 | null
  /** HUD text; `broke` is true if map returned null anywhere this frame. */
  hud(broke: boolean): string
  /** Extra painting after the scene (e.g. the det2 area meter). */
  overlay?(ctx: CanvasRenderingContext2D, w: CanvasWidget): void
}

interface GridDeformerConfig {
  height?: number
  unitsHigh?: number
  init(env: {
    container: HTMLElement
    widget: CanvasWidget
    vp: Viewport2D
    user(): UserFns | null
  }): () => DeformerModel
}

function drawDeformerScene(
  ctx: CanvasRenderingContext2D,
  vp: Viewport2D,
  w: CanvasWidget,
  mdl: DeformerModel,
): boolean {
  let broke = false
  const map = (p: Vec2): Vec2 | null => {
    const r = mdl.map(p)
    if (!r) broke = true
    return r
  }

  draw.grid2(ctx, vp, w)

  // Deformed gridlines, sampled so non-linear garbage shows itself as curves.
  const E = 4
  const gridC = 'rgba(97, 175, 239, 0.28)'
  const axisC = 'rgba(97, 175, 239, 0.55)'
  for (let i = -E; i <= E; i++) {
    const vert: (Vec2 | null)[] = []
    const horz: (Vec2 | null)[] = []
    for (let s = -E; s <= E; s += 0.5) {
      vert.push(map(v2.vec2(i, s)))
      horz.push(map(v2.vec2(s, i)))
    }
    const c = i === 0 ? axisC : gridC
    path2(ctx, vp, vert, { color: c, width: 1 })
    path2(ctx, vp, horz, { color: c, width: 1 })
  }

  // Image of the unit square — the determinant's parallelogram.
  const sq = [v2.vec2(0, 0), v2.vec2(1, 0), v2.vec2(1, 1), v2.vec2(0, 1)].map(map)
  if (sq.every((p): p is Vec2 => p !== null)) {
    const d = v2.cross2(v2.sub(sq[1], sq[0]), v2.sub(sq[3], sq[0]))
    path2(ctx, vp, sq, {
      color: d < 0 ? COLORS.red : COLORS.green,
      width: 1,
      close: true,
      fill: d < 0 ? 'rgba(224, 108, 117, 0.18)' : 'rgba(152, 195, 121, 0.13)',
    })
  }

  // The letter F: original ghost + image.
  path2(ctx, vp, F_OUTLINE, { color: COLORS.ghost, width: 1.5, close: true })
  path2(ctx, vp, F_OUTLINE.map(map), {
    color: COLORS.yellow,
    width: 2,
    close: true,
    fill: 'rgba(229, 192, 123, 0.12)',
  })

  // The basis arrows ARE the matrix columns.
  const o = v2.vec2(0, 0)
  draw.arrow2(ctx, vp, o, v2.vec2(mdl.m[0], mdl.m[1]), { color: COLORS.red, width: 3, label: 'î' })
  draw.arrow2(ctx, vp, o, v2.vec2(mdl.m[2], mdl.m[3]), { color: COLORS.green, width: 3, label: 'ĵ' })

  mat2Readout(ctx, mdl.m, w.width - 16, 22)
  return broke
}

function makeGridDeformer(config: GridDeformerConfig): WidgetFactory {
  return (container) => {
    let userFns: UserFns | null = null
    let model: (() => DeformerModel) | null = null

    const widget = new CanvasWidget(container, {
      mode: 'static',
      height: config.height ?? 380,
      draw(ctx, w) {
        if (!model) return
        const mdl = model()
        const broke = drawDeformerScene(ctx, vp, w, mdl)
        mdl.overlay?.(ctx, w)
        setHud(mdl.hud(broke))
      },
    })
    const vp = new Viewport2D(widget, { unitsHigh: config.unitsHigh ?? 9 })
    const setHud = hud(container)
    model = config.init({ container, widget, vp, user: () => userFns })

    return {
      setUserFns(fns: UserFns | null) {
        userFns = fns
        widget.requestDraw()
      },
    }
  }
}

/** 3.1 — drag the tips of î and ĵ; learner transformVec2 deforms space. */
const gridDeformer = makeGridDeformer({
  init({ container, widget, vp, user }) {
    let iTip = v2.vec2(1.3, 0.5)
    let jTip = v2.vec2(-0.6, 1.1)
    widget.handles.push(
      worldHandle(vp, () => iTip, (p) => (iTip = p)),
      worldHandle(vp, () => jTip, (p) => (jTip = p)),
    )

    const bar = controlsBar(container)
    const set = (i: Vec2, j: Vec2) => {
      iTip = i
      jTip = j
      widget.requestDraw()
    }
    bar.button({ label: 'identity', onClick: () => set(v2.vec2(1, 0), v2.vec2(0, 1)) })
    bar.button({ label: 'rot 90°', onClick: () => set(v2.vec2(0, 1), v2.vec2(-1, 0)) })
    bar.button({ label: 'shear', onClick: () => set(v2.vec2(1, 0), v2.vec2(1, 1)) })
    bar.button({ label: 'flip', onClick: () => set(v2.vec2(0, 1), v2.vec2(1, 0)) })
    widgetNote(
      container,
      'Drag the tips of <span style="color:#e06c75">î</span> and ' +
        '<span style="color:#98c379">ĵ</span> — those two arrows <em>are</em> the matrix ' +
        '(red = column 1, green = column 2 in the readout). Every gridline and F vertex is ' +
        'pushed through <code>transformVec2(m, v)</code>, one vector at a time.',
    )

    return () => {
      const fns = user()
      const m = [iTip.x, iTip.y, jTip.x, jTip.y]
      const userMap = matVec2Map(fns, 'transformVec2', m)
      return {
        m,
        map: userMap ?? ((p) => m2.transformVec2(asM2(m), p)),
        hud: (broke) =>
          `m = [${m.map((n) => n.toFixed(2)).join(', ')}]\n` +
          (!userMap
            ? 'reference transformVec2 — solve the exercise below to take over'
            : broke
              ? 'your transformVec2 returned a non-vector for some inputs'
              : 'space deformed by YOUR transformVec2(m, v)'),
      }
    }
  },
})

/** 3.2 — θ/sx/sy sliders drive learner rotation2/scaling2; det2 meters area. */
const matrixFactory = makeGridDeformer({
  init({ container, widget, user }) {
    let mode: 'rotate' | 'scale' | 'both' = 'both'
    const redraw = () => widget.requestDraw()

    const bar = controlsBar(container)
    const theta = bar.slider({
      label: 'θ',
      min: -Math.PI,
      max: Math.PI,
      step: 0.01,
      value: 0.52,
      format: (v) => `${v.toFixed(2)} rad = ${Math.round((v * 180) / Math.PI)}°`,
      onInput: redraw,
    })
    const sx = bar.slider({ label: 'sx', min: -2, max: 2, step: 0.05, value: 1.5, onInput: redraw })
    const sy = bar.slider({ label: 'sy', min: -2, max: 2, step: 0.05, value: 0.7, onInput: redraw })

    const modeBar = controlsBar(container)
    modeBar.readout('show:')
    const buttons = {} as Record<'rotate' | 'scale' | 'both', HTMLButtonElement>
    const setMode = (m: typeof mode) => {
      mode = m
      for (const key of ['rotate', 'scale', 'both'] as const) {
        buttons[key].classList.toggle('primary', key === m)
      }
      redraw()
    }
    buttons.rotate = modeBar.button({ label: 'rotation2(θ)', onClick: () => setMode('rotate') })
    buttons.scale = modeBar.button({ label: 'scaling2(sx, sy)', onClick: () => setMode('scale') })
    buttons.both = modeBar.button({ label: 'rotate ∘ scale', onClick: () => setMode('both') })
    buttons.both.classList.add('primary')

    widgetNote(
      container,
      'The grid deforms through the matrix your factories return; the green/red parallelogram ' +
        'is the image of the unit square, and your <code>det2</code> reports its signed area. ' +
        'In rotate ∘ scale mode the two are combined with <em>our</em> <code>mul2</code> — you build that in 3.3.',
    )

    return () => {
      const fns = user()
      const t = theta.get()
      const uR = callMat(fns, 'rotation2', [t], 4)
      const uS = callMat(fns, 'scaling2', [sx.get(), sy.get()], 4)
      const R = uR ?? [...m2.rotation2(t)]
      const S = uS ?? [...m2.scaling2(sx.get(), sy.get())]
      const m = mode === 'rotate' ? R : mode === 'scale' ? S : [...m2.mul2(asM2(R), asM2(S))]

      let det: number | null | undefined
      const detFn = fns?.det2
      if (typeof detFn !== 'function') {
        det = undefined // no learner code at all
      } else {
        try {
          const d = detFn(m.slice())
          det = isFiniteNumber(d) ? d : null
        } catch {
          det = null
        }
      }

      const formula =
        mode === 'rotate'
          ? 'm = rotation2(θ)'
          : mode === 'scale'
            ? 'm = scaling2(sx, sy)'
            : 'm = mul2(rotation2(θ), scaling2(sx, sy))'
      const tag = (u: number[] | null) => (u ? 'yours' : 'bad return — reference shown')
      const status = !fns
        ? 'reference factories — solve the exercise below to take over'
        : `rotation2: ${tag(uR)}   scaling2: ${tag(uS)}`

      return {
        m,
        map: (p) => m2.transformVec2(asM2(m), p),
        hud: () => `${formula}\n${status}`,
        overlay(ctx, w) {
          ctx.save()
          ctx.font = MONO_FONT
          ctx.textBaseline = 'middle'
          const y = w.height - 18
          if (det === undefined) {
            ctx.fillStyle = COLORS.dim
            ctx.fillText('area meter offline — your det2 powers it', 14, y)
          } else if (det === null) {
            ctx.fillStyle = COLORS.red
            ctx.fillText('your det2 returned a non-number', 14, y)
          } else if (Math.abs(det) < 1e-9) {
            ctx.fillStyle = COLORS.yellow
            ctx.fillText('det2 = 0 — space squashed flat', 14, y)
          } else {
            ctx.fillStyle = det < 0 ? COLORS.red : COLORS.green
            ctx.fillText(
              `det2 = ${det.toFixed(2)} → area ×${Math.abs(det).toFixed(2)}` +
                (det < 0 ? '  FLIPPED inside-out!' : ''),
              14,
              y,
            )
          }
          ctx.restore()
        },
      }
    }
  },
})

/* ------------------------------------------------------------------ */
/* 3.3 — pipeline (composition oracle)                                 */
/* ------------------------------------------------------------------ */

const PIPELINE_PRESETS = [
  { id: 'rot90', label: 'rot 90°', m: [0, 1, -1, 0] },
  { id: 'rot45', label: 'rot 45°', m: [...m2.rotation2(Math.PI / 4)] },
  { id: 'stretch2x', label: 'stretch ×2', m: [2, 0, 0, 1] },
  { id: 'shearX', label: 'shear x', m: [1, 0, 1, 1] },
  { id: 'flipX', label: 'flip x', m: [-1, 0, 0, 1] },
] as const
type PresetId = (typeof PIPELINE_PRESETS)[number]['id']

const pipeline: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let firstId: PresetId = 'rot90'
  let secondId: PresetId = 'stretch2x'
  const preset = (id: PresetId) => PIPELINE_PRESETS.find((p) => p.id === id)!

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 380,
    draw(ctx, w) {
      const first = preset(firstId)
      const second = preset(secondId)
      const M1 = first.m
      const M2 = second.m

      draw.grid2(ctx, vp, w)
      path2(ctx, vp, F_OUTLINE, { color: COLORS.ghost, width: 1.5, close: true })

      const afterFirst = F_OUTLINE.map((p) => m2.transformVec2(asM2(M1), p))
      path2(ctx, vp, afterFirst, { color: COLORS.cyan, width: 1.5, close: true })

      const uProduct = callMat(userFns, 'mul2', [M2, M1], 4)
      const product = uProduct ?? [...m2.mul2(asM2(M2), asM2(M1))]
      const afterBoth = F_OUTLINE.map((p) => m2.transformVec2(asM2(product), p))
      path2(ctx, vp, afterBoth, {
        color: COLORS.yellow,
        width: 2.5,
        close: true,
        fill: 'rgba(229, 192, 123, 0.12)',
      })

      // Oracle: apply the two matrices one after another, vertex by vertex.
      const twoStep = afterFirst.map((p) => m2.transformVec2(asM2(M2), p))
      let disagrees = false
      if (uProduct) {
        disagrees = twoStep.some((p, i) => v2.distance(p, afterBoth[i]) > 1e-4)
        if (disagrees) {
          path2(ctx, vp, twoStep, { color: COLORS.red, width: 2, close: true, dash: [6, 4] })
          draw.drawLabel(
            ctx,
            'your mul2 disagrees with apply-twice — red dashed F is the truth',
            v2.vec2(14, w.height - 16),
            COLORS.red,
          )
        }
      }

      labelAtCentroid(ctx, vp, F_OUTLINE, 'original', COLORS.dim)
      labelAtCentroid(ctx, vp, afterFirst, `after ${first.label}`, COLORS.cyan)
      labelAtCentroid(
        ctx,
        vp,
        afterBoth,
        userFns ? 'your mul2' : 'reference mul2',
        COLORS.yellow,
      )
      mat2Readout(ctx, product, w.width - 16, 22)

      const status = !userFns
        ? 'reference mul2 — solve the exercise below to take over'
        : !uProduct
          ? 'your mul2 returned a bad Mat2 — reference shown'
          : disagrees
            ? 'hint: each result column = M2 applied to a column of M1'
            : 'your mul2 matches apply-twice ✓'
      setHud(
        `M = ${second.label} · ${first.label}  — right-to-left: ${first.label} happens first\n${status}`,
      )
    },
  })
  const vp = new Viewport2D(widget, { unitsHigh: 9, center: v2.vec2(0.3, 0.5) })
  const setHud = hud(container)

  const rowA = controlsBar(container)
  rowA.readout('M1 (applied FIRST):')
  const aButtons = PIPELINE_PRESETS.map((p) =>
    rowA.button({
      label: p.label,
      onClick: () => {
        firstId = p.id
        refresh()
      },
    }),
  )
  const rowB = controlsBar(container)
  rowB.readout('M2 (applied SECOND):')
  const bButtons = PIPELINE_PRESETS.map((p) =>
    rowB.button({
      label: p.label,
      onClick: () => {
        secondId = p.id
        refresh()
      },
    }),
  )
  const rowC = controlsBar(container)
  rowC.button({
    label: '⇄ swap order',
    primary: true,
    onClick: () => {
      ;[firstId, secondId] = [secondId, firstId]
      refresh()
    },
  })

  function refresh(): void {
    PIPELINE_PRESETS.forEach((p, i) => {
      aButtons[i].classList.toggle('primary', p.id === firstId)
      bButtons[i].classList.toggle('primary', p.id === secondId)
    })
    widget.requestDraw()
  }
  refresh()

  widgetNote(
    container,
    'The yellow F is the single product <code>mul2(M2, M1)</code> applied once. The widget ' +
      'also runs M1 then M2 step by step — if your product disagrees on any vertex, the honest ' +
      'two-step result appears as a red dashed F. Hit swap and watch the orders diverge.',
  )

  return {
    setUserFns(fns: UserFns | null) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ------------------------------------------------------------------ */
/* 3.4 — the lift (homogeneous coordinates, split 2D/3D view)          */
/* ------------------------------------------------------------------ */

const theLift: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let asDirection = false
  let v0 = v2.vec2(1.6, 1.2)
  const H = 1.5 // drawn height of the w = 1 plane
  const EXT = 2 // half-extent of the embedded plane grids

  const cam = new Camera3D({ yaw: 0.85, pitch: 0.45, dist: 11, target: v3.vec3(0, 0.8, 0), focal: 1.1 })
  const lift = (p: Vec2, wc: number): Vec3 => v3.vec3(p.x, wc * H, -p.y)

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 420,
    draw(ctx, w) {
      const fns = userFns
      const txv = tx.get()
      const tyv = ty.get()
      const uT = callMat(fns, 'translation2', [txv, tyv], 9)
      const M = uT ?? [...m3.translation2(txv, tyv)]

      let brokeP = false
      let brokeD = false
      const userP = matVec2Map(fns, 'transformPoint2', M)
      const userD = matVec2Map(fns, 'transformDir2', M)
      const mapP = (p: Vec2): Vec2 | null => {
        if (!userP) return m3.transformPoint2(asM3(M), p)
        const r = userP(p)
        if (!r) brokeP = true
        return r
      }
      const mapD = (p: Vec2): Vec2 | null => {
        if (!userD) return m3.transformDir2(asM3(M), p)
        const r = userD(p)
        if (!r) brokeD = true
        return r
      }

      const sizeL = { width: w.width / 2, height: w.height }
      const res = asDirection ? mapD(v0) : mapP(v0)

      /* ---- left half: the flat 2D world ---- */
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, sizeL.width, w.height)
      ctx.clip()
      draw.grid2(ctx, vpL, sizeL)
      path2(ctx, vpL, F_OUTLINE, { color: COLORS.ghost, width: 1.5, close: true })
      path2(ctx, vpL, F_OUTLINE.map(mapP), {
        color: COLORS.yellow,
        width: 2,
        close: true,
        fill: 'rgba(229, 192, 123, 0.12)',
      })
      const O = v2.vec2(0, 0)
      draw.arrow2(ctx, vpL, O, v0, { color: COLORS.ghost, width: 4 })
      if (res) {
        draw.arrow2(ctx, vpL, O, res, {
          color: COLORS.purple,
          width: 2,
          label: asDirection ? 'direction (w=0)' : 'point (w=1)',
        })
      }
      draw.drawLabel(ctx, '2D world', v2.vec2(12, w.height - 16), COLORS.dim)
      ctx.restore()

      /* ---- right half: homogeneous space, w drawn as height ---- */
      ctx.save()
      ctx.translate(w.width / 2, 0)
      ctx.beginPath()
      ctx.rect(0, 0, sizeL.width, w.height)
      ctx.clip()

      // w = 0 floor through learner transformDir2 (translation must NOT move it)
      // and w = 1 plane through learner transformPoint2 (it slides).
      for (let i = -EXT; i <= EXT; i++) {
        const a: (Vec3 | null)[] = []
        const b: (Vec3 | null)[] = []
        const c: (Vec3 | null)[] = []
        const d: (Vec3 | null)[] = []
        for (let s = -EXT; s <= EXT; s++) {
          const q0 = mapD(v2.vec2(i, s))
          const q1 = mapD(v2.vec2(s, i))
          const q2 = mapP(v2.vec2(i, s))
          const q3 = mapP(v2.vec2(s, i))
          a.push(q0 ? lift(q0, 0) : null)
          b.push(q1 ? lift(q1, 0) : null)
          c.push(q2 ? lift(q2, 1) : null)
          d.push(q3 ? lift(q3, 1) : null)
        }
        path3(ctx, cam, sizeL, a, { color: COLORS.axis, width: 1 })
        path3(ctx, cam, sizeL, b, { color: COLORS.axis, width: 1 })
        path3(ctx, cam, sizeL, c, { color: 'rgba(97, 175, 239, 0.5)', width: 1 })
        path3(ctx, cam, sizeL, d, { color: 'rgba(97, 175, 239, 0.5)', width: 1 })
      }

      // Shear rails: the corners of the plane lean from w=0 to their w=1 image.
      for (const cx of [-EXT, EXT]) {
        for (const cy of [-EXT, EXT]) {
          const corner = v2.vec2(cx, cy)
          const img = mapP(corner)
          if (img) {
            path3(ctx, cam, sizeL, [lift(corner, 0), lift(img, 1)], {
              color: 'rgba(229, 192, 123, 0.55)',
              width: 1,
              dash: [5, 4],
            })
          }
        }
      }

      // The F lives on the w = 1 plane: ghost where it was, yellow where it went.
      const fGhost = [...F_OUTLINE, F_OUTLINE[0]].map((p) => lift(p, 1))
      path3(ctx, cam, sizeL, fGhost, { color: COLORS.ghost, width: 1.5 })
      const fMoved = [...F_OUTLINE, F_OUTLINE[0]].map((p) => {
        const q = mapP(p)
        return q ? lift(q, 1) : null
      })
      path3(ctx, cam, sizeL, fMoved, { color: COLORS.yellow, width: 2 })

      // w axis + plane labels.
      draw.arrow3(ctx, cam, sizeL, v3.vec3(0, 0, 0), v3.vec3(0, H * 1.35, 0), {
        color: COLORS.fg,
        width: 1.5,
        label: 'w',
      })
      const l0 = cam.toScreen(lift(v2.vec2(-EXT, -EXT), 0), sizeL)
      if (l0) draw.drawLabel(ctx, 'w = 0  (directions)', v2.vec2(l0.x - 30, l0.y + 14), COLORS.dim)
      const l1 = cam.toScreen(lift(v2.vec2(-EXT, -EXT), 1), sizeL)
      if (l1) draw.drawLabel(ctx, 'w = 1  (points)', v2.vec2(l1.x - 30, l1.y - 10), COLORS.accent)

      // The test vector, riding (or not) at its w height.
      const wc = asDirection ? 0 : 1
      draw.point3(ctx, cam, sizeL, lift(v0, wc), { color: COLORS.ghost, r: 0.05 })
      if (res) {
        draw.point3(ctx, cam, sizeL, lift(res, wc), { color: COLORS.purple, r: 0.06 })
      }

      draw.drawLabel(ctx, '3D homogeneous — drag to orbit', v2.vec2(12, w.height - 16), COLORS.dim)
      ctx.restore()

      // Divider.
      ctx.save()
      ctx.strokeStyle = '#323845'
      ctx.beginPath()
      ctx.moveTo(w.width / 2, 0)
      ctx.lineTo(w.width / 2, w.height)
      ctx.stroke()
      ctx.restore()

      const fmt = (p: Vec2 | null) => (p ? `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})` : '(?)')
      const status = !fns
        ? 'reference functions — solve the exercise below to take over'
        : `translation2: ${uT ? 'yours' : 'bad return — reference'}   ` +
          `transformPoint2: ${!userP ? '—' : brokeP ? 'bad return' : 'yours'}   ` +
          `transformDir2: ${!userD ? '—' : brokeD ? 'bad return' : 'yours'}`
      setHud(
        `M = translation2(${txv.toFixed(2)}, ${tyv.toFixed(2)})\n` +
          (asDirection
            ? `direction ${fmt(v0)} → ${fmt(res)} — w = 0 kills the translation column`
            : `point ${fmt(v0)} → ${fmt(res)} — w = 1 picks it up once`) +
          `\n${status}`,
      )
    },
  })

  // A Viewport2D that believes the canvas is only the left half.
  const halfWidget = {
    get width() {
      return widget.width / 2
    },
    get height() {
      return widget.height
    },
  }
  const vpL = new Viewport2D(halfWidget as unknown as CanvasWidget, {
    center: v2.vec2(0.6, 1),
    unitsHigh: 9,
  })
  const setHud = hud(container)

  cam.attachOrbit(widget)
  const orbit = widget.onBackgroundDrag!
  widget.onBackgroundDrag = (dx, dy, pos) => {
    if (pos.x > widget.width / 2) orbit(dx, dy, pos)
  }

  widget.handles.push(
    worldHandle(
      vpL,
      () => v0,
      (p) => (v0 = v2.vec2(Math.min(2.8, Math.max(-2.6, p.x)), Math.min(4, Math.max(-2.6, p.y)))),
    ),
  )

  const bar = controlsBar(container)
  const redraw = () => widget.requestDraw()
  const tx = bar.slider({ label: 'tx', min: -2.5, max: 2.5, step: 0.05, value: 1.5, onInput: redraw })
  const ty = bar.slider({ label: 'ty', min: -2.5, max: 2.5, step: 0.05, value: 0.8, onInput: redraw })
  bar.toggle({
    label: 'test vector is a direction (w = 0)',
    onChange: (on) => {
      asDirection = on
      redraw()
    },
  })
  widgetNote(
    container,
    'Left: the flat 2D world. Right: the same plane lifted into homogeneous space, with w drawn ' +
      'as height — drag the right half to orbit. The shear slides the w = 1 plane sideways while ' +
      'w = 0 stays bolted down; the purple test vector (drag it on the left) rides the translation ' +
      'only when it lives at w = 1.',
  )

  return {
    setUserFns(fns: UserFns | null) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ------------------------------------------------------------------ */
/* 3.5 — the door (sandwich stage scrubber)                            */
/* ------------------------------------------------------------------ */

const DOOR_LOCAL: readonly Vec2[] = [
  v2.vec2(0, -0.13),
  v2.vec2(2.1, -0.13),
  v2.vec2(2.1, 0.13),
  v2.vec2(0, 0.13),
]

const theDoor: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let hinge = v2.vec2(2, 0.8)
  let stage = 3

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 380,
    draw(ctx, w) {
      const t = theta.get()
      const p = hinge
      const toOrigin = m3.translation2(-p.x, -p.y)
      const rotated = m3.mul3(m3.mat3FromMat2(m2.rotation2(t)), toOrigin)
      const refFinal = m3.mul3(m3.translation2(p.x, p.y), rotated)
      const stageM: readonly Mat3[] = [m3.identity3(), toOrigin, rotated, refFinal]
      const M = stageM[stage]
      const doorRest = DOOR_LOCAL.map((d) => v2.add(p, d))

      draw.grid2(ctx, vp, w)

      // The carried scene: a second grid that the sandwich physically moves.
      const carried = 'rgba(86, 182, 194, 0.30)'
      for (let i = -5; i <= 6; i++) {
        path2(
          ctx,
          vp,
          [m3.transformPoint2(M, v2.vec2(i, -4)), m3.transformPoint2(M, v2.vec2(i, 5))],
          { color: carried, width: 1 },
        )
        path2(
          ctx,
          vp,
          [m3.transformPoint2(M, v2.vec2(-5, i - 1)), m3.transformPoint2(M, v2.vec2(6, i - 1))],
          { color: carried, width: 1 },
        )
      }

      // Door at rest (ghost) + hinge marker.
      path2(ctx, vp, doorRest, { color: COLORS.ghost, width: 1.5, close: true })
      draw.point2(ctx, vp, p, { color: COLORS.red, r: 6, label: 'p (hinge — drag me)' })

      // Door at the current stage.
      let status: string
      let doorM: readonly number[] = M
      let doorColor = COLORS.yellow
      let doorDash: number[] | undefined
      if (stage < 3) {
        status = [
          'stage 0/3 — the door at rest; rotation2 only knows the origin',
          'stage 1/3 — T(−p): slide the WHOLE scene until the hinge sits on the origin',
          'stage 2/3 — R(θ): now a plain origin rotation does the right thing',
        ][stage]
      } else {
        const uM = callMat(userFns, 'rotationAbout', [{ x: p.x, y: p.y }, t], 9)
        if (!userFns) {
          status = 'stage 3/3 — T(p): carry it back. (reference rotationAbout — solve below)'
        } else if (!uM) {
          status = 'stage 3/3 — your rotationAbout returned a non-Mat3; reference shown'
        } else {
          doorM = uM
          const yours = doorRest.map((q) => m3.transformPoint2(asM3(uM), q))
          const truth = doorRest.map((q) => m3.transformPoint2(refFinal, q))
          const wrong = yours.some((q, i) => v2.distance(q, truth[i]) > 1e-4)
          if (wrong) {
            path2(ctx, vp, truth, { color: COLORS.ghost, width: 1.5, close: true })
            doorColor = COLORS.red
            doorDash = [6, 4]
            status =
              'stage 3/3 — your rotationAbout ≠ T(p)·R(θ)·T(−p) — red dashed is yours, ' +
              'ghost is the truth (inside-out sandwich?)'
          } else {
            doorColor = COLORS.green
            status = 'stage 3/3 — T(p): carried back. your rotationAbout ✓ (the hinge never moved)'
          }
        }
      }
      const doorNow = doorRest.map((q) => m3.transformPoint2(asM3(doorM), q))
      path2(ctx, vp, doorNow, {
        color: doorColor,
        width: 2,
        close: true,
        dash: doorDash,
        fill: doorDash ? undefined : 'rgba(229, 192, 123, 0.10)',
      })

      // Where the hinge currently is (origin at stage 1–2 — that's the trick).
      const hingeNow = m3.transformPoint2(asM3(doorM), p)
      draw.point2(ctx, vp, hingeNow, {
        color: COLORS.yellow,
        r: 4,
        label: stage === 1 || stage === 2 ? 'hinge → origin' : undefined,
      })

      if (stage >= 2) {
        const center = stage === 2 ? v2.vec2(0, 0) : p
        draw.angleArc2(ctx, vp, center, v2.vec2(1, 0), v2.vec2(Math.cos(t), Math.sin(t)), {
          radiusPx: 26,
          label: 'θ',
        })
      }

      setHud(`M = T(p) · R(θ) · T(−p) — the RIGHTMOST factor happens first\n${status}`)
    },
  })
  const vp = new Viewport2D(widget, { center: v2.vec2(0.6, 0.6), unitsHigh: 10 })
  const setHud = hud(container)

  widget.handles.push(worldHandle(vp, () => hinge, (p) => (hinge = p)))

  const bar = controlsBar(container)
  const theta = bar.slider({
    label: 'θ',
    min: -Math.PI,
    max: Math.PI,
    step: 0.01,
    value: 1.2,
    format: (v) => `${v.toFixed(2)} rad = ${Math.round((v * 180) / Math.PI)}°`,
    onInput: () => widget.requestDraw(),
  })
  const stageBar = controlsBar(container)
  stageBar.readout('stage:')
  const stageButtons = ['0 original', '1 T(−p)', '2 R(θ)', '3 T(p)'].map((label, i) =>
    stageBar.button({
      label,
      onClick: () => {
        stage = i
        stageButtons.forEach((b, j) => b.classList.toggle('primary', j === stage))
        widget.requestDraw()
      },
    }),
  )
  stageButtons[stage].classList.add('primary')

  widgetNote(
    container,
    'Scrub the stages to watch the sandwich assemble: the cyan grid is the whole scene being ' +
      'carried along. Stages 1–2 use our reference pipeline; stage 3 is your ' +
      '<code>rotationAbout(p, θ)</code> in one matrix.',
  )

  return {
    setUserFns(fns: UserFns | null) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ------------------------------------------------------------------ */
/* 3.6 / 3.7 / capstone — shared cube machinery                        */
/* ------------------------------------------------------------------ */

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
  cam: Camera3D,
  size: { width: number; height: number },
  corners: readonly (Vec3 | null)[],
  opts: { color: string; width?: number; dash?: number[] },
): void {
  for (const [a, b] of CUBE_EDGES) {
    const pa = corners[a]
    const pb = corners[b]
    if (pa && pb) draw.line3(ctx, cam, size, pa, pb, opts)
  }
}

/** Cube of half-extent `half`, every corner through a reference Mat4. */
function cubeThrough(m: readonly number[], half: number): Vec3[] {
  return CUBE_CORNERS.map((c) => m4.transformPoint3(asM4(m), v3.scale(c, half)))
}

const f6 = (n: number) => (Object.is(n, -0) ? 0 : n).toFixed(2).padStart(6)

function mat4Rows(m: readonly number[]): string {
  return [0, 1, 2, 3]
    .map((r) => `${f6(m[r])} ${f6(m[4 + r])} ${f6(m[8 + r])} │ ${f6(m[12 + r])}`)
    .join('\n')
}

/* ------------------------------------------------------------------ */
/* 3.6 — mat4 cube                                                     */
/* ------------------------------------------------------------------ */

const mat4Cube: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  const cam = new Camera3D({ yaw: 0.8, pitch: 0.45, dist: 14 })

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 400,
    draw(ctx, w) {
      const fns = userFns
      const uT = callMat(fns, 'translation3', [tx.get(), ty.get(), tz.get()], 16)
      const uR = callMat(fns, 'rotationY', [ry.get()], 16)
      const uS = callMat(fns, 'scaling3', [sx.get(), sy.get(), sz.get()], 16)
      const T = uT ?? [...m4.translation3(tx.get(), ty.get(), tz.get())]
      const R = uR ?? [...m4.rotationY(ry.get())]
      const S = uS ?? [...m4.scaling3(sx.get(), sy.get(), sz.get())]
      const uRS = callMat(fns, 'mul4', [R, S], 16)
      const RS = uRS ?? [...m4.mul4(asM4(R), asM4(S))]
      const uM = callMat(fns, 'mul4', [T, RS], 16)
      const M = uM ?? [...m4.mul4(asM4(T), asM4(RS))]

      // Corners through the learner's transformPoint3 when it behaves.
      let broke = false
      const userMap = matVec3Map(fns, 'transformPoint3', M)
      const corners = CUBE_CORNERS.map((c) => {
        if (!userMap) return m4.transformPoint3(asM4(M), c)
        const r = userMap(c)
        if (!r) broke = true
        return r ?? m4.transformPoint3(asM4(M), c)
      })

      draw.grid3(ctx, cam, w, { extent: 6 })
      draw.axes3(ctx, cam, w, 1.6)
      wireCube(ctx, cam, w, CUBE_CORNERS, { color: COLORS.ghost, width: 1 })
      wireCube(ctx, cam, w, corners, { color: COLORS.yellow, width: 2 })

      // The transformed tripod: columns of M, hanging off the moved origin.
      const o = v3.vec3(M[12], M[13], M[14])
      draw.arrow3(ctx, cam, w, o, v3.add(o, v3.vec3(M[0], M[1], M[2])), { color: COLORS.red, width: 2, label: 'x̂' })
      draw.arrow3(ctx, cam, w, o, v3.add(o, v3.vec3(M[4], M[5], M[6])), { color: COLORS.green, width: 2, label: 'ŷ' })
      draw.arrow3(ctx, cam, w, o, v3.add(o, v3.vec3(M[8], M[9], M[10])), { color: COLORS.accent, width: 2, label: 'ẑ' })

      const live = (u: number[] | null) => (u ? '✓' : 'ref')
      const status = !fns
        ? 'reference matrices — solve the exercise below to drive the cube'
        : `T:${live(uT)}  Ry:${live(uR)}  S:${live(uS)}  mul4:${live(uRS && uM ? uM : null)}  ` +
          `transformPoint3:${!userMap ? 'ref' : broke ? 'bad return' : '✓'}`
      setHud(`M = mul4(T, mul4(Ry, S))\n${mat4Rows(M)}\n${status}`)
    },
  })
  const setHud = hud(container)
  cam.attachOrbit(widget)

  const bar = controlsBar(container)
  const redraw = () => widget.requestDraw()
  const tx = bar.slider({ label: 'tx', min: -4, max: 4, step: 0.1, value: 1.5, onInput: redraw })
  const ty = bar.slider({ label: 'ty', min: -3, max: 4, step: 0.1, value: 1, onInput: redraw })
  const tz = bar.slider({ label: 'tz', min: -4, max: 4, step: 0.1, value: 0, onInput: redraw })
  const ry = bar.slider({
    label: 'ry',
    min: -Math.PI,
    max: Math.PI,
    step: 0.01,
    value: 0.7,
    format: (v) => `${v.toFixed(2)} rad`,
    onInput: redraw,
  })
  const sx = bar.slider({ label: 'sx', min: 0.2, max: 2.5, step: 0.05, value: 1.6, onInput: redraw })
  const sy = bar.slider({ label: 'sy', min: 0.2, max: 2.5, step: 0.05, value: 1, onInput: redraw })
  const sz = bar.slider({ label: 'sz', min: 0.2, max: 2.5, step: 0.05, value: 0.6, onInput: redraw })

  widgetNote(
    container,
    'Drag to orbit. In the readout, the three columns left of the bar are where x̂, ŷ, ẑ land ' +
      '(drawn as the red/green/blue tripod); the column right of the bar is where the origin ' +
      'went. Watch row 4 stay (0 0 0 1) no matter what you do.',
  )

  return {
    setUserFns(fns: UserFns | null) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ------------------------------------------------------------------ */
/* 3.7 — TRS gizmo                                                     */
/* ------------------------------------------------------------------ */

const trsGizmo: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let compare = true
  const cam = new Camera3D({ yaw: 0.9, pitch: 0.4, dist: 14 })

  const widget = new CanvasWidget(container, {
    mode: 'static',
    height: 400,
    draw(ctx, w) {
      const t = v3.vec3(tx.get(), ty.get(), 0)
      const s = v3.vec3(sx.get(), sy.get(), 1)
      const a = ry.get()
      const T = m4.translation3(t.x, t.y, t.z)
      const R = m4.rotationY(a)
      const S = m4.scaling3(s.x, s.y, s.z)
      const ref = m4.mul4(T, m4.mul4(R, S))
      const uM = callMat(userFns, 'trs', [{ x: t.x, y: t.y, z: t.z }, a, { x: s.x, y: s.y, z: s.z }], 16)
      const M = uM ?? [...ref]

      draw.grid3(ctx, cam, w, { extent: 6 })
      draw.axes3(ctx, cam, w, 1.6)
      wireCube(ctx, cam, w, CUBE_CORNERS, { color: COLORS.ghost, width: 1 })

      wireCube(ctx, cam, w, cubeThrough(M, 1), { color: COLORS.yellow, width: 2 })
      const lm = cam.toScreen(v3.vec3(M[12], M[13] + 1.4, M[14]), w)
      if (lm) draw.drawLabel(ctx, 'T·R·S', v2.vec2(lm.x - 16, lm.y - 8), COLORS.yellow)

      if (compare) {
        const swapped = m4.mul4(S, m4.mul4(R, T))
        wireCube(ctx, cam, w, cubeThrough([...swapped], 1), {
          color: COLORS.red,
          width: 1.5,
          dash: [6, 4],
        })
        const ls = cam.toScreen(v3.vec3(swapped[12], swapped[13] + 1.4, swapped[14]), w)
        if (ls) draw.drawLabel(ctx, 'S·R·T (swapped)', v2.vec2(ls.x - 30, ls.y - 8), COLORS.red)
      }

      const drifted = uM !== null && uM.some((n, i) => Math.abs(n - ref[i]) > 1e-4)
      const status = !userFns
        ? 'reference trs — solve the exercise below to take over'
        : !uM
          ? 'your trs returned a non-Mat4 — reference shown'
          : drifted
            ? 'your trs ≠ T·R·S — wrong order? compare with the red ghost'
            : 'your trs(t, ry, s) ✓'
      setHud(
        `trs(t, ry, s) = T(${t.x.toFixed(1)}, ${t.y.toFixed(1)}, 0) · Ry(${a.toFixed(2)}) · ` +
          `S(${s.x.toFixed(1)}, ${s.y.toFixed(1)}, 1)\n${status}`,
      )
    },
  })
  const setHud = hud(container)
  cam.attachOrbit(widget)

  const bar = controlsBar(container)
  const redraw = () => widget.requestDraw()
  const tx = bar.slider({ label: 'tx', min: -4, max: 4, step: 0.1, value: 2.2, onInput: redraw })
  const ty = bar.slider({ label: 'ty', min: -2, max: 3, step: 0.1, value: 0.8, onInput: redraw })
  const ry = bar.slider({
    label: 'ry',
    min: -Math.PI,
    max: Math.PI,
    step: 0.01,
    value: 0.7,
    format: (v) => `${v.toFixed(2)} rad`,
    onInput: redraw,
  })
  const sx = bar.slider({ label: 'sx', min: 0.3, max: 2.5, step: 0.05, value: 1.7, onInput: redraw })
  const sy = bar.slider({ label: 'sy', min: 0.3, max: 2.5, step: 0.05, value: 0.8, onInput: redraw })
  bar.toggle({
    label: 'compare S·R·T (swapped)',
    value: compare,
    onChange: (on) => {
      compare = on
      redraw()
    },
  })

  widgetNote(
    container,
    'Drag to orbit. The yellow cube is your <code>trs(t, ry, s)</code>; the red dashed ghost ' +
      'applies the same three matrices in the swapped order S·R·T (built from reference parts) — ' +
      'its translation gets scaled and rotated, which is why no engine stores objects that way.',
  )

  return {
    setUserFns(fns: UserFns | null) {
      userFns = fns
      widget.requestDraw()
    },
  }
}

/* ------------------------------------------------------------------ */
/* capstone — solar system                                             */
/* ------------------------------------------------------------------ */

const solarSystem: WidgetFactory = (container) => {
  let userFns: UserFns | null = null
  let t = 0
  let trailClock = 0
  let showAxes = false
  const planetTrail: Vec3[] = []
  const moonTrail: Vec3[] = []
  const ORIGIN = v3.vec3(0, 0, 0)
  const cam = new Camera3D({ yaw: 0.9, pitch: 0.55, dist: 19 })

  const pushTrail = (trail: Vec3[], p: Vec3): void => {
    trail.push(p)
    if (trail.length > 60) trail.shift()
  }

  const bodyTripod = (
    ctx: CanvasRenderingContext2D,
    size: { width: number; height: number },
    m: readonly number[],
    len: number,
  ): void => {
    const o = m4.transformPoint3(asM4(m), ORIGIN)
    const axes: [Vec3, string][] = [
      [v3.vec3(1, 0, 0), COLORS.red],
      [v3.vec3(0, 1, 0), COLORS.green],
      [v3.vec3(0, 0, 1), COLORS.accent],
    ]
    for (const [axis, color] of axes) {
      const d = m4.transformDir3(asM4(m), axis)
      draw.arrow3(ctx, cam, size, o, v3.add(o, v3.scale(d, len)), { color, width: 1.5 })
    }
  }

  const widget = new CanvasWidget(container, {
    mode: 'animated',
    height: 430,
    update(dt) {
      if (!userFns) return
      t += dt * speed.get()
      trailClock += dt
      if (trailClock >= 0.1) {
        trailClock = 0
        const pm = callMat(userFns, 'planetMatrix', [t], 16)
        const mm = callMat(userFns, 'moonMatrix', [t], 16)
        if (pm) pushTrail(planetTrail, m4.transformPoint3(asM4(pm), ORIGIN))
        if (mm) pushTrail(moonTrail, m4.transformPoint3(asM4(mm), ORIGIN))
      }
    },
    draw(ctx, w) {
      draw.grid3(ctx, cam, w, { extent: 9 })

      if (!userFns) {
        // Cold universe: everything parked at its t = 0 rest position.
        wireCube(ctx, cam, w, cubeThrough([...m4.identity4()], 0.75), { color: COLORS.ghost, width: 1.5 })
        wireCube(ctx, cam, w, cubeThrough([...m4.translation3(6, 0, 0)], 0.4), { color: COLORS.ghost, width: 1 })
        wireCube(ctx, cam, w, cubeThrough([...m4.translation3(8, 0, 0)], 0.2), { color: COLORS.ghost, width: 1 })
        ctx.save()
        ctx.font = MONO_FONT
        ctx.textAlign = 'center'
        ctx.fillStyle = COLORS.yellow
        ctx.fillText('solve the exercise below to ignite the sun', w.width / 2, 34)
        ctx.restore()
        setHud('t = 0.0 — paused')
        return
      }

      for (const q of planetTrail) draw.point3(ctx, cam, w, q, { color: 'rgba(97, 175, 239, 0.35)', r: 0.03 })
      for (const q of moonTrail) draw.point3(ctx, cam, w, q, { color: 'rgba(138, 147, 165, 0.35)', r: 0.025 })

      const sm = callMat(userFns, 'sunMatrix', [t], 16)
      const pm = callMat(userFns, 'planetMatrix', [t], 16)
      const mm = callMat(userFns, 'moonMatrix', [t], 16)
      const dead: string[] = []
      if (sm) {
        wireCube(ctx, cam, w, cubeThrough(sm, 0.75), { color: COLORS.yellow, width: 2 })
        if (showAxes) bodyTripod(ctx, w, sm, 1.4)
      } else dead.push('sunMatrix')
      if (pm) {
        wireCube(ctx, cam, w, cubeThrough(pm, 0.4), { color: COLORS.accent, width: 2 })
        if (showAxes) bodyTripod(ctx, w, pm, 0.9)
      } else dead.push('planetMatrix')
      if (mm) {
        wireCube(ctx, cam, w, cubeThrough(mm, 0.2), { color: COLORS.dim, width: 1.5 })
        if (showAxes) bodyTripod(ctx, w, mm, 0.6)
      } else dead.push('moonMatrix')

      setHud(
        `t = ${t.toFixed(1)}` +
          (dead.length ? `\n${dead.join(', ')} returned a non-Mat4 — body hidden` : ''),
      )
    },
  })
  const setHud = hud(container)
  cam.attachOrbit(widget)

  const bar = controlsBar(container)
  const speed = bar.slider({ label: 'speed', min: 0, max: 2, step: 0.05, value: 0.5 })
  bar.toggle({
    label: 'local axes',
    onChange: (on) => {
      showAxes = on
    },
  })

  widgetNote(
    container,
    'Drag to orbit. Diagnostic field guide: moon circling the <em>sun</em> at planet distance ' +
      'means your multiply order detached it — <code>planetMatrix(t)</code> must be the LEFTMOST ' +
      'factor in <code>moonMatrix</code>. A planet pinned at the origin means T(6,0,0) ' +
      'never made it into the chain.',
  )

  return {
    setUserFns(fns: UserFns | null) {
      userFns = fns
      planetTrail.length = 0
      moonTrail.length = 0
      widget.requestDraw()
    },
  }
}

/* ------------------------------------------------------------------ */

export const M03_WIDGETS: Record<string, WidgetFactory> = {
  'grid-deformer': gridDeformer,
  'matrix-factory': matrixFactory,
  pipeline,
  'the-lift': theLift,
  'the-door': theDoor,
  'mat4-cube': mat4Cube,
  'trs-gizmo': trsGizmo,
  'solar-system': solarSystem,
}
