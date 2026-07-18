import { describe, expect, it } from 'vitest'
import { parse, ParseError } from '../src/playground/parser'
import { CONSTANTS, evaluateSheet, evalExpr, isVec, type Value } from '../src/playground/evaluate'
import { ImportError, parseFile, serialize, toFile } from '../src/playground/sheetFile'

const EPS = 1e-9

/** Evaluate a single expression with no sheet around it — constants only, no rows. */
const run = (src: string): Value =>
  evalExpr(parse(src).expr, (name) => {
    const constant = CONSTANTS[name]
    if (constant === undefined) throw new Error(`unexpected lookup of ${name}`)
    return constant
  })

const num = (src: string): number => {
  const value = run(src)
  if (isVec(value)) throw new Error(`${src} produced a vector`)
  return value
}

const vec = (src: string): { x: number; y: number } => {
  const value = run(src)
  if (!isVec(value)) throw new Error(`${src} produced a number`)
  return value
}

const near = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(EPS)
const near2 = (got: { x: number; y: number }, want: { x: number; y: number }) => {
  near(got.x, want.x)
  near(got.y, want.y)
}

/** Rows keyed r0, r1, … so tests can name the row they expect to fail. */
const sheet = (...sources: string[]) =>
  evaluateSheet(sources.map((source, i) => ({ id: `r${i}`, source })))

describe('parser', () => {
  it('builds vectors with v() and with a bare comma-paren', () => {
    near2(vec('v(3, 2)'), { x: 3, y: 2 })
    near2(vec('(3, 2)'), { x: 3, y: 2 })
  })

  it('nests trig inside v()', () => {
    near2(vec('v(cos(pi/8), sin(pi/8))'), { x: Math.cos(Math.PI / 8), y: Math.sin(Math.PI / 8) })
  })

  it('gives * and / precedence over + and -', () => {
    near(num('1 + 2 * 3'), 7)
    near(num('(1 + 2) * 3'), 9)
    near(num('8 - 4 / 2'), 6)
  })

  it('makes + - * / left associative', () => {
    near(num('10 - 3 - 2'), 5)
    near(num('16 / 4 / 2'), 2)
  })

  it('binds ^ tighter than unary minus, and right associatively', () => {
    near(num('-2^2'), -4)
    near(num('2^3^2'), 512)
    near(num('2^-1'), 0.5)
  })

  it('multiplies a literal touching a name or a paren', () => {
    near(num('2pi'), Math.PI * 2)
    near(num('3(1 + 1)'), 6)
    near(num('2pi/4'), Math.PI / 2)
  })

  it('rejects junk', () => {
    expect(() => parse('v(3, 2) 4')).toThrow(ParseError)
    expect(() => parse('1 +')).toThrow(ParseError)
    expect(() => parse('v(3, 2')).toThrow(ParseError)
    expect(() => parse('3 $ 4')).toThrow(ParseError)
    expect(() => parse('')).toThrow(ParseError)
  })
})

describe('operators', () => {
  it('adds and subtracts like kinds', () => {
    near2(vec('v(1, 2) + v(3, 4)'), { x: 4, y: 6 })
    near2(vec('v(5, 7) - v(2, 3)'), { x: 3, y: 4 })
    near(num('2 + 3'), 5)
  })

  it('scales a vector from either side, and divides by a scalar', () => {
    near2(vec('v(1, 2) * 3'), { x: 3, y: 6 })
    near2(vec('3 * v(1, 2)'), { x: 3, y: 6 })
    near2(vec('v(4, 8) / 2'), { x: 2, y: 4 })
    near2(vec('-v(1, 2)'), { x: -1, y: -2 })
  })

  it('refuses to mix kinds, and points * at dot/cross', () => {
    expect(() => run('v(1, 2) + 3')).toThrow(/vector/)
    expect(() => run('2 / v(1, 2)')).toThrow(/vector/)
    expect(() => run('v(1, 2) * v(3, 4)')).toThrow(/dot|cross/)
  })
})

describe('builtins', () => {
  it('covers the vector operations the course builds', () => {
    near(num('dot(v(1, 2), v(3, 4))'), 11)
    near(num('cross(v(1, 0), v(0, 1))'), 1)
    near(num('length(v(3, 4))'), 5)
    near2(vec('normalize(v(0, 5))'), { x: 0, y: 1 })
    near2(vec('perp(v(1, 0))'), { x: 0, y: 1 })
    near(num('angle(v(1, 0), v(0, 2))'), Math.PI / 2)
    near2(vec('project(v(2, 3), v(1, 0))'), { x: 2, y: 0 })
    near2(vec('reject(v(2, 3), v(1, 0))'), { x: 0, y: 3 })
    near2(vec('lerp(v(0, 0), v(10, 20), 0.5)'), { x: 5, y: 10 })
    near(num('lerp(0, 10, 0.25)'), 2.5)
  })

  it('rotates counter-clockwise', () => {
    near2(vec('rotate(v(1, 0), pi/2)'), { x: 0, y: 1 })
  })

  it('normalizes reflect()s normal, so an un-normalized n still behaves', () => {
    near2(vec('reflect(v(1, -1), v(0, 3))'), { x: 1, y: 1 })
  })

  it('inherits the course NaN guards', () => {
    near2(vec('normalize(v(0, 0))'), { x: 0, y: 0 })
    near2(vec('project(v(1, 2), v(0, 0))'), { x: 0, y: 0 })
  })

  it('reports argument type and count mistakes by name', () => {
    expect(() => run('sin(v(1, 2))')).toThrow(/sin\(\) wants a number/)
    expect(() => run('length(3)')).toThrow(/length\(\) wants a vector/)
    expect(() => run('dot(v(1, 2))')).toThrow(/takes 2 arguments/)
    expect(() => run('nope(1)')).toThrow(/no function called "nope"/)
  })
})

