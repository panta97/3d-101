/**
 * CodeMirror wrapper. This module is heavyweight, so ExercisePanel imports it
 * lazily (dynamic import when the exercise scrolls near the viewport) —
 * keeping the per-page JS small until an editor is actually needed.
 */

import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'

export interface Editor {
  get(): string
  set(code: string): void
  focus(): void
}

export function createEditor(
  parent: HTMLElement,
  doc: string,
  hooks: { onRun?: () => void; onChange?: (code: string) => void } = {},
): Editor {
  const view = new EditorView({
    parent,
    doc,
    extensions: [
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            hooks.onRun?.()
            return true
          },
        },
      ]),
      basicSetup,
      javascript(),
      oneDark,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) hooks.onChange?.(u.state.doc.toString())
      }),
    ],
  })

  return {
    get: () => view.state.doc.toString(),
    set: (code) =>
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } }),
    focus: () => view.focus(),
  }
}
