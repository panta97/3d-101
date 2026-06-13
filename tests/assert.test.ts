import { describe, expect, it } from 'vitest'
import { approxDeepEqual, formatValue } from '../src/exercise/assert'

describe('approxDeepEqual', () => {
  it('numbers within epsilon', () => {
    expect(approxDeepEqual(0.1 + 0.2, 0.3)).toBe(true)
    expect(approxDeepEqual(1, 1.1)).toBe(false)
    expect(approxDeepEqual(1, 1 + 5e-7)).toBe(true)
  })

  it('NaN and Infinity never pass', () => {
    expect(approxDeepEqual(NaN, NaN)).toBe(false)
    expect(approxDeepEqual(Infinity, Infinity)).toBe(false)
    expect(approxDeepEqual(NaN, 0)).toBe(false)
  })

  it('type mismatches fail', () => {
    expect(approxDeepEqual('1', 1)).toBe(false)
    expect(approxDeepEqual(undefined, 0)).toBe(false)
    expect(approxDeepEqual({ x: 1 }, 1)).toBe(false)
    expect(approxDeepEqual([1], { 0: 1 })).toBe(false)
  })

  it('vec objects', () => {
    expect(approxDeepEqual({ x: 0.30000000000000004, y: 2 }, { x: 0.3, y: 2 })).toBe(true)
    expect(approxDeepEqual({ x: 1, y: 2 }, { x: 1, y: 2, z: 3 })).toBe(false)
    expect(approxDeepEqual({ x: 1, y: 2, z: 0 }, { x: 1, y: 2, z: 3 })).toBe(false)
  })

  it('flat matrix arrays', () => {
    expect(approxDeepEqual([0, 1 - 1e-9, -1, 0], [0, 1, -1, 0])).toBe(true)
    expect(approxDeepEqual([0, 1, -1], [0, 1, -1, 0])).toBe(false)
  })

  it('planes, strings, null', () => {
    expect(approxDeepEqual({ n: { x: 0, y: 1, z: 0 }, d: 2 + 1e-8 }, { n: { x: 0, y: 1, z: 0 }, d: 2 })).toBe(true)
    expect(approxDeepEqual('on', 'on')).toBe(true)
    expect(approxDeepEqual('front', 'on')).toBe(false)
    expect(approxDeepEqual(null, null)).toBe(true)
    expect(approxDeepEqual({ x: 1, y: 2 }, null)).toBe(false)
  })
})

describe('formatValue', () => {
  it('renders compactly', () => {
    expect(formatValue({ x: 1.0000000001, y: -2 })).toBe('{x: 1, y: -2}')
    expect(formatValue([0, 1, -1, 0])).toBe('[0, 1, -1, 0]')
    expect(formatValue(0.7071067811865476)).toBe('0.70711')
    expect(formatValue(undefined)).toBe('undefined')
    expect(formatValue('on')).toBe('"on"')
  })
})
