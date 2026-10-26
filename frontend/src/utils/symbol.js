// Mirrors the backend's StockSymbol rule so obvious typos get instant feedback.
// The API still validates every request; this is only a convenience.
const SYMBOL_PATTERN = /^[A-Z0-9^][A-Z0-9.=-]{0,14}$/

export const SYMBOL_HINT = "Use 1–15 letters, digits, '.', '-' or '=' (an index may start with '^')."
export const SYMBOL_REQUIRED = 'Enter a stock symbol, for example TSLA.'

export function normalizeSymbol(input) {
  return (input ?? '').trim().toUpperCase()
}

export function isValidSymbol(symbol) {
  return SYMBOL_PATTERN.test(symbol)
}

/**
 * Normalizes user input and checks it. Used by both the form and the ?symbol= URL parameter,
 * so the two paths accept exactly the same symbols.
 */
export function validateSymbolInput(input) {
  const symbol = normalizeSymbol(input)
  if (!symbol) return { symbol, error: SYMBOL_REQUIRED }
  if (!isValidSymbol(symbol)) return { symbol, error: SYMBOL_HINT }
  return { symbol, error: null }
}
