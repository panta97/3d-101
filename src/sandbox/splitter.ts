/**
 * Draggable panel gutters, VS Code style.
 *
 * Each gutter writes a pixel size into a CSS custom property on the sandbox
 * root, which the panel it borders consumes as its flex-basis. Sizes are
 * pixels (not percentages) and the panels never grow: that is what stops a
 * long particle list from inflating its pane and shoving the viewport off the
 * top of the screen — the list scrolls inside a pane of the size you chose.
 *
 * Sizes persist per gutter, so the layout you drag out survives a reload.
 */

export interface GutterOptions {
  /** Element carrying the CSS variable (the sandbox root). */
  root: HTMLElement
  cssVar: string
  /** 'x' resizes left/right, 'y' resizes top/bottom. */
  axis: 'x' | 'y'
  /** Desired panel size, in px, for a pointer at this client coordinate. */
  measure(clientPos: number): number
  /** Allowed range, recomputed on each drag so it tracks window resizes. */
  bounds(): { min: number; max: number }
  storageKey: string
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function mountGutter(gutter: HTMLElement, opts: GutterOptions): void {
  const { root, cssVar, axis, measure, bounds, storageKey } = opts

  const apply = (px: number, persist: boolean) => {
    const { min, max } = bounds()
    // max can fall below min on a very short window — min wins, then it scrolls.
    const size = clamp(px, min, Math.max(min, max))
    root.style.setProperty(cssVar, `${Math.round(size)}px`)
    if (persist) localStorage.setItem(storageKey, String(Math.round(size)))
  }

  const saved = Number(localStorage.getItem(storageKey))
  if (Number.isFinite(saved) && saved > 0) apply(saved, false)

  gutter.setAttribute('role', 'separator')
  gutter.setAttribute('tabindex', '0')
  gutter.setAttribute('aria-orientation', axis === 'x' ? 'vertical' : 'horizontal')

  let dragging = false
  const cursorClass = axis === 'x' ? 'sb-resizing-x' : 'sb-resizing-y'

  gutter.addEventListener('pointerdown', (e) => {
    dragging = true
    gutter.setPointerCapture(e.pointerId)
    gutter.classList.add('is-dragging')
    document.body.classList.add(cursorClass)
    e.preventDefault()
  })

  gutter.addEventListener('pointermove', (e) => {
    if (!dragging) return
    apply(measure(axis === 'x' ? e.clientX : e.clientY), true)
  })

  const end = (e: PointerEvent) => {
    if (!dragging) return
    dragging = false
    gutter.releasePointerCapture(e.pointerId)
    gutter.classList.remove('is-dragging')
    document.body.classList.remove(cursorClass)
  }
  gutter.addEventListener('pointerup', end)
  gutter.addEventListener('pointercancel', end)

  // Keyboard: a separator you can't reach without a mouse isn't a control.
  gutter.addEventListener('keydown', (e) => {
    const less = axis === 'x' ? 'ArrowLeft' : 'ArrowUp'
    const more = axis === 'x' ? 'ArrowRight' : 'ArrowDown'
    if (e.key !== less && e.key !== more) return
    e.preventDefault()
    const current = parseFloat(getComputedStyle(root).getPropertyValue(cssVar)) || bounds().min
    // The y-gutters size the panel *below* them, so up-arrow grows it.
    const dir = e.key === more ? 1 : -1
    const step = (e.shiftKey ? 40 : 12) * (axis === 'x' ? dir : -dir)
    apply(current + step, true)
  })
}
