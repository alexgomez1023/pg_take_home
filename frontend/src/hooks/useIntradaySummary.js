import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getIntradaySummary } from '../services/stockApi.js'

const INITIAL_STATE = { status: 'idle', requestedSymbol: null, data: null, error: null }

/**
 * Loads daily summaries for one symbol at a time.
 * - status: 'idle' | 'loading' | 'success' | 'error'
 * - data: { symbol, days } from the last successful load. It is kept while a new symbol loads,
 *   so the page can dim the old results instead of flashing empty.
 * Starting a new load cancels the one in flight, so a slow earlier response can't overwrite a newer one.
 */
export function useIntradaySummary() {
  const [state, setState] = useState(INITIAL_STATE)
  const controllerRef = useRef(null)

  const load = useCallback(async (symbol) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setState((previous) => ({ ...previous, status: 'loading', requestedSymbol: symbol, error: null }))

    try {
      const days = await getIntradaySummary(symbol, { signal: controller.signal })
      setState({ status: 'success', requestedSymbol: symbol, data: { symbol, days }, error: null })
    } catch (error) {
      if (controller.signal.aborted) return
      setState({
        status: 'error',
        requestedSymbol: symbol,
        data: null,
        error: error instanceof ApiError ? error : new ApiError('unexpected', { cause: error }),
      })
    }
  }, [])

  useEffect(() => () => controllerRef.current?.abort(), [])

  return { ...state, load }
}
