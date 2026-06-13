/**
 * Float-tolerant deep comparison — the single predicate every exercise test
 * goes through. Handles numbers, vec objects ({x,y}/{x,y,z}), flat matrix
 * arrays, planes ({n,d}), strings, booleans, null/undefined. NaN and
 * Infinity never compare equal to anything (they're always a bug here).
 */

export const EPS = 1e-6

export function approxDeepEqual(got: unknown, want: unknown, eps: number = EPS): boolean {
  if (typeof want === 'number') {
    if (typeof got !== 'number') return false
    if (!Number.isFinite(got) || !Number.isFinite(want)) return false
    return Math.abs(got - want) <= eps
  }
  if (want === null || want === undefined) return got === want
  if (typeof want === 'string' || typeof want === 'boolean') return got === want
  if (Array.isArray(want)) {
    if (!Array.isArray(got) || got.length !== want.length) return false
    return want.every((w, i) => approxDeepEqual(got[i], w, eps))
  }
  if (typeof want === 'object') {
    if (typeof got !== 'object' || got === null || Array.isArray(got)) return false
    const wantKeys = Object.keys(want as object)
    const gotKeys = Object.keys(got as object)
    if (gotKeys.length !== wantKeys.length) return false
    return wantKeys.every((k) =>
      approxDeepEqual((got as Record<string, unknown>)[k], (want as Record<string, unknown>)[k], eps),
    )
  }
  return false
}

const fmtNum = (n: number): string => {
  if (!Number.isFinite(n)) return String(n)
  const r = Math.round(n)
  if (Math.abs(n - r) < 1e-9) return String(r)
  return String(Number(n.toFixed(5)))
}

/** Compact one-line value display for test feedback. */
export function formatValue(v: unknown): string {
  if (typeof v === 'number') return fmtNum(v)
  if (v === undefined) return 'undefined'
  if (v === null) return 'null'
  if (typeof v === 'string') return `"${v}"`
  if (typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return `[${v.map(formatValue).join(', ')}]`
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
    return `{${entries.map(([k, val]) => `${k}: ${formatValue(val)}`).join(', ')}}`
  }
  if (typeof v === 'function') return '[function]'
  return String(v)
}
