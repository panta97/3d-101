/**
 * Maps the course's y-up 2D world onto the canvas's y-down pixel grid.
 * (In Module 3 we reveal this mapping was a matrix all along.)
 */

import type { Vec2 } from '@/math'
import { v2 } from '@/math'
import type { CanvasWidget, WidgetHandle } from './CanvasWidget'

export class Viewport2D {
  /** World point shown at the canvas center. */
  center: Vec2
  /** How many world units fit in the canvas height. */
  unitsHigh: number

  constructor(
    private readonly widget: CanvasWidget,
    opts: { center?: Vec2; unitsHigh?: number } = {},
  ) {
    this.center = opts.center ?? v2.vec2(0, 0)
    this.unitsHigh = opts.unitsHigh ?? 10
  }

  /** Pixels per world unit. */
  get scale(): number {
    return this.widget.height / this.unitsHigh
  }

  toScreen(p: Vec2): Vec2 {
    return v2.vec2(
      this.widget.width / 2 + (p.x - this.center.x) * this.scale,
      this.widget.height / 2 - (p.y - this.center.y) * this.scale,
    )
  }

  toWorld(s: Vec2): Vec2 {
    return v2.vec2(
      this.center.x + (s.x - this.widget.width / 2) / this.scale,
      this.center.y - (s.y - this.widget.height / 2) / this.scale,
    )
  }
}

/** A draggable handle living at a world-space position. */
export function worldHandle(
  vp: Viewport2D,
  get: () => Vec2,
  set: (p: Vec2) => void,
  opts: { radius?: number } = {},
): WidgetHandle {
  return {
    getScreen: () => vp.toScreen(get()),
    onDrag: (s) => set(vp.toWorld(s)),
    radius: opts.radius ?? 14,
  }
}
