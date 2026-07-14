/**
 * The sandbox app: viewport + transport + inspector on the left, editor +
 * console/tests on the right, all driven by one Timeline.
 *
 * Note the sim runs on the main thread, like every widget in the course does
 * — an infinite loop in learner code will hang the tab. Two guards: code only
 * compiles on an explicit Run (never per keystroke), and a frame that takes
 * absurdly long pauses playback with a warning. The `Tests` tab runs the same
 * code in the worker, which *is* timeout-protected.
 */

import { v2 } from '@/math'
import type { RunOutcome, UserFns } from '@/exercise/types'
import { getExercise } from '@/exercise/registry'
import { compileUserCode, CompileError } from '@/exercise/compile'
import { runner } from '@/exercise/runner'
import { loadState } from '@/exercise/storage'
import { CanvasWidget, Camera3D, COLORS, draw, MONO_FONT } from '@/widgets'
import type { Editor } from '@/exercise/editor'
import { Timeline, DT, MAX_FRAMES } from './timeline'
import type { Frame } from './timeline'
import type { LogEntry, SandboxScene } from './types'
import { mountGutter } from './splitter'
import { SCENES } from './scenes'

const SPEEDS = [0.1, 0.25, 0.5, 1, 2]
const MAX_LOG_ROWS = 400

/** Sandbox scratch code, kept apart from the module page's exercise attempt. */
const scratchKey = (sceneId: string) => `3d101:sandbox:${sceneId}`

type EditorKind = 'monaco' | 'codemirror'
const EDITOR_KEY = '3d101:sandbox:editor'

/** Which editor to mount. `?editor=codemirror` wins, for a one-off comparison. */
function editorPref(): EditorKind {
  const q = new URLSearchParams(location.search).get('editor')
  if (q === 'monaco' || q === 'codemirror') return q
  return localStorage.getItem(EDITOR_KEY) === 'codemirror' ? 'codemirror' : 'monaco'
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string,
): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (html !== undefined) n.innerHTML = html
  return n
}

export class Sandbox {
  private readonly scene: SandboxScene<unknown>
  private readonly timeline: Timeline<unknown>
  private readonly cam: Camera3D
  private readonly widget: CanvasWidget

  private editor: Editor | null = null
  private selectedId: string | null = null
  /** Cursor the panes were last rendered at; -1 forces a full redraw. */
  private renderedCursor = -1
  private consoleTail = -1
  private currentFrameOnly = false
  private lastCompileError: string | null = null

  // DOM handles.
  private readonly dom: {
    view: HTMLElement
    scrub: HTMLInputElement
    playBtn: HTMLButtonElement
    speedBtn: HTMLButtonElement
    frameLabel: HTMLElement
    summary: HTMLElement
    entities: HTMLElement
    trace: HTMLElement
    consoleList: HTMLElement
    tests: HTMLElement
    status: HTMLElement
  }

  constructor(root: HTMLElement, scene: SandboxScene<unknown>) {
    this.scene = scene
    this.timeline = new Timeline(scene)
    this.cam = scene.makeCamera()

    root.append(this.buildLayout())
    this.dom = {
      view: root.querySelector('.sb-view')!,
      scrub: root.querySelector('.sb-scrub')!,
      playBtn: root.querySelector('.sb-play')!,
      speedBtn: root.querySelector('.sb-speed')!,
      frameLabel: root.querySelector('.sb-frame')!,
      summary: root.querySelector('.sb-summary')!,
      entities: root.querySelector('.sb-entities')!,
      trace: root.querySelector('.sb-trace')!,
      consoleList: root.querySelector('.sb-console-list')!,
      tests: root.querySelector('.sb-tests')!,
      status: root.querySelector('.sb-status')!,
    }

    this.widget = new CanvasWidget(this.dom.view, {
      mode: 'static',
      height: 420,
      draw: (ctx, w) => this.drawFrame(ctx, w),
    })
    this.cam.attachOrbit(this.widget)
    this.bindViewport()
    this.bindGutters(root.querySelector('.sb')!)
    this.bindTransport(root)
    this.bindParams(root)
    this.bindEditor(root)
    this.bindKeys()

    void this.loadEditor()
    this.loop()
  }

