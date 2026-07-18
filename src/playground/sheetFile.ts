/**
 * The playground's save format.
 *
 * Export is deliberately more generous than import needs: alongside each row's
 * source text it writes the row's computed `name`, `value` and `error`, so the
 * file is useful to something that just wants the numbers and can't parse our
 * expression language. Those fields are derived — import recomputes them and
 * ignores whatever the file claimed, so hand-editing `expr` can never leave a
 * file disagreeing with itself.
 *
 * Import is lenient in the other direction: a whole document, a bare array of
 * rows, or a bare array of {x, y} vectors all load. Dumping a vector list out
 * of your own code and plotting it shouldn't require reading this file first.
 */

import type { Vec2 } from '@/math'
import { isVec, type RowResult, type Value } from './evaluate'

export const FORMAT = 'vector-playground'
export const VERSION = 1

export interface ViewState {
  center: Vec2
  unitsHigh: number
}

/** One row as written to disk. `expr` is the only field import needs. */
export interface ExportedRow {
  expr: string
  color?: string
  hidden?: boolean
  /** Derived — written for consumers, ignored on import. */
  name?: string | null
  value?: number | { x: number; y: number } | null
  error?: string
}

export interface SheetFile {
  format: typeof FORMAT
  version: number
  view?: ViewState
  rows: ExportedRow[]
}

/** What import hands back: everything the app needs, nothing it can recompute. */
export interface ImportedRow {
  source: string
  color?: string
  hidden?: boolean
}

export interface ImportedSheet {
  rows: ImportedRow[]
  view?: ViewState
}

export class ImportError extends Error {
  override readonly name = 'ImportError'
}

/* ------------------------------- export -------------------------------- */

const valueJson = (value: Value) => (isVec(value) ? { x: value.x, y: value.y } : value)

export function toFile(
  rows: readonly { id: string; source: string; color: string; hidden: boolean }[],
  results: ReadonlyMap<string, RowResult>,
  view: ViewState,
): SheetFile {
  return {
    format: FORMAT,
    version: VERSION,
    view: { center: { x: view.center.x, y: view.center.y }, unitsHigh: view.unitsHigh },
    // A trailing blank row is a UI affordance, not content — don't ship it.
    rows: rows
      .filter((row) => row.source.trim())
      .map((row) => {
        const result = results.get(row.id)
        const out: ExportedRow = { expr: row.source, color: row.color, hidden: row.hidden }
        if (result?.name) out.name = result.name
        if (result?.value != null) out.value = valueJson(result.value)
        if (result?.error) out.error = result.error
        return out
      }),
  }
}

export const serialize = (file: SheetFile): string => JSON.stringify(file, null, 2)

/* ------------------------------- import -------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Colours reach the DOM as a CSS custom property, so only accept plain hex. */
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v)

function readRow(item: unknown, index: number): ImportedRow {
  const where = `Row ${index + 1}`
  if (typeof item === 'string') return { source: item }
  if (!isObject(item)) throw new ImportError(`${where} isn't an object`)

  const row: ImportedRow = { source: '' }
  if (typeof item.expr === 'string') row.source = item.expr
  else if (typeof item.source === 'string') row.source = item.source
  else if (isFiniteNumber(item.x) && isFiniteNumber(item.y)) row.source = `v(${item.x}, ${item.y})`
  else throw new ImportError(`${where} needs an "expr" string, or "x" and "y" numbers`)

  if (isHex(item.color)) row.color = item.color
  if (typeof item.hidden === 'boolean') row.hidden = item.hidden
  return row
}

function readView(value: unknown): ViewState | undefined {
  if (!isObject(value)) return undefined
  const { center, unitsHigh } = value
  if (!isObject(center) || !isFiniteNumber(center.x) || !isFiniteNumber(center.y)) return undefined
  if (!isFiniteNumber(unitsHigh) || unitsHigh <= 0) return undefined
  return { center: { x: center.x, y: center.y }, unitsHigh }
}

export function parseFile(text: string): ImportedSheet {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError("That file isn't valid JSON")
  }

  if (Array.isArray(data)) return { rows: data.map(readRow) }

  if (isObject(data) && Array.isArray(data.rows)) {
    if (typeof data.format === 'string' && data.format !== FORMAT) {
      throw new ImportError(`That file says it's "${data.format}", not a ${FORMAT} file`)
    }
    return { rows: data.rows.map(readRow), view: readView(data.view) }
  }

  throw new ImportError('I expected a "rows" array, or an array of vectors')
}
