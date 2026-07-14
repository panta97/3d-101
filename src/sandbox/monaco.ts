/**
 * Monaco (the VS Code editor) behind the course's `Editor` interface.
 *
 * Sandbox-only, deliberately. Monaco costs ~1.5–2 MB gzipped once the
 * TypeScript worker is in play, against ~19 kB for the CodeMirror editor the
 * module pages use — and a module page mounts up to seven editors at once.
 * Here there is exactly one, you are debugging rather than filling in a
 * one-liner, and the TS worker buys the thing CodeMirror can't give cheaply:
 * real signature help for the functions the exercise injects into your scope
 * (see libTypes.ts).
 *
 * Imported only from the narrow ESM entry points, not the `monaco-editor`
 * barrel, which drags in every language Monaco ships with.
 */

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
// Importing these names also registers the language — as of 0.55 the TS service
// is here, not on the deprecated `monaco.languages.typescript`.
import {
  javascriptDefaults,
  ScriptTarget,
  ModuleResolutionKind,
} from 'monaco-editor/esm/vs/language/typescript/monaco.contribution'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

import type { Editor } from '@/exercise/editor'
import { libDeclarations } from './libTypes'

export interface MonacoOptions {
  onRun?: () => void
  onChange?: (code: string) => void
  /** Names the exercise injects into scope; they become typed globals. */
  provides?: readonly string[]
}

/**
 * Monaco resolves its workers through this global rather than through the
 * module graph, so Vite's `?worker` imports have to be handed over by hand.
 */
declare global {
  // eslint-disable-next-line no-var
  var MonacoEnvironment: monaco.Environment | undefined
}

let initialized = false

/** One-time global setup: workers, language services, theme. */
function init(): void {
  if (initialized) return
  initialized = true

  self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      // JS goes through the TypeScript service — that's where hovers and
      // completions come from. Everything else gets the plain editor worker.
      return label === 'javascript' || label === 'typescript' ? new TsWorker() : new EditorWorker()
    },
  }

  javascriptDefaults.setCompilerOptions({
    target: ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    // Each editor holds a bare script, not a module: no imports, and the
    // injected functions arrive as ambient globals.
    moduleResolution: ModuleResolutionKind.NodeJs,
    lib: ['es2020'],
  })
  javascriptDefaults.setDiagnosticsOptions({
    // Type-check the learner's JavaScript, but stay quiet about the things
    // that are true here by construction: the code is a fragment, not a
    // module, and its exported functions are called by the runner, not by it.
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: [
      7044, // 'x' implicitly has an 'any' type — learner code is untyped by design
      80004, // JSDoc-types suggestion
    ],
  })

  // One Dark, to match the rest of the site (Monaco ships only vs-dark).
  monaco.editor.defineTheme('3d101', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c678dd' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'string', foreground: '98c379' },
      { token: 'identifier', foreground: 'e06c75' },
      { token: 'delimiter', foreground: 'abb2bf' },
      { token: 'type', foreground: 'e5c07b' },
    ],
    colors: {
      'editor.background': '#21252f',
      'editor.foreground': '#c6cdd9',
      'editorLineNumber.foreground': '#4b5263',
      'editorLineNumber.activeForeground': '#8a93a5',
      'editor.selectionBackground': '#3e4451',
      'editor.lineHighlightBackground': '#2c313a',
      'editorCursor.foreground': '#61afef',
      'editorIndentGuide.background1': '#323845',
    },
  })
}

/** Ambient declarations for the exercise's scope, replaced per exercise. */
let extraLib: monaco.IDisposable | null = null

export function createMonacoEditor(
  parent: HTMLElement,
  doc: string,
  opts: MonacoOptions = {},
): Editor {
  init()

  extraLib?.dispose()
  extraLib = javascriptDefaults.addExtraLib(
    libDeclarations(opts.provides),
    'file:///3d101-scope.d.ts',
  )

  const editor = monaco.editor.create(parent, {
    value: doc,
    language: 'javascript',
    theme: '3d101',
    // The pane is resized by the sandbox's draggable gutters; without this
    // Monaco never reflows and visibly detaches from its container.
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    fontFamily: "'SF Mono', ui-monospace, Menlo, Consolas, monospace",
    lineNumbersMinChars: 3,
    padding: { top: 8, bottom: 8 },
    tabSize: 2,
    renderLineHighlight: 'line',
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
  })

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => opts.onRun?.())
  editor.onDidChangeModelContent(() => opts.onChange?.(editor.getValue()))

  return {
    get: () => editor.getValue(),
    set: (code: string) => editor.setValue(code),
    focus: () => editor.focus(),
  }
}
