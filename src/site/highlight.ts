/**
 * Static syntax highlighting for prose code blocks (`<pre><code>…</code></pre>`).
 *
 * Reuses the Lezer TypeScript parser that the exercise editor already ships,
 * so the blocks are tokenized by the same grammar CodeMirror uses. Colors come
 * from the site palette in styles.css (`.tok-*`), not from a CodeMirror theme.
 *
 * initPage imports this lazily, and only on pages that contain a code block.
 */

import { typescriptLanguage } from '@codemirror/lang-javascript'
import { highlightCode, tagHighlighter, tags as t } from '@lezer/highlight'

const highlighter = tagHighlighter([
  { tag: [t.keyword, t.modifier, t.moduleKeyword, t.controlKeyword], class: 'tok-keyword' },
  { tag: [t.definition(t.variableName), t.definition(t.propertyName)], class: 'tok-def' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], class: 'tok-fn' },
  { tag: [t.typeName, t.className, t.namespace], class: 'tok-type' },
  { tag: [t.propertyName, t.attributeName], class: 'tok-prop' },
  { tag: [t.number, t.bool, t.null, t.atom], class: 'tok-number' },
  { tag: [t.string, t.special(t.string), t.regexp], class: 'tok-string' },
  { tag: [t.comment], class: 'tok-comment' },
  { tag: [t.operator, t.operatorKeyword], class: 'tok-operator' },
  { tag: [t.punctuation, t.separator, t.bracket], class: 'tok-punct' },
  { tag: [t.self, t.standard(t.variableName)], class: 'tok-builtin' },
])

/** Replace a code block's text with the same text, wrapped in `.tok-*` spans. */
function highlightBlock(code: HTMLElement): void {
  const source = code.textContent ?? ''
  if (!source.trim()) return

  const tree = typescriptLanguage.parser.parse(source)
  const out = document.createDocumentFragment()

  highlightCode(
    source,
    tree,
    highlighter,
    (text, classes) => {
      if (!classes) {
        out.append(text)
        return
      }
      const span = document.createElement('span')
      span.className = classes
      span.textContent = text
      out.append(span)
    },
    () => out.append('\n'),
  )

  code.replaceChildren(out)
}

/**
 * Highlight every prose code block on the page. Inline `<code>` is left alone —
 * only `<pre>`-wrapped blocks are treated as source.
 */
export function highlightCodeBlocks(root: ParentNode = document): void {
  for (const code of root.querySelectorAll<HTMLElement>('.prose pre > code')) {
    highlightBlock(code)
  }
}
