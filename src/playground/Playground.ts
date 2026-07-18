/**
 * The vector playground: a Desmos-shaped expression list wired to a 2D plot.
 *
 * Every row is one expression. Rows that evaluate to a vector get drawn as an
 * arrow from the origin; rows that evaluate to a number just read out their
 * value. Rows can name themselves (`a = v(3, 2)`) and refer to each other in
 * any order, so the list is a tiny dependency graph, not a script.
 *
 * Two affordances only exist for rows whose source is *literal*: a vector
 * literal gets a draggable tip, a scalar definition gets a slider. Both write
 * back into the row's text, so dragging is just a fast way to type — there is
 * no hidden state behind an expression, which is what keeps the list the
 * single source of truth.
 */

import { CanvasWidget, Viewport2D, worldHandle, draw, COLORS } from '@/widgets'
import type { Vec2 } from '@/math'
import { v2 } from '@/math'
import { mountGutter } from '@/sandbox/splitter'
import { BUILTINS, CONSTANTS, evaluateSheet, isVec } from './evaluate'
import type { RowResult, Value } from './evaluate'
import type { Expr, Statement } from './parser'
import { ImportError, parseFile, serialize, toFile, type ImportedSheet } from './sheetFile'

interface Row {
  id: string
  source: string
  color: string
  hidden: boolean
}

interface RowDom {
  li: HTMLLIElement
  swatch: HTMLButtonElement
  input: HTMLInputElement
  output: HTMLDivElement
  slider: HTMLInputElement
}

const PALETTE = [
  COLORS.accent,
  COLORS.purple,
  COLORS.green,
  COLORS.yellow,
  COLORS.cyan,
  COLORS.red,
  COLORS.fg,
]

const STORAGE_KEY = '3d101:playground:v1'

const DEFAULT_SOURCES = ['a = v(3, 2)', 'b = v(cos(pi/8), sin(pi/8))', 'a + 2b', 'project(a, b)']

/* ------------------------------ formatting ----------------------------- */

/** Display precision: enough digits to see cos(pi/8), few enough to read. */
function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  if (Math.abs(n) < 1e-10) return '0'
  return String(Number(n.toPrecision(8)))
}

function fmtValue(value: Value): string {
  return isVec(value) ? `(${fmtNum(value.x)}, ${fmtNum(value.y)})` : fmtNum(value)
}

/** Write-back precision — coarser than display, so dragging yields typable text. */
function fmtSource(n: number): string {
  const rounded = Number(n.toFixed(3))
  // Dragging left across the axis lands on -0, and "v(-0, 1)" reads as a bug.
  return String(rounded === 0 ? 0 : rounded)
}

/* --------------------------- literal detection -------------------------- */

/** The numeric value of an expression that is a literal (or its negation), else null. */
function constNumber(expr: Expr): number | null {
  if (expr.kind === 'num') return expr.value
  if (expr.kind === 'unary' && expr.operand.kind === 'num') return -expr.operand.value
  return null
}

/** Components of a row written as a plain vector literal — `v(3, 2)` or `(3, 2)`. */
function literalVec(statement: Statement | null): [number, number] | null {
  const expr = statement?.expr
  if (!expr || expr.kind !== 'call' || expr.name !== 'v' || expr.args.length !== 2) return null
  const x = constNumber(expr.args[0])
  const y = constNumber(expr.args[1])
  return x === null || y === null ? null : [x, y]
}

/** The scalar of a row written as `name = <literal>`, else null. */
function literalScalar(statement: Statement | null): number | null {
  if (!statement?.name) return null
  return constNumber(statement.expr)
}

/* ------------------------------- the app -------------------------------- */

