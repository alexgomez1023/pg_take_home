/**
 * Error raised for any failed API call. `kind` tells the UI what happened without it
 * having to know HTTP status codes:
 * - 'invalid-symbol' (400), 'not-found' (404), 'unavailable' (502/503),
 * - 'network' (server unreachable), 'unexpected' (anything else).
 */
export class ApiError extends Error {
  constructor(kind, message, { status, cause } = {}) {
    super(message, { cause })
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }

  get isRetryable() {
    return this.kind === 'unavailable' || this.kind === 'network' || this.kind === 'unexpected'
  }
}

// Empty by default, so requests go to the same origin (the Vite dev proxy forwards /api to the backend).
function apiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
}

/**
 * Fetches daily summaries for a symbol: [{ day, lowAverage, highAverage, volume }], oldest day first.
 * Rejects with an ApiError, or with the original AbortError when `signal` is aborted.
 */
export async function getIntradaySummary(symbol, { signal } = {}) {
  const url = `${apiBaseUrl()}/api/stocks/${encodeURIComponent(symbol)}/intraday`

  let response
  try {
    response = await fetch(url, { signal })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('network', 'Could not reach the server. Check your connection and try again.', {
      cause: error,
    })
  }

  if (!response.ok) {
    throw toApiError(response.status, await readProblemDetails(response))
  }

  const days = await response.json().catch(() => null)
  if (!Array.isArray(days)) {
    throw new ApiError('unexpected', 'The server returned data in an unexpected format.', { status: response.status })
  }
  return days
}

async function readProblemDetails(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function toApiError(status, problem) {
  switch (status) {
    case 400:
      return new ApiError(
        'invalid-symbol',
        problem?.errors?.symbol?.[0] ?? problem?.detail ?? 'That is not a valid stock symbol.',
        { status },
      )
    case 404:
      return new ApiError('not-found', problem?.detail ?? 'No market data was found for that symbol.', { status })
    case 502:
    case 503:
      return new ApiError(
        'unavailable',
        'The market data provider is unavailable right now. Please try again in a moment.',
        { status },
      )
    default:
      return new ApiError('unexpected', 'Something went wrong on the server. Please try again.', { status })
  }
}
