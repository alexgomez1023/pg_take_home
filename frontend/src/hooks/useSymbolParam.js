import { useCallback, useState } from 'react'
import { normalizeSymbol } from '../utils/symbol.js'

function readSymbolParam() {
  return normalizeSymbol(new URLSearchParams(window.location.search).get('symbol'))
}

/**
 * The symbol lives in the URL (?symbol=TSLA) so a refresh or a shared link shows the same data.
 * Returns the symbol the page was opened with and a setter that updates the URL.
 *
 * The URL is read once and updated with replaceState, so Back/Forward don't change the symbol.
 * If more URL state is added (date ranges, comparisons), switch to a router and make the URL the
 * single source of truth instead of extending this hook.
 */
export function useSymbolParam() {
  const [initialSymbol] = useState(readSymbolParam)

  const setSymbolParam = useCallback((symbol) => {
    const url = new URL(window.location.href)
    url.searchParams.set('symbol', symbol)
    window.history.replaceState(null, '', url)
  }, [])

  return [initialSymbol, setSymbolParam]
}
