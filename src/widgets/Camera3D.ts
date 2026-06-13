/**
 * Matrix-free orbit camera — deliberately built from nothing but the course's
 * own vector math (normalize + cross + dot + a perspective divide), so that
 * even the infrastructure contains no math the course hasn't taught or
 * promised. This is the `project3()` black box modules 1–4 reference;
 * Module 5 rebuilds it as a matrix in the learner's hands.
 */

import type { Vec2, Vec3 } from '@/math'
import { v2, v3 } from '@/math'
import type { CanvasWidget } from './CanvasWidget'

export interface Projected {
  /** Screen position, CSS px. */
  x: number
  y: number
  /** Perspective size factor (px per world unit at this depth). */
  scale: number
  /** Camera-space depth (distance along the view direction). */
  depth: number
}

const WORLD_UP = v3.vec3(0, 1, 0)

export class Camera3D {
  yaw: number
  pitch: number
  dist: number
  target: Vec3
  /** Focal length as a multiple of the canvas height. */
  focal: number

  constructor(opts: { yaw?: number; pitch?: number; dist?: number; target?: Vec3; focal?: number } = {}) {
    this.yaw = opts.yaw ?? 0.7
    this.pitch = opts.pitch ?? 0.4
    this.dist = opts.dist ?? 14
    this.target = opts.target ?? v3.vec3(0, 0, 0)
    this.focal = opts.focal ?? 1.2
  }

  eye(): Vec3 {
    const cp = Math.cos(this.pitch)
    return v3.add(
      this.target,
      v3.scale(
        v3.vec3(cp * Math.sin(this.yaw), Math.sin(this.pitch), cp * Math.cos(this.yaw)),
        this.dist,
      ),
    )
  }

  /**
   * Project a world point to the screen. Returns null behind the camera.
   * The black box of modules 1–4: by Module 5 you will have written this.
   */
  project3(p: Vec3, size: { width: number; height: number }): Projected | null {
    const eye = this.eye()
    const fwd = v3.normalize(v3.sub(this.target, eye))
    // Degenerate straight-up/down view never happens: pitch is clamped below ±90°.
    const right = v3.normalize(v3.cross(fwd, WORLD_UP))
    const up = v3.cross(right, fwd)

    const rel = v3.sub(p, eye)
    const cz = v3.dot(rel, fwd)
    if (cz < 0.05) return null
    const f = size.height * this.focal
    return {
      x: size.width / 2 + (f * v3.dot(rel, right)) / cz,
      y: size.height / 2 - (f * v3.dot(rel, up)) / cz,
      scale: f / cz,
      depth: cz,
    }
  }

  /** Convenience: project against a widget's current size. */
  toScreen(p: Vec3, w: { width: number; height: number }): Vec2 | null {
    const pr = this.project3(p, w)
    return pr ? v2.vec2(pr.x, pr.y) : null
  }

  /** Wire background drags on a widget to orbit this camera. */
  attachOrbit(widget: CanvasWidget): void {
    widget.onBackgroundDrag = (dx, dy) => {
      this.yaw -= dx * 0.008
      this.pitch = Math.min(1.45, Math.max(-1.45, this.pitch + dy * 0.008))
      widget.requestDraw()
    }
  }
}
