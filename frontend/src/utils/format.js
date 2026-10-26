const LOCALE = 'en-US'

const priceFormat = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const axisPriceFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })
const volumeFormat = new Intl.NumberFormat(LOCALE)
const compactVolumeFormat = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 })

// Formatting in UTC keeps the calendar date intact (see parseDay).
const shortDayFormat = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric', timeZone: 'UTC' })
const longDayFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * Trading days arrive as "YYYY-MM-DD" already in the exchange's time zone, so they are calendar dates,
 * not instants. `new Date('2026-10-01')` would be UTC midnight and display as Sep 30 in US browsers.
 */
function parseDay(day) {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date))
}

export const formatPrice = (value) => priceFormat.format(value)
export const formatAxisPrice = (value) => axisPriceFormat.format(value)
export const formatVolume = (value) => volumeFormat.format(value)
export const formatCompactVolume = (value) => compactVolumeFormat.format(value)
export const formatShortDay = (day) => shortDayFormat.format(parseDay(day))
export const formatLongDay = (day) => longDayFormat.format(parseDay(day))