class Playground {
  private rows: Row[] = []
  private results = new Map<string, RowResult>()
  private readonly dom = new Map<string, RowDom>()
  private readonly widget: CanvasWidget
  private readonly vp: Viewport2D
  private readonly list: HTMLOListElement
  private nextId = 0
  private statusTimer: ReturnType<typeof setTimeout> | undefined

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="pg">
        <div class="pg-panel">
          <div class="pg-panel-head">
            <span class="pg-panel-title">Expressions</span>
            <div class="pg-panel-tools">
              <button class="pg-io pg-export" type="button" title="Download these rows as JSON">Export</button>
              <button class="pg-io pg-import" type="button" title="Replace these rows from a JSON file">Import</button>
              <button class="pg-add" type="button" title="Add a row (Enter on the last row)">+</button>
            </div>
          </div>
          <p class="pg-status" role="status" hidden></p>
          <input class="pg-file" type="file" accept="application/json,.json" hidden />
          <ol class="pg-rows"></ol>
          ${referenceHtml()}
        </div>
        <div class="pg-gutter"></div>
        <div class="pg-plot">
          <div class="pg-view"></div>
          <div class="pg-view-tools">
            <button class="pg-tool pg-zoom-in" type="button" title="Zoom in">+</button>
            <button class="pg-tool pg-zoom-out" type="button" title="Zoom out">−</button>
            <button class="pg-tool pg-home" type="button" title="Reset the view">⌂</button>
          </div>
        </div>
      </div>
    `

    this.list = root.querySelector('.pg-rows')!
    const view = root.querySelector<HTMLElement>('.pg-view')!

    this.widget = new CanvasWidget(view, {
      mode: 'static',
      height: 480,
      draw: (ctx, w) => this.drawPlot(ctx, w),
    })
    this.vp = new Viewport2D(this.widget, { unitsHigh: 12 })

    this.load()
    this.bindPanel(root)
    this.bindView(root, view)
    this.renderList()
    this.evaluate()
  }

  /* ---- state ---------------------------------------------------------- */

  private load(): void {
    let saved: { rows?: Row[]; center?: Vec2; unitsHigh?: number } | null = null
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    } catch {
      saved = null
    }

    if (saved?.rows?.length) {
      this.rows = saved.rows.map((r) => ({ ...r, id: `r${this.nextId++}` }))
      if (saved.center) this.vp.center = saved.center
      if (saved.unitsHigh) this.vp.unitsHigh = saved.unitsHigh
    } else {
      // Pushed one at a time: newRow() picks its colour by looking at the rows
      // that already exist, so building the list in a map() hands every row the
      // same colour.
      this.rows = []
      for (const source of DEFAULT_SOURCES) this.rows.push(this.newRow(source))
    }
    // Always keep one blank row at the end to type into.
    if (this.rows[this.rows.length - 1]?.source.trim()) this.rows.push(this.newRow(''))
  }

  private save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ rows: this.rows, center: this.vp.center, unitsHigh: this.vp.unitsHigh }),
      )
    } catch {
      // Storage full or blocked — losing persistence is acceptable.
    }
  }

  private newRow(source: string): Row {
    // Pick the palette entry the fewest existing rows are using, so early rows
    // never collide and later ones degrade gracefully.
    const used = new Map(PALETTE.map((c) => [c, 0]))
    for (const row of this.rows) used.set(row.color, (used.get(row.color) ?? 0) + 1)
    const color = PALETTE.reduce((best, c) => (used.get(c)! < used.get(best)! ? c : best))
    return { id: `r${this.nextId++}`, source, color, hidden: false }
  }

  /* ---- the expression list -------------------------------------------- */

  private renderList(): void {
    this.list.textContent = ''
    this.dom.clear()
    for (const row of this.rows) this.list.append(this.buildRow(row))
  }

  private buildRow(row: Row): HTMLLIElement {
    const li = document.createElement('li')
    li.className = 'pg-row'
    li.innerHTML = `
      <button class="pg-swatch" type="button" title="Show or hide this vector"></button>
      <div class="pg-row-body">
        <input class="pg-input" spellcheck="false" autocomplete="off" aria-label="Expression" />
        <div class="pg-out"></div>
        <input class="pg-slider" type="range" aria-label="Value" />
      </div>
      <button class="pg-del" type="button" title="Delete this row" aria-label="Delete">×</button>
    `

    const dom: RowDom = {
      li,
      swatch: li.querySelector('.pg-swatch')!,
      input: li.querySelector('.pg-input')!,
      output: li.querySelector('.pg-out')!,
      slider: li.querySelector('.pg-slider')!,
    }
    this.dom.set(row.id, dom)

    dom.input.value = row.source
    dom.swatch.style.setProperty('--swatch', row.color)

    dom.input.addEventListener('input', () => {
      row.source = dom.input.value
      this.evaluate()
    })
    dom.input.addEventListener('keydown', (e) => this.onRowKey(e, row))

    dom.swatch.addEventListener('click', () => {
      row.hidden = !row.hidden
      this.refreshRow(row)
      this.widget.requestDraw()
      this.save()
    })

    li.querySelector('.pg-del')!.addEventListener('click', () => this.deleteRow(row))

    dom.slider.addEventListener('input', () => {
      const statement = this.results.get(row.id)?.statement
      if (!statement?.name) return
      this.setSource(row, `${statement.name} = ${fmtSource(Number(dom.slider.value))}`)
    })

    return li
  }

  private onRowKey(e: KeyboardEvent, row: Row): void {
    const index = this.rows.indexOf(row)
    if (e.key === 'Enter') {
      e.preventDefault()
      this.insertAfter(index)
    } else if (e.key === 'Backspace' && !row.source && this.rows.length > 1) {
      e.preventDefault()
      this.deleteRow(row, Math.max(0, index - 1))
    } else if (e.key === 'ArrowDown' && index < this.rows.length - 1) {
      e.preventDefault()
      this.focusRow(index + 1)
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      this.focusRow(index - 1)
    }
  }

  private insertAfter(index: number): void {
    this.rows.splice(index + 1, 0, this.newRow(''))
    this.renderList()
    this.evaluate()
    this.focusRow(index + 1)
  }

  private deleteRow(row: Row, focus?: number): void {
    const index = this.rows.indexOf(row)
    this.rows.splice(index, 1)
    if (!this.rows.length) this.rows.push(this.newRow(''))
    this.renderList()
    this.evaluate()
    this.focusRow(focus ?? Math.min(index, this.rows.length - 1))
  }

  private focusRow(index: number): void {
    const row = this.rows[index]
    if (!row) return
    const input = this.dom.get(row.id)!.input
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }

  /** Rewrite a row's text from a drag or a slider, keeping the input in sync. */
  private setSource(row: Row, source: string): void {
    row.source = source
    const dom = this.dom.get(row.id)
    if (dom) dom.input.value = source
    this.evaluate()
  }

  /* ---- evaluation ------------------------------------------------------ */

  private evaluate(): void {
    this.results = evaluateSheet(this.rows)

    // A trailing blank row means there is always somewhere to type next.
    if (this.rows[this.rows.length - 1].source.trim()) {
      this.rows.push(this.newRow(''))
      this.list.append(this.buildRow(this.rows[this.rows.length - 1]))
      this.results = evaluateSheet(this.rows)
    }

    for (const row of this.rows) this.refreshRow(row)
    this.rebuildHandles()
    this.widget.requestDraw()
    this.save()
  }

  private refreshRow(row: Row): void {
    const dom = this.dom.get(row.id)
    const result = this.results.get(row.id)
    if (!dom || !result) return

    const drawable = result.value !== null && isVec(result.value)
    dom.li.classList.toggle('is-error', result.error !== null)
    dom.li.classList.toggle('is-hidden', row.hidden)
    // Only a row that draws something has anything to hide.
    dom.swatch.classList.toggle('is-drawable', drawable)
    dom.swatch.setAttribute('aria-pressed', String(drawable && !row.hidden))

    if (result.error) {
      dom.output.textContent = result.error
    } else if (result.value !== null) {
      const name = result.name ? `${result.name} = ` : '= '
      dom.output.textContent = name + fmtValue(result.value)
    } else {
      dom.output.textContent = ''
    }

    const scalar = literalScalar(result.statement)
    dom.slider.hidden = scalar === null
    if (scalar !== null && document.activeElement !== dom.slider) {
      // Give the handle room to move on both sides of wherever the value is.
      const reach = Math.max(10, Math.abs(scalar) * 2)
      dom.slider.min = String(-reach)
      dom.slider.max = String(reach)
      dom.slider.step = String(reach / 500)
      dom.slider.value = String(scalar)
    }
  }

  /* ---- the plot -------------------------------------------------------- */

  /** Rows that currently draw an arrow, in list order. */
  private drawn(): { row: Row; value: Vec2; result: RowResult }[] {
    const out: { row: Row; value: Vec2; result: RowResult }[] = []
    for (const row of this.rows) {
      const result = this.results.get(row.id)
      if (!result || row.hidden || result.value === null || !isVec(result.value)) continue
      out.push({ row, value: result.value, result })
    }
    return out
  }

  private rebuildHandles(): void {
    this.widget.handles = this.drawn()
      .filter(({ result }) => literalVec(result.statement) !== null)
      .map(({ row, result }) =>
        worldHandle(
          this.vp,
          () => result.value as Vec2,
          (p) => {
            const name = result.statement!.name
            // `(3, 2)` and `v(3, 2)` both parse to the same call — write back
            // whichever spelling the reader used, so dragging never rewrites
            // their notation out from under them.
            const bare = (name ? row.source.slice(row.source.indexOf('=') + 1) : row.source)
              .trim()
              .startsWith('(')
            const body = `${bare ? '(' : 'v('}${fmtSource(p.x)}, ${fmtSource(p.y)})`
            this.setSource(row, name ? `${name} = ${body}` : body)
          },
          { radius: 12 },
        ),
      )
  }

  private drawPlot(ctx: CanvasRenderingContext2D, w: CanvasWidget): void {
    drawGrid(ctx, this.vp, w)

    for (const { row, value, result } of this.drawn()) {
      if (value.x === 0 && value.y === 0) {
        draw.point2(ctx, this.vp, value, { color: row.color, r: 4 })
        continue
      }
      draw.arrow2(ctx, this.vp, v2.vec2(0, 0), value, { color: row.color, width: 2.5 })
      const tip = this.vp.toScreen(value)
      // Nudge the label further along the arrow, outside the head.
      const dir = v2.normalize(v2.sub(tip, this.vp.toScreen(v2.vec2(0, 0))))
      const at = v2.add(tip, v2.scale(dir, 12))
      const label = result.name ?? row.source.trim()
      ctx.save()
      ctx.font = draw.MONO_FONT
      ctx.textAlign = dir.x < -0.3 ? 'right' : dir.x > 0.3 ? 'left' : 'center'
      draw.drawLabel(ctx, label, v2.vec2(at.x, at.y), row.color)
      ctx.restore()

      if (literalVec(result.statement)) {
        draw.point2(ctx, this.vp, value, { color: row.color, r: 3.5 })
      }
    }
  }

  /* ---- chrome ---------------------------------------------------------- */

  private bindPanel(root: HTMLElement): void {
    root.querySelector('.pg-add')!.addEventListener('click', () => {
      this.insertAfter(this.rows.length - 1)
    })

    const status = root.querySelector<HTMLElement>('.pg-status')!
    const file = root.querySelector<HTMLInputElement>('.pg-file')!

    root.querySelector('.pg-export')!.addEventListener('click', () => {
      download('vectors.json', serialize(toFile(this.rows, this.results, this.vp)))
      this.say(status, `Exported ${this.rows.filter((r) => r.source.trim()).length} rows`, false)
    })

    root.querySelector('.pg-import')!.addEventListener('click', () => file.click())

    file.addEventListener('change', async () => {
      const chosen = file.files?.[0]
      // Re-picking the same file after an edit must still fire `change`.
      file.value = ''
      if (!chosen) return
      try {
        const sheet = parseFile(await chosen.text())
        this.applySheet(sheet)
        this.say(status, `Imported ${sheet.rows.length} rows from ${chosen.name}`, false)
      } catch (err) {
        this.say(status, err instanceof ImportError ? err.message : String(err), true)
      }
    })
  }

  private say(status: HTMLElement, message: string, isError: boolean): void {
    status.textContent = message
    status.hidden = false
    status.classList.toggle('is-error', isError)
    clearTimeout(this.statusTimer)
    this.statusTimer = setTimeout(() => {
      status.hidden = true
    }, 5000)
  }

  /** Replace the whole sheet from an imported file. */
  private applySheet(sheet: ImportedSheet): void {
    this.rows = []
    for (const imported of sheet.rows) {
      // Build up front so newRow()'s colour tally sees the imported colours and
      // only fills in the gaps.
      const row = this.newRow(imported.source)
      if (imported.color) row.color = imported.color
      row.hidden = imported.hidden ?? false
      this.rows.push(row)
    }
    if (sheet.view) {
      this.vp.center = sheet.view.center
      this.vp.unitsHigh = sheet.view.unitsHigh
    }
    if (!this.rows.length || this.rows[this.rows.length - 1].source.trim()) {
      this.rows.push(this.newRow(''))
    }
    this.renderList()
    this.evaluate()
  }

  private zoom(factor: number, at?: Vec2): void {
    const before = at ? this.vp.toWorld(at) : this.vp.center
    this.vp.unitsHigh = Math.min(400, Math.max(0.5, this.vp.unitsHigh * factor))
    if (at) {
      // Keep the world point under the cursor pinned there.
      const after = this.vp.toWorld(at)
      this.vp.center = v2.add(this.vp.center, v2.sub(before, after))
    }
    this.widget.requestDraw()
    this.save()
  }

  private bindView(root: HTMLElement, view: HTMLElement): void {
    this.widget.onBackgroundDrag = (dx, dy) => {
      this.vp.center = v2.sub(this.vp.center, v2.vec2(dx / this.vp.scale, -dy / this.vp.scale))
      this.save()
    }

    this.widget.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const r = this.widget.canvas.getBoundingClientRect()
        this.zoom(Math.exp(e.deltaY * 0.002), v2.vec2(e.clientX - r.left, e.clientY - r.top))
      },
      { passive: false },
    )

    root.querySelector('.pg-zoom-in')!.addEventListener('click', () => this.zoom(1 / 1.4))
    root.querySelector('.pg-zoom-out')!.addEventListener('click', () => this.zoom(1.4))
    root.querySelector('.pg-home')!.addEventListener('click', () => {
      this.vp.center = v2.vec2(0, 0)
      this.vp.unitsHigh = 12
      this.widget.requestDraw()
      this.save()
    })

    new ResizeObserver(() => this.widget.setHeight(view.clientHeight)).observe(view)

    mountGutter(root.querySelector('.pg-gutter')!, {
      root: root.querySelector('.pg')!,
      cssVar: '--pg-panel-w',
      axis: 'x',
      measure: (clientX) => clientX - root.querySelector('.pg')!.getBoundingClientRect().left,
      bounds: () => ({ min: 240, max: Math.max(240, window.innerWidth - 320) }),
      storageKey: '3d101:playground:panel-w',
    })
  }
}

/* ------------------------------ plot chrome ----------------------------- */

/** The 1/2/5 step whose spacing lands nearest `targetPx` on screen. */
function niceStep(pxPerUnit: number, targetPx = 90): number {
  const raw = targetPx / pxPerUnit
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const f = raw / magnitude
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * magnitude
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  vp: Viewport2D,
  size: { width: number; height: number },
): void {
  const step = niceStep(vp.scale)
  const minor = step / 5
  const tl = vp.toWorld(v2.vec2(0, 0))
  const br = vp.toWorld(v2.vec2(size.width, size.height))

  ctx.save()
  ctx.lineWidth = 1

  // Index the lines rather than accumulating a float step: at high zoom the
  // drift is enough to make `i % 5` disagree with where the labels go.
  for (let i = Math.floor(tl.x / minor); i <= Math.ceil(br.x / minor); i++) {
    const sx = Math.round(vp.toScreen(v2.vec2(i * minor, 0)).x) + 0.5
    ctx.strokeStyle = i % 5 === 0 ? COLORS.axis : COLORS.grid
    ctx.beginPath()
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, size.height)
    ctx.stroke()
  }
  for (let i = Math.floor(br.y / minor); i <= Math.ceil(tl.y / minor); i++) {
    const sy = Math.round(vp.toScreen(v2.vec2(0, i * minor)).y) + 0.5
    ctx.strokeStyle = i % 5 === 0 ? COLORS.axis : COLORS.grid
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(size.width, sy)
    ctx.stroke()
  }

  // Axes. When an axis is panned off screen its ticks still need a home, so
  // both the line and its labels clamp to the edge they went out on.
  const origin = vp.toScreen(v2.vec2(0, 0))
  const ax = clamp(origin.x, 0.5, size.width - 0.5)
  const ay = clamp(origin.y, 0.5, size.height - 0.5)
  ctx.strokeStyle = COLORS.dim
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, Math.round(ay) + 0.5)
  ctx.lineTo(size.width, Math.round(ay) + 0.5)
  ctx.moveTo(Math.round(ax) + 0.5, 0)
  ctx.lineTo(Math.round(ax) + 0.5, size.height)
  ctx.stroke()

  ctx.font = draw.MONO_FONT
  ctx.fillStyle = COLORS.dim
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let i = Math.ceil(tl.x / step); i <= Math.floor(br.x / step); i++) {
    if (i === 0) continue
    ctx.fillText(fmtNum(i * step), vp.toScreen(v2.vec2(i * step, 0)).x, clamp(ay + 5, 5, size.height - 16))
  }
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let i = Math.ceil(br.y / step); i <= Math.floor(tl.y / step); i++) {
    if (i === 0) continue
    ctx.fillText(fmtNum(i * step), clamp(ax - 6, 26, size.width - 4), vp.toScreen(v2.vec2(0, i * step)).y)
  }
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText('0', clamp(ax - 6, 26, size.width - 4), clamp(ay + 5, 5, size.height - 16))
  ctx.restore()
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/* ------------------------------- reference ------------------------------ */

function referenceHtml(): string {
  const names = Object.keys(BUILTINS)
    .map((name) => `<li><code>${BUILTINS[name].help.replace(/</g, '&lt;')}</code></li>`)
    .join('')
  const constants = Object.keys(CONSTANTS)
    .map((n) => `<code>${n}</code>`)
    .join(', ')
  return `
    <details class="pg-help">
      <summary>What can I type?</summary>
      <p>
        A row is an expression. Name it — <code>a = v(3, 2)</code> — and other rows can use it,
        in any order. <code>+ - * / ^</code> work on numbers and vectors; a number touching a
        name multiplies, so <code>2a</code> is <code>2 * a</code>.
      </p>
      <p>Drag the dot on a literal vector to edit it. Constants: ${constants}.</p>
      <p>
        <strong>Export</strong> writes these rows as JSON, with each row's computed value
        alongside its text. <strong>Import</strong> replaces them — it reads that file back, or
        any bare array like <code>[{"x": 1, "y": 2}, "v(3, 4)"]</code>.
      </p>
      <ul>${names}</ul>
    </details>
  `
}

export function mountPlayground(root: HTMLElement): void {
  new Playground(root)
}