describe('sheet', () => {
  it('resolves names defined in a later row', () => {
    const results = sheet('a + b', 'a = v(1, 2)', 'b = v(3, 4)')
    expect(results.get('r0')!.error).toBeNull()
    near2(results.get('r0')!.value as { x: number; y: number }, { x: 4, y: 6 })
  })

  it('records the defined name on the row', () => {
    expect(sheet('a = v(1, 2)').get('r0')!.name).toBe('a')
    expect(sheet('v(1, 2)').get('r0')!.name).toBeNull()
  })

  it('reports a cycle instead of hanging', () => {
    const results = sheet('a = b + 1', 'b = a + 1')
    expect(results.get('r0')!.error).toMatch(/depends on itself/)
    expect(results.get('r1')!.error).toMatch(/depends on itself/)
  })

  it('reports self-reference', () => {
    expect(sheet('a = a + 1').get('r0')!.error).toMatch(/depends on itself/)
  })

  it('fails every row claiming a duplicated name, rather than picking a winner', () => {
    const results = sheet('a = 1', 'a = 2', 'a + 1')
    expect(results.get('r0')!.error).toMatch(/more than once/)
    expect(results.get('r1')!.error).toMatch(/more than once/)
    expect(results.get('r2')!.error).toMatch(/more than once/)
  })

  it('lets a definition shadow a constant', () => {
    const results = sheet('e = v(1, 2)', 'e')
    near2(results.get('r1')!.value as { x: number; y: number }, { x: 1, y: 2 })
  })

  it('leaves blank rows empty rather than erroring', () => {
    const result = sheet('   ').get('r0')!
    expect(result.error).toBeNull()
    expect(result.value).toBeNull()
  })

  it('names the unknown reference', () => {
    expect(sheet('a + 1').get('r0')!.error).toMatch(/don't know what "a" is/)
  })

  it('keeps a broken row from breaking its neighbours', () => {
    const results = sheet('oops +', 'v(1, 1)')
    expect(results.get('r0')!.error).not.toBeNull()
    expect(results.get('r1')!.error).toBeNull()
  })
})

describe('export / import', () => {
  const VIEW = { center: { x: 1, y: -2 }, unitsHigh: 20 }

  /** Export the given sources exactly as the app would. */
  const exported = (...sources: string[]) => {
    const rows = sources.map((source, i) => ({
      id: `r${i}`,
      source,
      color: '#61afef',
      hidden: false,
    }))
    return toFile(rows, evaluateSheet(rows), VIEW)
  }

  it('writes row text alongside its computed name and value', () => {
    const file = exported('a = v(3, 2)')
    expect(file.format).toBe('vector-playground')
    expect(file.rows).toEqual([
      { expr: 'a = v(3, 2)', color: '#61afef', hidden: false, name: 'a', value: { x: 3, y: 2 } },
    ])
  })

  it('writes scalars as plain numbers and reports errors', () => {
    expect(exported('t = 0.5').rows[0].value).toBe(0.5)
    expect(exported('a * ').rows[0].error).toBeTruthy()
  })

  it('drops the trailing blank row', () => {
    expect(exported('v(1, 2)', '').rows).toHaveLength(1)
  })

  it('round-trips through serialize', () => {
    const file = exported('a = v(3, 2)', 'b = 2a')
    const back = parseFile(serialize(file))
    expect(back.rows.map((r) => r.source)).toEqual(['a = v(3, 2)', 'b = 2a'])
    expect(back.rows[0].color).toBe('#61afef')
    expect(back.view).toEqual(VIEW)
  })

  it('accepts a bare array of vectors, rows or strings', () => {
    expect(parseFile('[{"x": 1, "y": 2}]').rows).toEqual([{ source: 'v(1, 2)' }])
    expect(parseFile('["v(3, 4)"]').rows).toEqual([{ source: 'v(3, 4)' }])
    expect(parseFile('[{"expr": "a + b"}]').rows).toEqual([{ source: 'a + b' }])
    expect(parseFile('[{"source": "a + b"}]').rows).toEqual([{ source: 'a + b' }])
  })

  it('ignores derived fields — the file never overrides what we recompute', () => {
    const back = parseFile('[{"expr": "v(1, 2)", "name": "lies", "value": {"x": 9, "y": 9}}]')
    expect(back.rows).toEqual([{ source: 'v(1, 2)' }])
  })

  it('rejects a colour that is not plain hex, rather than passing it to CSS', () => {
    expect(parseFile('[{"expr": "v(1,2)", "color": "red; background: url(x)"}]').rows[0].color)
      .toBeUndefined()
    expect(parseFile('[{"expr": "v(1,2)", "color": "#98c379"}]').rows[0].color).toBe('#98c379')
  })

  it('drops a nonsense view instead of failing the import', () => {
    expect(parseFile('{"rows": [], "view": {"unitsHigh": -3}}').view).toBeUndefined()
    expect(parseFile('{"rows": [], "view": "nope"}').view).toBeUndefined()
  })

  it('explains what is wrong with a bad file', () => {
    expect(() => parseFile('not json')).toThrow(ImportError)
    expect(() => parseFile('{"rows": []}')).not.toThrow()
    expect(() => parseFile('{"nope": 1}')).toThrow(/expected a "rows" array/)
    expect(() => parseFile('[{"y": 2}]')).toThrow(/Row 1 needs an "expr" string/)
    expect(() => parseFile('[1]')).toThrow(/Row 1 isn't an object/)
    expect(() => parseFile('{"format": "desmos", "rows": []}')).toThrow(/not a vector-playground/)
  })
})
