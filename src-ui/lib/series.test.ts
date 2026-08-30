import { describe, it, expect } from 'vitest'
import { parseSeries, formatSeries } from './series'

describe('parseSeries', () => {
  it('reads a "#N" position', () => {
    expect(parseSeries('Foundation #1')).toEqual({ name: 'Foundation', label: '1', sortKey: 1 })
  })

  it('reads a ", Part N" position', () => {
    expect(parseSeries('The Lord of the Rings, Part 1')).toEqual({
      name: 'The Lord of the Rings',
      label: '1',
      sortKey: 1,
    })
  })

  it('reads a parenthesised position', () => {
    expect(parseSeries('Dune (2)')).toEqual({ name: 'Dune', label: '2', sortKey: 2 })
  })

  it('reads a "vol." position', () => {
    expect(parseSeries('Discworld, vol. 5')).toEqual({ name: 'Discworld', label: '5', sortKey: 5 })
  })

  it('keeps a fractional position for novellas', () => {
    expect(parseSeries('The Expanse #3.5')).toEqual({
      name: 'The Expanse',
      label: '3.5',
      sortKey: 3.5,
    })
  })

  it('sorts an omnibus by the first volume it collects', () => {
    expect(parseSeries('Foundation #1-3')).toEqual({
      name: 'Foundation',
      label: '1-3',
      sortKey: 1,
    })
  })

  it('returns just the name for an unnumbered series', () => {
    expect(parseSeries('Dear America')).toEqual({
      name: 'Dear America',
      label: null,
      sortKey: null,
    })
  })

  it('leaves a trailing number that is part of the name alone', () => {
    expect(parseSeries('Warhammer 40,000')).toEqual({
      name: 'Warhammer 40,000',
      label: null,
      sortKey: null,
    })
  })

  it('is null for blank input', () => {
    expect(parseSeries('   ')).toBeNull()
  })
})

describe('formatSeries', () => {
  it('joins name and label with a "#"', () => {
    expect(formatSeries({ name: 'Foundation', label: '1' })).toBe('Foundation #1')
  })

  it('is just the name when unnumbered', () => {
    expect(formatSeries({ name: 'Dear America', label: null })).toBe('Dear America')
  })
})
