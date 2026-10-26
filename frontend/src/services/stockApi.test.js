import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getIntradaySummary, parseDailySummaries } from './stockApi.js'

const DAYS = [{ day: '2026-10-23', lowAverage: 370.9658, highAverage: 373.3877, volume: 48688397 }]

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

async function captureError(promise) {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected the promise to reject')
}

// A fetch that only settles when its signal aborts, like a server that never answers.
function hangingFetch(_url, { signal }) {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
  })
}

describe('getIntradaySummary', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns the daily summaries on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(DAYS))

    await expect(getIntradaySummary('TSLA')).resolves.toEqual(DAYS)
  })

  it('URL-encodes the symbol and calls a same-origin path by default', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    await getIntradaySummary('^GSPC')

    expect(fetchMock).toHaveBeenCalledWith('/api/stocks/%5EGSPC/intraday', expect.anything())
  })

  it('prefixes the URL with VITE_API_BASE_URL, ignoring a trailing slash', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/')
    fetchMock.mockResolvedValue(jsonResponse([]))

    await getIntradaySummary('TSLA')

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/stocks/TSLA/intraday', expect.anything())
  })

  it('maps 400 to invalid-symbol using the validation message from the API', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 400, errors: { symbol: ['Symbol must be 1-15 characters.'] } }, 400))

    const error = await captureError(getIntradaySummary('TS LA'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      kind: 'invalid-symbol',
      title: 'Invalid symbol',
      status: 400,
      message: 'Symbol must be 1-15 characters.',
      isRetryable: false,
    })
  })

  it('maps 404 to not-found using the detail from the API', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 404, detail: "No market data was found for symbol 'NOPE'." }, 404))

    const error = await captureError(getIntradaySummary('NOPE'))

    expect(error).toMatchObject({
      kind: 'not-found',
      title: 'Symbol not found',
      message: "No market data was found for symbol 'NOPE'.",
      isRetryable: false,
    })
  })

  it('maps 429 to rate-limited, reads Retry-After, and does not offer an immediate retry', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 429 }, 429, { 'Retry-After': '30' }))

    const error = await captureError(getIntradaySummary('TSLA'))

    expect(error).toMatchObject({ kind: 'rate-limited', title: 'Too many requests', retryAfterSeconds: 30, isRetryable: false })
    expect(error.message).toBe('Too many requests. Please wait 30 seconds and try again.')
  })

  it('reads Retry-After given as an HTTP date', async () => {
    const inTenSeconds = new Date(Date.now() + 10_000).toUTCString()
    fetchMock.mockResolvedValue(jsonResponse({ status: 429 }, 429, { 'Retry-After': inTenSeconds }))

    const error = await captureError(getIntradaySummary('TSLA'))

    expect(error.retryAfterSeconds).toBeGreaterThanOrEqual(9)
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(10)
  })

  it('uses a generic rate-limit message without Retry-After', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 429 }, 429))

    const error = await captureError(getIntradaySummary('TSLA'))

    expect(error).toMatchObject({ kind: 'rate-limited', retryAfterSeconds: undefined })
    expect(error.message).toBe('Too many requests. Please wait a moment and try again.')
  })

  it.each([502, 503, 504])('maps %i to a retryable unavailable error', async (status) => {
    fetchMock.mockResolvedValue(jsonResponse({ status, detail: 'internal upstream detail' }, status))

    const error = await captureError(getIntradaySummary('TSLA'))

    expect(error).toMatchObject({ kind: 'unavailable', status, isRetryable: true })
    expect(error.message).not.toContain('internal upstream detail')
  })

  it('still classifies an error response whose body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 503 }))

    await expect(getIntradaySummary('TSLA')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('maps unmapped statuses to a retryable unexpected error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 500 }, 500))

    await expect(getIntradaySummary('TSLA')).rejects.toMatchObject({
      kind: 'unexpected',
      title: 'Something went wrong',
      status: 500,
      isRetryable: true,
    })
  })

  it('maps a failed fetch to a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(getIntradaySummary('TSLA')).rejects.toMatchObject({ kind: 'network', isRetryable: true })
  })

  it('times out a request that never answers', async () => {
    fetchMock.mockImplementation(hangingFetch)

    await expect(getIntradaySummary('TSLA', { timeoutMs: 10 })).rejects.toMatchObject({
      kind: 'timeout',
      title: 'Request timed out',
      isRetryable: true,
    })
  })

  it('rethrows a caller abort unchanged so it can be ignored', async () => {
    fetchMock.mockImplementation(hangingFetch)
    const controller = new AbortController()

    const pending = getIntradaySummary('TSLA', { signal: controller.signal })
    controller.abort()
    const error = await captureError(pending)

    expect(error.name).toBe('AbortError')
    expect(error).not.toBeInstanceOf(ApiError)
  })

  it('rejects a successful response that is not valid JSON', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }))

    await expect(getIntradaySummary('TSLA')).rejects.toMatchObject({ kind: 'unexpected' })
  })
})

describe('parseDailySummaries', () => {
  it('keeps only the known fields', () => {
    expect(parseDailySummaries([{ ...DAYS[0], extra: 'ignored' }])).toEqual(DAYS)
  })

  it('accepts an empty array', () => {
    expect(parseDailySummaries([])).toEqual([])
  })

  it.each([
    ['not an array', { days: DAYS }],
    ['a null item', [null]],
    ['a missing field', [{ day: '2026-10-23', lowAverage: 1, volume: 1 }]],
    ['a renamed field', [{ date: '2026-10-23', lowAverage: 1, highAverage: 2, volume: 1 }]],
    ['a timestamp instead of a date', [{ ...DAYS[0], day: '2026-10-23T00:00:00' }]],
    ['a price sent as a string', [{ ...DAYS[0], lowAverage: '370.9658' }]],
    ['a fractional volume', [{ ...DAYS[0], volume: 1.5 }]],
    ['a negative volume', [{ ...DAYS[0], volume: -1 }]],
  ])('rejects %s as an unexpected response', (_case, body) => {
    expect(() => parseDailySummaries(body)).toThrow(
      expect.objectContaining({ kind: 'unexpected', message: 'The server returned data in an unexpected format.' }),
    )
  })
})
