/**
 * Meaning for the playground language: the builtin table, operator semantics
 * over scalars and vectors, and sheet-wide name resolution.
 *
 * Every vector operation here delegates to `@/math` — the same functions the
 * course builds in Modules 1–2, so the playground can never disagree with the
 * exercises about what `reflect` means.
 */

import type { Vec2 } from '@/math'
import { v2 } from '@/math'
import { parse, ParseError, type Expr, type Statement } from './parser'

export type Value = number | Vec2

export const isVec = (value: Value): value is Vec2 => typeof value !== 'number'

export class EvalError extends Error {
  override readonly name = 'EvalError'
}

/* ------------------------------ constants ------------------------------ */

export const CONSTANTS: Readonly<Record<string, Value>> = {
  pi: Math.PI,
  tau: Math.PI * 2,
  e: Math.E,
  i: v2.vec2(1, 0),
  j: v2.vec2(0, 1),
}

/* ------------------------------- builtins ------------------------------ */

interface Builtin {
  min: number
  max: number
  call(args: Value[], name: string): Value
  /** One-line help, shown in the reference panel. */
  help: string
}

const typeName = (value: Value) => (isVec(value) ? 'a vector' : 'a number')

function asNum(args: Value[], i: number, name: string): number {
  const arg = args[i]
  if (isVec(arg)) throw new EvalError(`${name}() wants a number, but argument ${i + 1} is a vector`)
  return arg
}

function asVec(args: Value[], i: number, name: string): Vec2 {
  const arg = args[i]
  if (!isVec(arg)) throw new EvalError(`${name}() wants a vector, but argument ${i + 1} is a number`)
  return arg
}

/** A builtin over plain numbers, e.g. sin, sqrt, atan2. */
const scalarFn = (arity: number, fn: (...n: number[]) => number, help: string): Builtin => ({
  min: arity,
  max: arity,
  help,
  call: (args, name) => fn(...args.map((_, i) => asNum(args, i, name))),
})

/** A builtin over vectors only, e.g. dot, normalize. */
const vecFn = (arity: number, fn: (...v: Vec2[]) => Value, help: string): Builtin => ({
  min: arity,
  max: arity,
  help,
  call: (args, name) => fn(...args.map((_, i) => asVec(args, i, name))),
})

