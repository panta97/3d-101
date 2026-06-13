/**
 * The exercise UI: read-only signature, CodeMirror editor (lazy-loaded),
 * Run/Reset/Reveal, test results, and the hookup that hands the learner's
 * compiled functions to live widgets.
 *
 * Flow per Run:
 *  1. Tests execute in the Web Worker (2 s hard timeout → terminate).
 *  2. If the code compiled and terminated — even with failing tests — it is
 *     compiled on the main thread (same path) and handed to linked widgets:
 *     buggy code producing funny pictures is part of the pedagogy. A post-hoc
 *     watchdog detaches functions that throw or take > 50 ms per call.
 *  3. All tests green → exercise marked complete (persisted).
 */

import type { ExerciseSpec, UserFns, TestResult } from './types'
import { runner } from './runner'
import { compileUserCode, CompileError } from './compile'
import { loadState, saveState, previousVersionState } from './storage'
import type { Editor } from './editor'

export interface ExerciseEvents {
  /** Called with compiled (watchdogged) learner fns, or null to detach. */
  onUserFns?: (fns: UserFns | null) => void
}

const WATCHDOG_MS = 50

/**
 * Wrap learner fns so a function that throws or stalls on live widget input
 * detaches the visualization instead of freezing or corrupting it.
 * (The worker already proved termination on test inputs; this guards the
 * residual risk on arbitrary interactive inputs.)
 */
function wrapUserFns(fns: UserFns, onDetach: (reason: string) => void): UserFns {
  let dead = false
  const wrapped: UserFns = {}
  for (const [name, fn] of Object.entries(fns)) {
    wrapped[name] = (...args: never[]) => {
      if (dead) return undefined
      const t0 = performance.now()
      try {
        const result = (fn as (...a: never[]) => unknown)(...args)
        if (performance.now() - t0 > WATCHDOG_MS) {
          dead = true
          onDetach(`\`${name}\` took too long on live input`)
        }
        return result
      } catch (err) {
        dead = true
        onDetach(`\`${name}\` threw on live input: ${err instanceof Error ? err.message : err}`)
        return undefined
      }
    }
  }
  return wrapped
}

