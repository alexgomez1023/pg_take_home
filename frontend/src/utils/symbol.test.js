import { describe, expect, it } from 'vitest'
import { isValidSymbol, normalizeSymbol } from './symbol.js'

describe('normalizeSymbol', () => {
  it('trims and uppercases', () => {
    expect(normalizeSymbol('  tsla ')).toBe('TSLA')
  })

  it('treats missing input as empty', () => {
    expect(normalizeSymbol(null)).toBe('')
  })
})

describe('isValidSymbol', () => {
  it.each(['TSLA', 'BRK-B', '7203.T', '^GSPC', 'EURUSD=X', 'GC=F', 'A'])('accepts %s', (symbol) => {
    expect(isValidSymbol(symbol)).toBe(true)
  })

  it.each(['', 'TS LA', '$TSLA', '-TSLA', 'TS^LA', 'ABCDEFGHIJKLMNOP', 'tsla'])('rejects "%s"', (symbol) => {
    expect(isValidSymbol(symbol)).toBe(false)
  })
})