export const BUILTINS: Readonly<Record<string, Builtin>> = {
  v: {
    min: 2,
    max: 2,
    help: 'v(x, y) — build a vector',
    call: (args, name) => v2.vec2(asNum(args, 0, name), asNum(args, 1, name)),
  },

  sin: scalarFn(1, Math.sin, 'sin(t) — radians'),
  cos: scalarFn(1, Math.cos, 'cos(t) — radians'),
  tan: scalarFn(1, Math.tan, 'tan(t) — radians'),
  asin: scalarFn(1, Math.asin, 'asin(x) → radians'),
  acos: scalarFn(1, Math.acos, 'acos(x) → radians'),
  atan: scalarFn(1, Math.atan, 'atan(x) → radians'),
  atan2: scalarFn(2, Math.atan2, 'atan2(y, x) — note the argument order'),
  sqrt: scalarFn(1, Math.sqrt, 'sqrt(x)'),
  abs: scalarFn(1, Math.abs, 'abs(x)'),
  sign: scalarFn(1, Math.sign, 'sign(x) → -1, 0 or 1'),
  floor: scalarFn(1, Math.floor, 'floor(x)'),
  ceil: scalarFn(1, Math.ceil, 'ceil(x)'),
  round: scalarFn(1, Math.round, 'round(x)'),
  exp: scalarFn(1, Math.exp, 'exp(x)'),
  ln: scalarFn(1, Math.log, 'ln(x) — natural log'),
  mod: scalarFn(2, (a, b) => ((a % b) + b) % b, 'mod(a, b) — always non-negative'),
  hypot: scalarFn(2, Math.hypot, 'hypot(x, y)'),
  min: scalarFn(2, Math.min, 'min(a, b)'),
  max: scalarFn(2, Math.max, 'max(a, b)'),
  deg: scalarFn(1, (r) => (r * 180) / Math.PI, 'deg(radians) → degrees'),
  rad: scalarFn(1, (d) => (d * Math.PI) / 180, 'rad(degrees) → radians'),

  x: vecFn(1, (a) => a.x, 'x(a) — the x component'),
  y: vecFn(1, (a) => a.y, 'y(a) — the y component'),
  dot: vecFn(2, v2.dot, 'dot(a, b) → number — how much a points along b'),
  cross: vecFn(2, v2.cross2, 'cross(a, b) → number — signed area; + when b is left of a'),
  length: vecFn(1, v2.length, 'length(a) → number'),
  len: vecFn(1, v2.length, 'len(a) — short for length(a)'),
  lengthSq: vecFn(1, v2.lengthSq, 'lengthSq(a) — length squared, no sqrt'),
  dist: vecFn(2, v2.distance, 'dist(a, b) → number'),
  normalize: vecFn(1, v2.normalize, 'normalize(a) — same direction, length 1'),
  unit: vecFn(1, v2.normalize, 'unit(a) — short for normalize(a)'),
  neg: vecFn(1, v2.neg, 'neg(a) — the opposite vector'),
  perp: vecFn(1, (a) => v2.vec2(-a.y, a.x), 'perp(a) — a turned 90° left'),
  angle: vecFn(2, v2.angleBetween, 'angle(a, b) → radians, always 0…π'),
  heading: vecFn(1, (a) => Math.atan2(a.y, a.x), 'heading(a) → radians from +x'),
  project: vecFn(2, v2.project, 'project(a, b) — the part of a along b'),
  reject: vecFn(2, v2.reject, 'reject(a, b) — the part of a perpendicular to b'),
  reflect: {
    min: 2,
    max: 2,
    help: 'reflect(v, n) — bounce v off a surface with normal n',
    call: (args, name) => v2.reflect(asVec(args, 0, name), v2.normalize(asVec(args, 1, name))),
  },

  rotate: {
    min: 2,
    max: 2,
    help: 'rotate(a, t) — turn a by t radians, counter-clockwise',
    call: (args, name) => {
      const a = asVec(args, 0, name)
      const t = asNum(args, 1, name)
      const c = Math.cos(t)
      const s = Math.sin(t)
      return v2.vec2(a.x * c - a.y * s, a.x * s + a.y * c)
    },
  },

  lerp: {
    min: 3,
    max: 3,
    help: 'lerp(a, b, t) — blend a→b; works on numbers or vectors',
    call: (args, name) => {
      const [a, b] = args
      const t = asNum(args, 2, name)
      if (isVec(a) && isVec(b)) return v2.lerp(a, b, t)
      if (!isVec(a) && !isVec(b)) return a + (b - a) * t
      throw new EvalError('lerp() needs a and b to be the same kind — two numbers or two vectors')
    },
  },
}

/* ------------------------------ operators ------------------------------ */

function binary(op: string, l: Value, r: Value): Value {
  switch (op) {
    case '+':
      if (isVec(l) && isVec(r)) return v2.add(l, r)
      if (!isVec(l) && !isVec(r)) return l + r
      break
    case '-':
      if (isVec(l) && isVec(r)) return v2.sub(l, r)
      if (!isVec(l) && !isVec(r)) return l - r
      break
    case '*':
      if (isVec(l) && !isVec(r)) return v2.scale(l, r)
      if (!isVec(l) && isVec(r)) return v2.scale(r, l)
      if (!isVec(l) && !isVec(r)) return l * r
      throw new EvalError('Two vectors have no "*" — did you mean dot(a, b) or cross(a, b)?')
    case '/':
      if (isVec(l) && !isVec(r)) return v2.scale(l, 1 / r)
      if (!isVec(l) && !isVec(r)) return l / r
      break
    case '^':
      if (!isVec(l) && !isVec(r)) return l ** r
      break
  }
  throw new EvalError(`Can't do ${typeName(l)} ${op} ${typeName(r)}`)
}

/* ------------------------------ evaluation ----------------------------- */

