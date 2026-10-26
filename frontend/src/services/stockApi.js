/**
 * Everything the UI needs to know about each kind of failure, in one place.
 * Adding a kind means adding a row here (and a status mapping below if it comes from an HTTP status).
 */
const ERROR_KINDS = {
  'invalid-symbol': {
    title: 'Invalid symbol',
    message: 'That is not a valid stock symbol.',
    retryable: false,
  },
  'not-found': {
    title: 'Symbol not found',
    message: 'No market data was found for that symbol.',
    retryable: false,
  },
  // Not retryable from the UI: an immediate retry is exactly what a rate limit asks clients not to do.
  'rate-limited': {
    title: 'Too many requests',
    message: 'Too many requests. Please wait a moment and try again.',
    retryable: false,
  },
  unavailable: {
    title: 'Market data unavailable',
    message: 'The market data provider is unavailable right now. Please try again in a moment.',
    retryable: true,
  },
  timeout: {
    title: 'Request timed out',
    message: 'The server took too long to respond. Please try again.',
    retryable: true,
  },
  network: {
    title: 'Server unreachable',
    message: 'Could not reach the server. Check your connection and try again.',
    retryable: true,
  },
  unexpected: {
    title: 'Something went wrong',
    message: 'Something went wrong. Please try again.',
    retryable: true,
  },
}

const KIND_BY_STATUS = {
  400: 'invalid-symbol',
  404: 'not-found',
  429: 'rate-limited',
  502: 'unavailable',
  503: 'unavailable',
  504: 'unavailable',
}

export const REQUEST_TIMEOUT_MS = 15_000

/**
 * Error raised for any failed API call. `kind` (a key of ERROR_KINDS) tells the UI what happened
 * without it having to know HTTP status codes; `title` and `isRetryable` come from the same table.
 */
export class ApiError extends Error {
  constructor(kind, { message, status, cause, retryAfterSeconds } = {}) {
    const definition = ERROR_KINDS[kind] ?? ERROR_KINDS.unexpected
    super(message ?? definition.message, { cause })
    this.name = 'ApiError'
    this.kind = ERROR_KINDS[kind] ? kind : 'unexpected'
    this.title = definition.title
    this.isRetryable = definition.retryable
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

// Empty by default, so requests go to the same origin (the Vite dev proxy forwards /api to the backend).
function apiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
}

/**
 * Fetches daily summaries for a symbol: [{ day, lowAverage, highAverage, volume }], oldest day first.
 * Rejects with an ApiError, or with the original AbortError when the caller's `signal` is aborted.
 */
export async function getIntradaySummary(symbol, { signal, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const url = `${apiBaseUrl()}/api/stocks/${encodeURIComponent(symbol)}/intraday`
  const request = withTimeout(signal, timeoutMs)

  try {
    let response
    try {
      response = await fetch(url, { signal: request.signal })
    } catch (error) {
      throw toTransportError(error, request)
    }

    if (!response.ok) {
      throw await toHttpError(response)
    }

    let body
    try {
      body = await response.json()
    } catch (error) {
      if (request.signal.aborted) throw toTransportError(error, request)
      body = null
    }
    return parseDailySummaries(body)
  } finally {
    request.dispose()
  }
}

/**
 * Validates the response body and copies only the known fields, so a backend contract change surfaces
 * here as one clear error instead of NaN values or a crash somewhere in the components.
 */
export function parseDailySummaries(body) {
  if (!Array.isArray(body)) {
    throw invalidResponse('expected an array')
  }

  return body.map((item, index) => {
    const valid =
      item !== null &&
      typeof item === 'object' &&
      typeof item.day === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.day) &&
      Number.isFinite(item.lowAverage) &&
      Number.isFinite(item.highAverage) &&
      Number.isSafeInteger(item.volume) &&
      item.volume >= 0

    if (!valid) {
      throw invalidResponse(`item ${index} does not match { day, lowAverage, highAverage, volume }`)
    }
    return { day: item.day, lowAverage: item.lowAverage, highAverage: item.highAverage, volume: item.volume }
  })
}

function invalidResponse(reason) {
  return new ApiError('unexpected', {
    message: 'The server returned data in an unexpected format.',
    cause: new Error(`Invalid daily summary response: ${reason}`),
  })
}

/**
 * Combines the caller's signal with a timeout, remembering which of the two fired so a timeout
 * can be reported as an error while a caller's cancellation stays a silent AbortError.
 */
function withTimeout(callerSignal, timeoutMs) {
  const controller = new AbortController()
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const forwardAbort = () => controller.abort(callerSignal.reason)

  if (callerSignal?.aborted) forwardAbort()
  else callerSignal?.addEventListener('abort', forwardAbort, { once: true })

  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut
    },
    dispose() {
      clearTimeout(timer)
      callerSignal?.removeEventListener('abort', forwardAbort)
    },
  }
}

function toTransportError(error, request) {
  if (request.timedOut) return new ApiError('timeout', { cause: error })
  if (error?.name === 'AbortError') return error
  return new ApiError('network', { cause: error })
}

async function toHttpError(response) {
  const kind = KIND_BY_STATUS[response.status] ?? 'unexpected'
  const problem = await response.json().catch(() => null)

  if (kind === 'rate-limited') {
    const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'))
    return new ApiError(kind, {
      status: response.status,
      retryAfterSeconds,
      message: retryAfterSeconds
        ? `Too many requests. Please wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'} and try again.`
        : undefined,
    })
  }

  // Only 400 and 404 messages describe the user's input; other server text stays out of the UI.
  const message =
    kind === 'invalid-symbol'
      ? (problem?.errors?.symbol?.[0] ?? problem?.detail)
      : kind === 'not-found'
        ? problem?.detail
        : undefined

  return new ApiError(kind, { status: response.status, message })
}

// Retry-After is either a number of seconds or an HTTP date.
function parseRetryAfter(value) {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds))
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}
