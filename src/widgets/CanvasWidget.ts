/**
 * Base canvas widget: device-pixel-ratio-aware sizing, an animation loop
 * that only runs while the widget is on screen, and pointer-drag handles.
 *
 * Coordinates handed to draw/update/pointer callbacks are CSS pixels
 * (the context is pre-scaled for DPR).
 */

import type { Vec2 } from '@/math'
import { v2 } from '@/math'

export interface WidgetHandle {
  /** Current position in CSS px. */
  getScreen(): Vec2
  /** Called with the new position (CSS px) while dragging. */
  onDrag(screen: Vec2): void
  /** Hit radius in CSS px. Default 14 (finger-friendly). */
  radius?: number
}

export interface CanvasWidgetOptions {
  /** 'animated' runs update+draw every frame while visible; 'static' draws on demand. */
  mode?: 'animated' | 'static'
  /** Canvas height in CSS px (width always fills the container). Default 360. */
  height?: number
  draw(ctx: CanvasRenderingContext2D, w: CanvasWidget): void
  /** Simulation step; dt in seconds, capped at 50 ms. Only called in 'animated' mode. */
  update?(dt: number, w: CanvasWidget): void
}

export class CanvasWidget {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  /** CSS-pixel size of the canvas. */
  width = 0
  height: number

  handles: WidgetHandle[] = []
  /** Pointer position in CSS px while over the canvas, else null. */
  pointer: Vec2 | null = null
  /** Assignable: drag on empty space (no handle hit). Used by Camera3D orbit. */
  onBackgroundDrag: ((dx: number, dy: number, pos: Vec2) => void) | null = null
  /** Assignable: click/tap that did not hit a handle. */
  onTap: ((pos: Vec2) => void) | null = null

  private readonly opts: CanvasWidgetOptions
  private visible = false
  private rafId = 0
  private lastT = 0
  private drawQueued = false
  private dragging: WidgetHandle | 'background' | null = null
  private readonly resizeObs: ResizeObserver
  private readonly intersectObs: IntersectionObserver

  constructor(container: HTMLElement, opts: CanvasWidgetOptions) {
    this.opts = opts
    this.height = opts.height ?? 360

    const wrap = document.createElement('div')
    wrap.className = 'widget-canvas-wrap'
    this.canvas = document.createElement('canvas')
    wrap.append(this.canvas)
    container.append(wrap)
    this.ctx = this.canvas.getContext('2d')!

    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(wrap)
    this.resize()

    this.intersectObs = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting
      if (this.visible) this.startLoop()
    })
    this.intersectObs.observe(this.canvas)

    this.bindPointer()
  }

  /**
   * Change the canvas height (CSS px) and re-size the backing store. Module
   * widgets are fixed-height; the sandbox fills a resizable pane.
   */
  setHeight(h: number): void {
    if (h === this.height || h <= 0) return
    this.height = h
    this.resize()
  }

  /** Queue a redraw (no-op in animated mode, which redraws every frame anyway). */
  requestDraw(): void {
    if (this.opts.mode === 'animated' || this.drawQueued) return
    this.drawQueued = true
    requestAnimationFrame(() => {
      this.drawQueued = false
      this.drawNow()
    })
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId)
    this.resizeObs.disconnect()
    this.intersectObs.disconnect()
  }

  private resize(): void {
    const cssW = this.canvas.parentElement!.clientWidth
    if (cssW === 0) return
    const dpr = window.devicePixelRatio || 1
    this.width = cssW
    this.canvas.width = Math.round(cssW * dpr)
    this.canvas.height = Math.round(this.height * dpr)
    this.canvas.style.height = `${this.height}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.requestDraw()
  }

  private drawNow(): void {
    this.ctx.clearRect(0, 0, this.width, this.height)
    this.opts.draw(this.ctx, this)
  }

  private startLoop(): void {
    if (this.opts.mode !== 'animated') {
      this.requestDraw()
      return
    }
    cancelAnimationFrame(this.rafId)
    this.lastT = performance.now()
    const tick = (t: number) => {
      if (!this.visible) return
      const dt = Math.min((t - this.lastT) / 1000, 0.05)
      this.lastT = t
      this.opts.update?.(dt, this)
      this.drawNow()
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private eventPos(e: PointerEvent): Vec2 {
    const r = this.canvas.getBoundingClientRect()
    return v2.vec2(e.clientX - r.left, e.clientY - r.top)
  }

  private hitHandle(p: Vec2): WidgetHandle | null {
    for (const h of this.handles) {
      if (v2.distance(h.getScreen(), p) <= (h.radius ?? 14)) return h
    }
    return null
  }

  private bindPointer(): void {
    const c = this.canvas
    c.addEventListener('pointerdown', (e) => {
      const p = this.eventPos(e)
      this.pointer = p
      const hit = this.hitHandle(p)
      this.dragging = hit ?? 'background'
      if (hit || this.onBackgroundDrag) {
        c.setPointerCapture(e.pointerId)
        c.classList.add('is-dragging')
        e.preventDefault()
      }
      if (!hit) this.onTap?.(p)
      this.requestDraw()
    })
    c.addEventListener('pointermove', (e) => {
      const p = this.eventPos(e)
      const prev = this.pointer
      this.pointer = p
      if (this.dragging && this.dragging !== 'background') {
        this.dragging.onDrag(p)
      } else if (this.dragging === 'background' && prev) {
        this.onBackgroundDrag?.(p.x - prev.x, p.y - prev.y, p)
      } else {
        c.classList.toggle('is-draggable', this.hitHandle(p) !== null)
      }
      this.requestDraw()
    })
    const end = (e: PointerEvent) => {
      this.dragging = null
      c.classList.remove('is-dragging')
      if (e.type === 'pointerleave') this.pointer = null
      this.requestDraw()
    }
    c.addEventListener('pointerup', end)
    c.addEventListener('pointercancel', end)
    c.addEventListener('pointerleave', end)
  }
}