  /* ---- layout ------------------------------------------------------------ */

  private buildLayout(): HTMLElement {
    const wrap = el('div', 'sb')
    wrap.innerHTML = `
      <section class="sb-left">
        <div class="sb-view"></div>
        <div class="sb-transport">
          <button class="sb-btn sb-reset" title="Reset to frame 0 (R)">⏮</button>
          <button class="sb-btn sb-back" title="Step back one frame (←)">◀|</button>
          <button class="sb-btn sb-play primary" title="Play / pause (space)">▶</button>
          <button class="sb-btn sb-fwd" title="Step forward one frame (→)">|▶</button>
          <input class="sb-scrub" type="range" min="0" max="0" step="1" value="0" />
          <span class="sb-frame mono"></span>
          <button class="sb-btn sb-speed" title="Playback speed">1×</button>
        </div>
        <div class="sb-params"></div>
        <div class="sb-gutter sb-gutter-h" data-split="inspector" title="Drag to resize"></div>
        <div class="sb-inspector">
          <div class="sb-summary"></div>
          <div class="sb-cols">
            <div class="sb-col">
              <h3>particles <span class="sb-hint">click a row, or a dot in the scene</span></h3>
              <div class="sb-entities"></div>
            </div>
            <div class="sb-col">
              <h3>this frame's math <span class="sb-hint">reference vs. your code</span></h3>
              <div class="sb-trace"></div>
            </div>
          </div>
        </div>
      </section>

      <aside class="sb-right">
        <div class="sb-bar">
          <button class="sb-btn primary sb-run" title="Compile and restart (⌘⏎)">Run ⌘⏎</button>
          <button class="sb-btn sb-load-mine">My exercise code</button>
          <button class="sb-btn sb-load-starter">Starter</button>
          <button class="sb-btn sb-load-solution">Solution</button>
          <button class="sb-btn sb-editor-swap" title="Switch code editor"></button>
        </div>
        <div class="sb-editor"></div>
        <div class="sb-status"></div>
        <div class="sb-gutter sb-gutter-h" data-split="bottom" title="Drag to resize"></div>
        <div class="sb-bottom">
          <div class="sb-tabs">
            <button class="sb-tab is-active" data-tab="console">Console</button>
            <button class="sb-tab" data-tab="tests">Tests</button>
            <label class="sb-only"><input type="checkbox" class="sb-current-only" /> only this frame</label>
            <button class="sb-btn sb-clear">Clear</button>
          </div>
          <div class="sb-pane" data-pane="console"><div class="sb-console-list"></div></div>
          <div class="sb-pane is-hidden" data-pane="tests"><div class="sb-tests"></div></div>
        </div>
      </aside>
    `
    // The column gutter sits between the two panes, so it must be inserted
    // between them rather than inside either one.
    const colGutter = el('div', 'sb-gutter sb-gutter-v')
    colGutter.dataset.split = 'cols'
    colGutter.title = 'Drag to resize'
    wrap.querySelector('.sb-right')!.before(colGutter)
    return wrap
  }

  /** Wire the three gutters: columns, viewport/inspector, editor/console. */
  private bindGutters(root: HTMLElement): void {
    const left = root.querySelector<HTMLElement>('.sb-left')!
    const right = root.querySelector<HTMLElement>('.sb-right')!
    const q = (name: string) => root.querySelector<HTMLElement>(`[data-split="${name}"]`)!

    mountGutter(q('cols'), {
      root,
      cssVar: '--sb-left-w',
      axis: 'x',
      storageKey: '3d101:sandbox:split:cols',
      measure: (x) => x - root.getBoundingClientRect().left,
      bounds: () => ({ min: 360, max: root.clientWidth - 340 }),
    })

    // Both row gutters size the panel *below* them, so they measure up from
    // that panel's bottom edge.
    mountGutter(q('inspector'), {
      root,
      cssVar: '--sb-inspector-h',
      axis: 'y',
      storageKey: '3d101:sandbox:split:inspector',
      measure: (y) => left.getBoundingClientRect().bottom - y,
      bounds: () => ({ min: 90, max: left.clientHeight - 240 }),
    })

    mountGutter(q('bottom'), {
      root,
      cssVar: '--sb-bottom-h',
      axis: 'y',
      storageKey: '3d101:sandbox:split:bottom',
      measure: (y) => right.getBoundingClientRect().bottom - y,
      bounds: () => ({ min: 80, max: right.clientHeight - 180 }),
    })
  }