export function evalExpr(expr: Expr, lookup: (name: string) => Value): Value {
  switch (expr.kind) {
    case 'num':
      return expr.value

    case 'ref':
      return lookup(expr.name)

    case 'unary': {
      const operand = evalExpr(expr.operand, lookup)
      return isVec(operand) ? v2.neg(operand) : -operand
    }

    case 'binary':
      return binary(expr.op, evalExpr(expr.left, lookup), evalExpr(expr.right, lookup))

    case 'call': {
      const fn = BUILTINS[expr.name]
      if (!fn) throw new EvalError(`There's no function called "${expr.name}"`)
      if (expr.args.length < fn.min || expr.args.length > fn.max) {
        const wanted = fn.min === fn.max ? fn.min : `${fn.min}–${fn.max}`
        throw new EvalError(
          `${expr.name}() takes ${wanted} argument${fn.min === 1 && fn.max === 1 ? '' : 's'}, ` +
            `but got ${expr.args.length}`,
        )
      }
      return fn.call(
        expr.args.map((a) => evalExpr(a, lookup)),
        expr.name,
      )
    }
  }
}

/* -------------------------------- sheet -------------------------------- */

export interface SheetRow {
  id: string
  source: string
}

export interface RowResult {
  /** The name this row defines, when it parsed as a definition. */
  name: string | null
  value: Value | null
  error: string | null
  /** The parsed statement — the UI reads it to decide on drag handles and sliders. */
  statement: Statement | null
}

/**
 * Evaluate every row against every other. Rows see each other's names
 * regardless of order (like Desmos, unlike a script), so resolution is lazy
 * and a name that depends on itself reports a cycle instead of hanging.
 */
export function evaluateSheet(rows: readonly SheetRow[]): Map<string, RowResult> {
  const results = new Map<string, RowResult>()
  const statements = new Map<string, Statement>()

  for (const row of rows) {
    const result: RowResult = { name: null, value: null, error: null, statement: null }
    results.set(row.id, result)
    if (!row.source.trim()) continue
    try {
      const statement = parse(row.source)
      result.statement = statement
      result.name = statement.name
      statements.set(row.id, statement)
    } catch (err) {
      result.error = err instanceof ParseError ? err.message : String(err)
    }
  }

  // name → the row that defines it. A name defined twice is ambiguous, so
  // every row claiming it fails rather than one silently winning.
  const defs = new Map<string, string>()
  const duplicated = new Set<string>()
  for (const row of rows) {
    const name = results.get(row.id)!.name
    if (name === null) continue
    if (defs.has(name)) duplicated.add(name)
    else defs.set(name, row.id)
  }
  for (const row of rows) {
    const result = results.get(row.id)!
    if (result.name !== null && duplicated.has(result.name)) {
      result.error = `"${result.name}" is defined more than once`
    }
  }

  const done = new Set<string>()
  const visiting = new Set<string>()

  const resolve = (rowId: string): Value => {
    const result = results.get(rowId)!
    if (done.has(rowId)) {
      if (result.error) throw new EvalError(result.error)
      return result.value!
    }
    if (visiting.has(rowId)) throw new EvalError('This definition depends on itself')

    visiting.add(rowId)
    try {
      const statement = statements.get(rowId)
      if (!statement) throw new EvalError(result.error ?? 'Nothing to evaluate')
      if (result.error) throw new EvalError(result.error)
      result.value = evalExpr(statement.expr, lookup)
      return result.value
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      visiting.delete(rowId)
      done.add(rowId)
    }
  }

  const lookup = (name: string): Value => {
    const rowId = defs.get(name)
    // A row's definition shadows a constant, so `e = v(1,2)` is yours to take.
    if (rowId !== undefined) return resolve(rowId)
    const constant = CONSTANTS[name]
    if (constant !== undefined) return constant
    if (duplicated.has(name)) throw new EvalError(`"${name}" is defined more than once`)
    throw new EvalError(`I don't know what "${name}" is`)
  }

  for (const row of rows) {
    if (done.has(row.id) || !statements.has(row.id)) continue
    try {
      resolve(row.id)
    } catch {
      // resolve() already recorded the message on the row that failed.
    }
  }

  return results
}
