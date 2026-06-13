/**
 * Tiny DOM helpers for widget control bars: sliders with live value readouts,
 * toggles, buttons. Keeps content code declarative and the markup consistent
 * with styles.css.
 */

export interface ControlsBar {
  el: HTMLElement
  slider(opts: {
    label: string
    min: number
    max: number
    step?: number
    value: number
    /** Format the live readout; default 2-decimal fixed. */
    format?: (v: number) => string
    onInput?: (v: number) => void
  }): { get(): number; set(v: number): void }
  toggle(opts: { label: string; value?: boolean; onChange?: (on: boolean) => void }): {
    get(): boolean
    set(on: boolean): void
  }
  button(opts: { label: string; primary?: boolean; onClick: () => void }): HTMLButtonElement
  /** A live mono-font text readout. Returns a setter. */
  readout(initial?: string): (text: string) => void
}

export function controlsBar(container: HTMLElement): ControlsBar {
  const el = document.createElement('div')
  el.className = 'widget-controls'
  container.append(el)

  return {
    el,

    slider({ label, min, max, step = 0.01, value, format = (v) => v.toFixed(2), onInput }) {
      const wrap = document.createElement('label')
      const input = document.createElement('input')
      input.type = 'range'
      input.min = String(min)
      input.max = String(max)
      input.step = String(step)
      input.value = String(value)
      const val = document.createElement('span')
      val.className = 'value'
      val.textContent = format(value)
      wrap.append(`${label} `, input, val)
      el.append(wrap)
      input.addEventListener('input', () => {
        const v = Number(input.value)
        val.textContent = format(v)
        onInput?.(v)
      })
      return {
        get: () => Number(input.value),
        set: (v) => {
          input.value = String(v)
          val.textContent = format(v)
        },
      }
    },

    toggle({ label, value = false, onChange }) {
      const wrap = document.createElement('label')
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.checked = value
      wrap.append(input, ` ${label}`)
      el.append(wrap)
      input.addEventListener('change', () => onChange?.(input.checked))
      return {
        get: () => input.checked,
        set: (on) => {
          input.checked = on
        },
      }
    },

    button({ label, primary, onClick }) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      if (primary) b.classList.add('primary')
      b.addEventListener('click', onClick)
      el.append(b)
      return b
    },

    readout(initial = '') {
      const span = document.createElement('span')
      span.className = 'value'
      span.textContent = initial
      el.append(span)
      return (text) => {
        span.textContent = text
      }
    },
  }
}

/** Overlay text pinned to the widget's top-left corner (multi-line ok). */
export function hud(container: HTMLElement): (text: string) => void {
  const div = document.createElement('div')
  div.className = 'widget-hud'
  container.querySelector('.widget-canvas-wrap')!.append(div)
  return (text) => {
    div.textContent = text
  }
}

/** Footnote row under the controls. */
export function widgetNote(container: HTMLElement, html: string): void {
  const div = document.createElement('div')
  div.className = 'widget-note'
  div.innerHTML = html
  container.append(div)
}