  /* ---- learner code ------------------------------------------------------ */

  private async loadEditor(): Promise<void> {
    const spec = getExercise(this.scene.exerciseId)
    const scratch = localStorage.getItem(scratchKey(this.scene.id))
    // Seed from whatever you last wrote on the module page, so the sandbox
    // opens on *your* attempt rather than a blank starter.
    const initial = scratch ?? loadState(spec)?.code ?? spec.starter

    const host = document.querySelector<HTMLElement>('.sb-editor')!
    const hooks = {
      onRun: () => this.run(),
      onChange: (code: string) => localStorage.setItem(scratchKey(this.scene.id), code),
    }

    if (editorPref() === 'monaco') {
      // Typed globals for exactly the functions this exercise puts in scope,
      // so `add3(` shows its signature instead of reading as an undeclared name.
      const { createMonacoEditor } = await import('./monaco')
      this.editor = createMonacoEditor(host, initial, { ...hooks, provides: spec.provides })
    } else {
      const { createEditor } = await import('@/exercise/editor')
      this.editor = createEditor(host, initial, hooks)
    }
    this.run()
  }

  private run(): void {
    const code = this.editor?.get()
    if (code === undefined) return
    const spec = getExercise(this.scene.exerciseId)
    try {
      // The injected scope shadows Math.random (seeded) and console (recorded).
      const fns: UserFns = compileUserCode(spec, code, this.timeline.codeScope())
      this.lastCompileError = null
      this.timeline.setFns(fns)
      this.timeline.playing = true
      this.setStatus(`compiled — ${spec.exports.join(', ')} ready`, 'ok')
    } catch (err) {
      this.lastCompileError =
        err instanceof CompileError ? err.message : `Unexpected error: ${String(err)}`
      this.timeline.setFns(null)
      this.setStatus(this.lastCompileError, 'err')
    }
    this.renderedCursor = -1
    this.consoleTail = -1
    this.selectedId = null
    this.sync()
  }

  private setStatus(text: string, kind: 'ok' | 'err' | 'warn'): void {
    this.dom.status.textContent = text
    this.dom.status.className = `sb-status is-${kind}`
  }

  private setCode(code: string): void {
    this.editor?.set(code)
    this.run()
  }

  /* ---- wiring ------------------------------------------------------------ */

