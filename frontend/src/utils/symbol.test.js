import { describe, expect, it } from 'vitest'
import { SYMBOL_HINT, SYMBOL_REQUIRED, isValidSymbol, normalizeSymbol, validateSymbolInput } from './symbol.js'

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

describe('validateSymbolInput', () => {
  it('returns the normalized symbol when valid', () => {
    expect(validateSymbolInput(' brk-b ')).toEqual({ symbol: 'BRK-B', error: null })
  })

  it('asks for a symbol when empty', () => {
    expect(validateSymbolInput('   ').error).toBe(SYMBOL_REQUIRED)
  })

  it('explains the format when invalid', () => {
    expect(validateSymbolInput('$TSLA').error).toBe(SYMBOL_HINT)
  })
})
