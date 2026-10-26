import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getIntradaySummary } from './stockApi.js'

const DAYS = [{ day: '2026-10-23', lowAverage: 370.9658, highAverage: 373.3877, volume: 48688397 }]

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function captureError(promise) {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected the promise to reject')
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

  it('passes the abort signal to fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    const controller = new AbortController()

    await getIntradaySummary('TSLA', { signal: controller.signal })

    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal)
  })

  it('maps 400 to invalid-symbol using the validation message from the API', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 400, errors: { symbol: ['Symbol must be 1-15 characters.'] } }, 400))

    const error = await captureError(getIntradaySummary('TS LA'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: 'invalid-symbol', status: 400, message: 'Symbol must be 1-15 characters.' })
    expect(error.isRetryable).toBe(false)
  })

  it('maps 404 to not-found using the detail from the API', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 404, detail: "No market data was found for symbol 'NOPE'." }, 404))

    const error = await captureError(getIntradaySummary('NOPE'))

    expect(error).toMatchObject({ kind: 'not-found', message: "No market data was found for symbol 'NOPE'." })
    expect(error.isRetryable).toBe(false)
  })

  it.each([502, 503])('maps %i to a retryable unavailable error', async (status) => {
    fetchMock.mockResolvedValue(jsonResponse({ status }, status))

    const error = await captureError(getIntradaySummary('TSLA'))

    expect(error).toMatchObject({ kind: 'unavailable', status })
    expect(error.isRetryable).toBe(true)
  })

  it('still classifies an error response whose body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 503 }))

    await expect(getIntradaySummary('TSLA')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('maps other statuses to a retryable unexpected error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 500 }, 500))

    const error = await captureError(getIntradaySummary('TSLA'))

    expect(error).toMatchObject({ kind: 'unexpected', status: 500 })
    expect(error.isRetryable).toBe(true)
  })

  it('maps a failed fetch to a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(getIntradaySummary('TSLA')).rejects.toMatchObject({ kind: 'network' })
  })

  it('rethrows aborts unchanged so callers can ignore them', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))

    const error = await captureError(getIntradaySummary('TSLA'))

    expect(error.name).toBe('AbortError')
    expect(error).not.toBeInstanceOf(ApiError)
  })

  it('rejects a successful response that is not an array', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ unexpected: true }))

    await expect(getIntradaySummary('TSLA')).rejects.toMatchObject({ kind: 'unexpected' })
  })
})