  private bindEditor(root: HTMLElement): void {
    const spec = getExercise(this.scene.exerciseId)
    root.querySelector('.sb-run')!.addEventListener('click', () => this.run())
    root.querySelector('.sb-load-starter')!.addEventListener('click', () => this.setCode(spec.starter))
    root.querySelector('.sb-load-solution')!.addEventListener('click', () => this.setCode(spec.solution))
    root.querySelector('.sb-load-mine')!.addEventListener('click', () => {
      const saved = loadState(spec)?.code
      if (saved) this.setCode(saved)
      else this.setStatus('no saved attempt for this exercise yet — solve it on the module page', 'warn')
    })

    // A/B the two editors. Reloading is the honest way to swap: both editors
    // own their DOM and their workers, and your code is already persisted to
    // the scratch key on every keystroke, so nothing is lost.
    const swap = root.querySelector<HTMLButtonElement>('.sb-editor-swap')!
    const kind = editorPref()
    swap.textContent = kind === 'monaco' ? 'Editor: Monaco' : 'Editor: CodeMirror'
    swap.addEventListener('click', () => {
      localStorage.setItem(EDITOR_KEY, kind === 'monaco' ? 'codemirror' : 'monaco')
      // Drop any ?editor= override so the stored choice takes effect.
      location.href = location.pathname + location.search.replace(/[?&]editor=[^&]*/, '')
    })

    for (const tab of root.querySelectorAll<HTMLButtonElement>('.sb-tab')) {
      tab.addEventListener('click', () => {
        for (const t of root.querySelectorAll('.sb-tab')) t.classList.toggle('is-active', t === tab)
        for (const p of root.querySelectorAll<HTMLElement>('.sb-pane')) {
          p.classList.toggle('is-hidden', p.dataset.pane !== tab.dataset.tab)
        }
        if (tab.dataset.tab === 'tests') void this.runTests()
      })
    }
    root.querySelector<HTMLInputElement>('.sb-current-only')!.addEventListener('change', (e) => {
      this.currentFrameOnly = (e.target as HTMLInputElement).checked
      this.consoleTail = -1
      this.renderConsole()
    })
    root.querySelector('.sb-clear')!.addEventListener('click', () => {
      this.dom.consoleList.replaceChildren()
      this.consoleTail = this.timeline.cursor
    })
  }

  private bindTransport(root: HTMLElement): void {
    root.querySelector('.sb-play')!.addEventListener('click', () => {
      this.timeline.playing = !this.timeline.playing
      // Hitting play at the end of a full history would do nothing — start over.
      if (this.timeline.playing && this.timeline.atCap && this.timeline.cursor === this.timeline.last) {
        this.timeline.reset()
        this.timeline.playing = true
      }
      this.sync()
    })
    root.querySelector('.sb-fwd')!.addEventListener('click', () => {
      this.timeline.playing = false
      this.timeline.stepForward()
      this.sync()
    })
    root.querySelector('.sb-back')!.addEventListener('click', () => {
      this.timeline.playing = false
      this.timeline.stepBack()
      this.sync()
    })
    root.querySelector('.sb-reset')!.addEventListener('click', () => {
      this.timeline.reset()
      this.renderedCursor = -1
      this.consoleTail = -1
      this.sync()
    })
    this.dom.scrub.addEventListener('input', () => {
      this.timeline.playing = false
      this.timeline.seek(Number(this.dom.scrub.value))
      this.sync()
    })
    this.dom.speedBtn.addEventListener('click', () => {
      const i = (SPEEDS.indexOf(this.timeline.speed) + 1) % SPEEDS.length
      this.timeline.speed = SPEEDS[i]
      this.dom.speedBtn.textContent = `${SPEEDS[i]}×`
    })
  }

  private bindParams(root: HTMLElement): void {
    const bar = root.querySelector('.sb-params')!
    for (const p of this.scene.params) {
      const wrap = el('label', 'sb-param')
      const input = el('input')
      input.type = 'range'
      input.min = String(p.min)
      input.max = String(p.max)
      input.step = String(p.step ?? 0.01)
      input.value = String(p.value)
      const fmt = p.format ?? ((v: number) => v.toFixed(2))
      const out = el('span', 'value', fmt(p.value))
      wrap.append(`${p.label} `, input, out)
      bar.append(wrap)
      input.addEventListener('input', () => {
        const v = Number(input.value)
        out.textContent = fmt(v)
        // Keeps the past, drops the future: the change takes effect from here.
        this.timeline.setParam(p.key, v)
        this.sync()
      })
    }
  }

