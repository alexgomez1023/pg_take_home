import { describe, expect, it } from 'vitest'
import {
  formatAxisPrice,
  formatCompactVolume,
  formatLongDay,
  formatPrice,
  formatShortDay,
  formatVolume,
} from './format.js'

describe('format', () => {
  it('formats trading days as calendar dates, without shifting them by the browser time zone', () => {
    // new Date('2026-10-01') would be UTC midnight and render as Sep 30 west of UTC.
    expect(formatLongDay('2026-10-01')).toBe('Thu, Oct 1, 2026')
    expect(formatShortDay('2026-10-01')).toBe('Oct 1')
  })

  it('shows prices with the API precision of four decimals', () => {
    expect(formatPrice(372.2)).toBe('372.2000')
    expect(formatPrice(1234.56789)).toBe('1,234.5679')
  })

  it('keeps axis prices short', () => {
    expect(formatAxisPrice(372.2)).toBe('372.2')
    expect(formatAxisPrice(380)).toBe('380')
  })

  it('groups full volumes and compacts axis volumes', () => {
    expect(formatVolume(48688397)).toBe('48,688,397')
    expect(formatCompactVolume(48688397)).toBe('48.7M')
  })
})
