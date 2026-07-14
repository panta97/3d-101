declare module 'katex/contrib/auto-render' {
  interface AutoRenderOptions {
    delimiters?: { left: string; right: string; display: boolean }[]
    ignoredTags?: string[]
    ignoredClasses?: string[]
    throwOnError?: boolean
  }
  const renderMathInElement: (element: HTMLElement, options?: AutoRenderOptions) => void
  export default renderMathInElement
}

declare module 'katex/dist/katex.min.css'

declare module '*.css'

/**
 * Monaco (sandbox only). We import the narrow ESM entry points rather than the
 * `monaco-editor` barrel, to avoid pulling in every language it ships with —
 * but its `exports` map is `"./*": "./*"`, which does no extension inference,
 * so tsc won't resolve the extensionless subpaths that the bundler resolves
 * fine. Map them onto the package's real types here.
 */
declare module 'monaco-editor/esm/vs/editor/editor.api' {
  export * from 'monaco-editor'
}

/**
 * As of 0.55 the TS language service is no longer `monaco.languages.typescript`
 * (deprecated); it lives on this contribution module as named exports, whose
 * own .d.ts is empty. Its types do exist on the package root, as the top-level
 * `typescript` namespace — point at them.
 */
declare module 'monaco-editor/esm/vs/language/typescript/monaco.contribution' {
  type TypeScriptNamespace = typeof import('monaco-editor').typescript
  export const javascriptDefaults: TypeScriptNamespace['javascriptDefaults']
  export const typescriptDefaults: TypeScriptNamespace['typescriptDefaults']
  export const ScriptTarget: TypeScriptNamespace['ScriptTarget']
  export const ModuleResolutionKind: TypeScriptNamespace['ModuleResolutionKind']
}

declare module 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'

/** Vite's `?worker` suffix: a constructor for a bundled Web Worker. */
declare module '*?worker' {
  const WorkerConstructor: new () => Worker
  export default WorkerConstructor
}