  private bindViewport(): void {
    this.widget.onTap = (pos) => {
      const hit = this.pick(pos)
      this.selectedId = hit
      this.renderedCursor = -1
      this.sync()
    }
    this.widget.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        this.cam.dist = Math.min(60, Math.max(3, this.cam.dist * (1 + Math.sign(e.deltaY) * 0.1)))
        this.widget.requestDraw()
      },
      { passive: false },
    )
    new ResizeObserver(() => {
      this.widget.setHeight(this.dom.view.clientHeight)
    }).observe(this.dom.view)
  }

  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      // Never steal keys from the editor or a slider. Miss the editor's own
      // container class and space would pause the sim mid-word, and the arrow
      // keys would step frames instead of moving the caret.
      const t = e.target as HTMLElement
      if (t.closest('.cm-editor, .monaco-editor') || t.tagName === 'INPUT') return
      const jump = e.shiftKey ? 10 : 1
      if (e.key === ' ') {
        e.preventDefault()
        this.timeline.playing = !this.timeline.playing
      } else if (e.key === 'ArrowRight') {
        this.timeline.playing = false
        for (let i = 0; i < jump; i++) this.timeline.stepForward()
      } else if (e.key === 'ArrowLeft') {
        this.timeline.playing = false
        for (let i = 0; i < jump; i++) this.timeline.stepBack()
      } else if (e.key === 'Home') {
        this.timeline.seek(0)
      } else if (e.key === 'End') {
        this.timeline.seek(this.timeline.last)
      } else if (e.key === 'r' || e.key === 'R') {
        this.timeline.reset()
        this.renderedCursor = -1
        this.consoleTail = -1
      } else {
        return
      }
      this.sync()
    })
  }

  /** Nearest entity to a click, within a comfortable radius. */
  private pick(at: { x: number; y: number }): string | null {
    let best: string | null = null
    let bestD = 18
    for (const ent of this.scene.entities(this.timeline.current.state)) {
      const s = this.cam.toScreen(ent.pos, this.widget)
      if (!s) continue
      const d = v2.distance(s, v2.vec2(at.x, at.y))
      if (d < bestD) {
        bestD = d
        best = ent.id
      }
    }
    return best
  }

  /* ---- frame loop -------------------------------------------------------- */

  private loop(): void {
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.25)
      last = now
      if (this.timeline.advance(dt)) this.sync()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  /** Push timeline state into every pane. Cheap when the cursor hasn't moved. */
  private sync(): void {
    const tl = this.timeline
    this.dom.playBtn.textContent = tl.playing ? '❚❚' : '▶'
    this.dom.playBtn.classList.toggle('is-playing', tl.playing)
    this.dom.scrub.max = String(Math.max(1, tl.last))
    this.dom.scrub.value = String(tl.cursor)
    this.dom.frameLabel.textContent = `frame ${tl.cursor} / ${tl.last}  ·  t = ${tl.current.t.toFixed(3)} s  ·  dt = ${(DT * 1000).toFixed(2)} ms`

    if (tl.stalled) this.setStatus(tl.stalled, 'err')
    else if (tl.atCap && tl.cursor === tl.last) {
      this.setStatus(`history full (${MAX_FRAMES} frames ≈ ${(MAX_FRAMES * DT).toFixed(0)} s) — press ⏮ to record again`, 'warn')
    }

    this.widget.requestDraw()
    if (this.renderedCursor === tl.cursor) return
    this.renderInspector()
    this.renderConsole()
    this.renderedCursor = tl.cursor
  }

  /* ---- rendering --------------------------------------------------------- */

  private drawFrame(ctx: CanvasRenderingContext2D, w: CanvasWidget): void {
    const tl = this.timeline
    const frame = tl.current
    this.scene.draw(ctx, this.cam, w, frame.state, {
      params: tl.params,
      selectedId: this.selectedId,
      trail: tl.trail(this.selectedId),
    })
    this.drawDbg(ctx, w, frame)

    if (!tl.hasFns()) {
      ctx.save()
      ctx.fillStyle = COLORS.dim
      ctx.font = MONO_FONT
      ctx.textAlign = 'center'
      ctx.fillText(this.lastCompileError ?? this.scene.emptyHint, w.width / 2, w.height / 2)
      ctx.restore()
    }
  }

  /** Debug geometry recorded this frame — by the scene or by the learner's `dbg` calls. */
  private drawDbg(ctx: CanvasRenderingContext2D, w: CanvasWidget, frame: Frame<unknown>): void {
    for (const c of frame.dbg) {
      const color = c.color ?? COLORS.purple
      if (c.kind === 'point') draw.point3(ctx, this.cam, w, c.p, { color, label: c.label })
      else if (c.kind === 'arrow') draw.arrow3(ctx, this.cam, w, c.from, c.to, { color, label: c.label })
      else if (c.kind === 'line') draw.line3(ctx, this.cam, w, c.from, c.to, { color })
      else {
        const s = this.cam.toScreen(c.p, w)
        if (s) draw.drawLabel(ctx, c.text, v2.vec2(s.x + 8, s.y - 8), color)
      }
    }
  }

  private renderInspector(): void {
    const tl = this.timeline
    const frame = tl.current
    const prev = tl.cursor > 0 ? tl.frames[tl.cursor - 1] : null

    const summary = this.scene.summary(frame.state, prev ? prev.state : null)
    this.dom.summary.replaceChildren(
      ...summary.map((f) => {
        const n = el('div', 'sb-stat')
        n.innerHTML = `<span class="k">${f.label}</span><span class="v mono" ${f.color ? `style="color:${f.color}"` : ''}>${f.value}</span>`
        return n
      }),
    )

    // Entity table. Only the selected row's values need to be exact; the rest
    // is a picker, so keep it to one line each.
    const entities = this.scene.entities(frame.state)
    if (!entities.length) {
      this.dom.entities.replaceChildren(el('p', 'sb-empty', 'nothing alive on this frame'))
    } else {
      const rows = entities.map((ent) => {
        const row = el('button', 'sb-row')
        row.classList.toggle('is-selected', ent.id === this.selectedId)
        row.innerHTML =
          `<span class="id">${ent.label}</span>` +
          ent.fields.map((f) => `<span class="f"><i>${f.label}</i> ${f.value}</span>`).join('')
        row.addEventListener('click', () => {
          this.selectedId = this.selectedId === ent.id ? null : ent.id
          this.renderedCursor = -1
          this.sync()
        })
        return row
      })
      this.dom.entities.replaceChildren(...rows)
      const sel = this.dom.entities.querySelector('.is-selected')
      sel?.scrollIntoView({ block: 'nearest' })
    }

    this.renderTrace(frame, prev)
  }

  private renderTrace(frame: Frame<unknown>, prev: Frame<unknown> | null): void {
    const box = this.dom.trace
    if (!this.selectedId) {
      box.replaceChildren(
        el(
          'p',
          'sb-empty',
          'Select a particle to see the arithmetic for this frame: what your <code>updateParticle</code> was handed, what semi-implicit Euler predicts, and what you returned.',
        ),
      )
      return
    }
    if (!prev || !this.scene.trace) {
      box.replaceChildren(el('p', 'sb-empty', 'step forward one frame to see the math'))
      return
    }

    const lines = this.scene.trace(
      prev.state,
      frame.state,
      this.selectedId,
      DT,
      this.timeline.params,
    )
    if (!lines.length) {
      box.replaceChildren(el('p', 'sb-empty', 'that particle does not exist on this frame'))
      return
    }

    box.replaceChildren(
      ...lines.map((l) => {
        const n = el('div', 'sb-trace-line')
        if (l.ok === true) n.classList.add('is-ok')
        if (l.ok === false) n.classList.add('is-bad')
        const mark = l.ok === undefined ? '' : l.ok ? '<span class="mark ok">✓</span>' : '<span class="mark bad">✗</span>'
        const got =
          l.got !== undefined && l.ok === false
            ? `<div class="got">your code returned <b>${l.got}</b></div>`
            : ''
        n.innerHTML = `
          <div class="head"><span class="lbl mono">${l.label}</span>${mark}</div>
          <div class="expr mono">${l.expr}</div>
          <div class="val mono">= ${l.expect}</div>
          ${got}
          ${l.note ? `<div class="note">${l.note}</div>` : ''}
        `
        return n
      }),
    )
  }

  private renderConsole(): void {
    const tl = this.timeline
    const list = this.dom.consoleList

    const entriesOf = (f: Frame<unknown>): LogEntry[] => [
      ...f.logs,
      ...f.errors.map((text): LogEntry => ({ frame: f.index, level: 'error', text })),
    ]

    const append = (entries: LogEntry[]) => {
      for (const e of entries) {
        const row = el('div', `sb-log is-${e.level}`)
        row.innerHTML = `<span class="fr mono">${e.frame}</span><span class="msg mono"></span>`
        row.querySelector('.msg')!.textContent = e.text
        row.addEventListener('click', () => {
          tl.playing = false
          tl.seek(e.frame)
          this.sync()
        })
        list.append(row)
      }
      while (list.childElementCount > MAX_LOG_ROWS) list.firstElementChild!.remove()
      list.scrollTop = list.scrollHeight
    }

    const placeholder = () => {
      if (list.childElementCount) return
      list.replaceChildren(
        el(
          'p',
          'sb-empty',
          'Nothing logged yet. <code>console.log(…)</code> from your code lands here tagged with the frame that produced it — click a line to jump to that frame.<br><br>' +
            'You can also draw into the scene: <code>dbg.point(p)</code>, <code>dbg.arrow(from, to)</code>, <code>dbg.line(from, to)</code> and <code>dbg.label(p, text)</code> are in scope, and what you draw is recorded per frame, so it scrubs with the timeline.',
        ),
      )
    }

    if (this.currentFrameOnly) {
      list.replaceChildren()
      append(entriesOf(tl.current))
      placeholder()
      this.consoleTail = tl.cursor
      return
    }

    // Fast path — playback advanced one frame, so just append its output.
    if (tl.cursor === this.consoleTail + 1) {
      const entries = entriesOf(tl.current)
      if (entries.length) {
        if (list.querySelector('.sb-empty')) list.replaceChildren()
        append(entries)
      }
      this.consoleTail = tl.cursor
      return
    }
    if (tl.cursor === this.consoleTail) return

    // Scrubbed or reset: rebuild the tail of the log up to the cursor.
    list.replaceChildren()
    const all: LogEntry[] = []
    for (let i = 0; i <= tl.cursor; i++) all.push(...entriesOf(tl.frames[i]))
    append(all.slice(-MAX_LOG_ROWS))
    placeholder()
    this.consoleTail = tl.cursor
  }

  private async runTests(): Promise<void> {
    const code = this.editor?.get()
    if (code === undefined) return
    const box = this.dom.tests
    box.replaceChildren(el('p', 'sb-empty', 'running…'))
    const outcome: RunOutcome = await runner.run(this.scene.exerciseId, code)

    if (outcome.kind === 'compile-error') {
      box.replaceChildren(el('p', 'sb-empty is-bad', outcome.message))
      return
    }
    if (outcome.kind === 'timeout') {
      box.replaceChildren(
        el('p', 'sb-empty is-bad', 'timed out — an infinite loop in your code, most likely'),
      )
      return
    }
    box.replaceChildren(
      ...outcome.results.map((r) => {
        const n = el('div', `sb-test ${r.pass ? 'is-ok' : 'is-bad'}`)
        n.innerHTML = `
          <span class="mark">${r.pass ? '✓' : '✗'}</span>
          <span class="t">${r.name}</span>
          ${r.message ? `<span class="m mono">${r.message}</span>` : ''}
          ${!r.pass && r.hint ? `<span class="h">${r.hint}</span>` : ''}
        `
        return n
      }),
    )
  }
}

/** Mount the sandbox, choosing the scene from `?scene=` (default: the first). */
export function mountSandbox(root: HTMLElement, sceneId: string | null): Sandbox {
  const scene = SCENES.find((s) => s.id === sceneId) ?? SCENES[0]
  return new Sandbox(root, scene)
}