export function mountExercise(
  container: HTMLElement,
  spec: ExerciseSpec,
  events: ExerciseEvents = {},
): void {
  container.classList.add('exercise')
  container.innerHTML = `
    <div class="exercise-header">
      <span class="tag">exercise</span>
      <span class="title">${spec.title}</span>
      <span class="done"></span>
    </div>
    <div class="exercise-signature">${escapeHtml(spec.signature)}</div>
    <div class="exercise-editor"><pre class="cm-placeholder"></pre></div>
    <div class="exercise-message info"></div>
    <div class="exercise-results"></div>
    <div class="exercise-actions">
      <button type="button" class="primary run" title="${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter">Run tests</button>
      <button type="button" class="reset danger-ghost">Reset to starter</button>
      <span class="spacer"></span>
      <button type="button" class="reveal danger-ghost">Reveal solution</button>
    </div>
  `
  const el = {
    done: container.querySelector<HTMLElement>('.done')!,
    editorHost: container.querySelector<HTMLElement>('.exercise-editor')!,
    placeholder: container.querySelector<HTMLElement>('.cm-placeholder')!,
    message: container.querySelector<HTMLElement>('.exercise-message')!,
    results: container.querySelector<HTMLElement>('.exercise-results')!,
    run: container.querySelector<HTMLButtonElement>('button.run')!,
    reset: container.querySelector<HTMLButtonElement>('button.reset')!,
    reveal: container.querySelector<HTMLButtonElement>('button.reveal')!,
  }

  const saved = loadState(spec)
  let currentCode = saved?.code ?? spec.starter
  let passedAt = saved?.passedAt
  let revealed = saved?.revealed ?? false
  let editor: Editor | null = null
  let saveTimer = 0

  el.placeholder.textContent = currentCode
  el.placeholder.style.cssText =
    'margin:0;padding:1rem;font-size:0.88rem;min-height:3rem;white-space:pre-wrap;'
  updateDone()

  // Offer recovery of an attempt made against an older starter/test version.
  if (!saved) {
    const old = previousVersionState(spec)
    if (old) {
      el.message.innerHTML = `This exercise changed since your last attempt. <a href="#" class="restore">Restore previous attempt</a>`
      el.message.querySelector('.restore')!.addEventListener('click', (e) => {
        e.preventDefault()
        setCode(old.code)
        showMessage('Previous attempt restored. It may need updates to pass the current tests.', 'info')
      })
    }
  }

  function updateDone(): void {
    el.done.textContent = passedAt ? (revealed ? '✓ solved (revealed)' : '✓ solved') : ''
  }

  function showMessage(text: string, kind: 'info' | 'error'): void {
    el.message.textContent = text
    el.message.className = `exercise-message ${kind}`
  }

  function persist(): void {
    saveState(spec, { code: currentCode, passedAt, revealed })
  }

  function onCodeChange(code: string): void {
    currentCode = code
    clearTimeout(saveTimer)
    saveTimer = window.setTimeout(persist, 500)
  }

  function setCode(code: string): void {
    currentCode = code
    if (editor) editor.set(code)
    else el.placeholder.textContent = code
    persist()
  }

  async function ensureEditor(): Promise<void> {
    if (editor) return
    const { createEditor } = await import('./editor')
    if (editor) return
    el.placeholder.remove()
    editor = createEditor(el.editorHost, currentCode, { onRun: run, onChange: onCodeChange })
  }

  // Load CodeMirror when the exercise nears the viewport.
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect()
        void ensureEditor()
      }
    },
    { rootMargin: '600px' },
  )
  io.observe(container)

  function renderResults(results: TestResult[]): void {
    el.results.innerHTML = ''
    for (const r of results) {
      const row = document.createElement('div')
      row.className = `test-row ${r.pass ? 'pass' : 'fail'}`
      row.innerHTML = `
        <span class="mark">${r.pass ? '✓' : '✗'}</span>
        <span>
          <span class="name">${escapeHtml(r.name)}</span>
          ${r.message ? `<span class="detail"> — ${escapeHtml(r.message)}</span>` : ''}
          ${r.hint ? `<div class="hint">hint: ${escapeHtml(r.hint)}</div>` : ''}
        </span>
      `
      el.results.append(row)
    }
  }

  function attachVisualization(): void {
    if (!events.onUserFns) return
    try {
      const fns = compileUserCode(spec, currentCode)
      events.onUserFns(
        wrapUserFns(fns, (reason) => {
          events.onUserFns?.(null)
          showMessage(`Visualization detached: ${reason}. Fix and re-run.`, 'error')
        }),
      )
    } catch {
      events.onUserFns(null)
    }
  }

  async function run(): Promise<void> {
    el.run.disabled = true
    showMessage('Running…', 'info')
    try {
      const outcome = await runner.run(spec.id, currentCode)
      switch (outcome.kind) {
        case 'compile-error':
          el.results.innerHTML = ''
          showMessage(outcome.message, 'error')
          events.onUserFns?.(null)
          break
        case 'timeout':
          el.results.innerHTML = ''
          showMessage(
            'Your code ran for more than 2 seconds — likely an infinite loop. The runner was reset; fix and re-run.',
            'error',
          )
          events.onUserFns?.(null)
          break
        case 'pass':
        case 'fail': {
          renderResults(outcome.results)
          const passed = outcome.kind === 'pass'
          if (passed) {
            passedAt = Date.now()
            persist()
            updateDone()
            showMessage('All tests pass — the visualization below is now running your code.', 'info')
          } else {
            const n = outcome.results.filter((r) => !r.pass).length
            showMessage(
              `${n} test${n === 1 ? '' : 's'} failing — the visualization still runs your code; watch what it does wrong.`,
              'info',
            )
          }
          attachVisualization()
          break
        }
      }
    } finally {
      el.run.disabled = false
    }
  }

  el.run.addEventListener('click', () => void run())

  el.reset.addEventListener('click', () => {
    setCode(spec.starter)
    el.results.innerHTML = ''
    showMessage('Reset to starter code.', 'info')
  })

  // Two-step reveal so a stray click doesn't spoil the answer.
  let revealArmed = false
  let revealTimer = 0
  el.reveal.addEventListener('click', () => {
    if (!revealArmed) {
      revealArmed = true
      el.reveal.textContent = 'Show it — I tried!'
      clearTimeout(revealTimer)
      revealTimer = window.setTimeout(() => {
        revealArmed = false
        el.reveal.textContent = 'Reveal solution'
      }, 3000)
      return
    }
    clearTimeout(revealTimer)
    revealArmed = false
    el.reveal.textContent = 'Reveal solution'
    revealed = true
    void ensureEditor().then(() => {
      setCode(spec.solution)
      void run()
    })
  })
}

function escapeHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

// Re-exported so content code (and CompileError consumers) need one import.
export { CompileError }
