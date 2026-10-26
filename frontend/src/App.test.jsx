import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { ApiError, getIntradaySummary } from './services/stockApi.js'

vi.mock('./services/stockApi.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getIntradaySummary: vi.fn(),
}))

// Recharts needs real layout to render, which jsdom doesn't provide. The table shows the same values,
// and chartConfig.test.js checks that the charts read fields the API returns.
const charts = vi.hoisted(() => ({ priceChartThrows: false }))
vi.mock('./components/charts/PriceChart.jsx', () => ({
  default: () => {
    if (charts.priceChartThrows) throw new Error('Chart failed to render')
    return <div data-testid="price-chart" />
  },
}))
vi.mock('./components/charts/VolumeChart.jsx', () => ({ default: () => <div data-testid="volume-chart" /> }))

const DAYS = [
  { day: '2026-10-22', lowAverage: 379.0523, highAverage: 382.121, volume: 77371685 },
  { day: '2026-10-23', lowAverage: 370.9658, highAverage: 373.3877, volume: 48688397 },
]

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function searchFor(symbol) {
  const user = userEvent.setup()
  const input = screen.getByLabelText('Stock symbol')
  await user.clear(input)
  await user.type(input, symbol)
  await user.click(screen.getByRole('button', { name: 'Show data' }))
}

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    vi.mocked(getIntradaySummary).mockReset()
    charts.priceChartThrows = false
    vi.restoreAllMocks()
  })

  it('starts with a prompt to enter a symbol', () => {
    render(<App />)

    expect(screen.getByText('Enter a symbol to get started')).toBeInTheDocument()
    expect(getIntradaySummary).not.toHaveBeenCalled()
  })

  it('shows loading, then the charts and a table of every day', async () => {
    const request = deferred()
    vi.mocked(getIntradaySummary).mockReturnValue(request.promise)
    render(<App />)

    await searchFor(' tsla ')

    expect(screen.getByText('Loading TSLA…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled()

    request.resolve(DAYS)

    const table = await screen.findByRole('table', { name: 'Daily summary for TSLA' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[1]).getByRole('rowheader')).toHaveTextContent('Fri, Oct 23, 2026')
    expect(rows[1]).toHaveTextContent('370.9658')
    expect(rows[1]).toHaveTextContent('373.3877')
    expect(rows[1]).toHaveTextContent('48,688,397')
    expect(await screen.findByTestId('price-chart')).toBeInTheDocument()
    expect(screen.getByTestId('volume-chart')).toBeInTheDocument()
    expect(getIntradaySummary).toHaveBeenCalledWith('TSLA', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(window.location.search).toBe('?symbol=TSLA')
  })

  it('rejects an invalid symbol without calling the API', async () => {
    render(<App />)

    await searchFor('TS LA')

    expect(screen.getByRole('alert')).toHaveTextContent("Use 1–15 letters, digits, '.', '-' or '='")
    expect(screen.getByLabelText('Stock symbol')).toHaveAttribute('aria-invalid', 'true')
    expect(getIntradaySummary).not.toHaveBeenCalled()
  })

  it('shows an empty state when the symbol has no trading days', async () => {
    vi.mocked(getIntradaySummary).mockResolvedValue([])
    render(<App />)

    await searchFor('TSLA')

    expect(await screen.findByText('No trading data for TSLA')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows the API message for an unknown symbol, without a retry button', async () => {
    vi.mocked(getIntradaySummary).mockRejectedValue(
      new ApiError('not-found', { message: "No market data was found for symbol 'NOPE'.", status: 404 }),
    )
    render(<App />)

    await searchFor('NOPE')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Symbol not found')
    expect(alert).toHaveTextContent("No market data was found for symbol 'NOPE'.")
    expect(within(alert).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('offers a retry when the provider is unavailable, and recovers', async () => {
    vi.mocked(getIntradaySummary)
      .mockRejectedValueOnce(new ApiError('unavailable', { status: 503 }))
      .mockResolvedValueOnce(DAYS)
    render(<App />)

    await searchFor('TSLA')
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('table', { name: 'Daily summary for TSLA' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getIntradaySummary).toHaveBeenCalledTimes(2)
  })

  it('keeps the previous results visible while a new symbol loads', async () => {
    const second = deferred()
    vi.mocked(getIntradaySummary).mockResolvedValueOnce(DAYS).mockReturnValueOnce(second.promise)
    render(<App />)

    await searchFor('TSLA')
    await screen.findByRole('table', { name: 'Daily summary for TSLA' })
    await searchFor('AAPL')

    expect(screen.getByRole('table', { name: 'Daily summary for TSLA' })).toBeInTheDocument()
    expect(screen.getByText('Loading AAPL…')).toBeInTheDocument()

    second.resolve(DAYS)
    expect(await screen.findByRole('table', { name: 'Daily summary for AAPL' })).toBeInTheDocument()
  })

  it('loads the symbol from the URL on start', async () => {
    window.history.replaceState(null, '', '/?symbol=aapl')
    vi.mocked(getIntradaySummary).mockResolvedValue(DAYS)

    render(<App />)

    expect(await screen.findByRole('table', { name: 'Daily summary for AAPL' })).toBeInTheDocument()
    expect(screen.getByLabelText('Stock symbol')).toHaveValue('AAPL')
  })

  it('shows the wait time for a rate limit, without a retry button', async () => {
    vi.mocked(getIntradaySummary).mockRejectedValue(new ApiError('rate-limited', { status: 429, retryAfterSeconds: 30, message: 'Please wait 30 seconds.' }))
    render(<App />)

    await searchFor('TSLA')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Too many requests')
    expect(alert).toHaveTextContent('Please wait 30 seconds.')
    expect(within(alert).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('keeps the page and the table working when a chart fails to render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    charts.priceChartThrows = true
    vi.mocked(getIntradaySummary).mockResolvedValue(DAYS)
    render(<App />)

    await searchFor('TSLA')

    expect(await screen.findByText(/This chart couldn.t be displayed/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Average price per day' })).toBeInTheDocument()
    expect(screen.getByTestId('volume-chart')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Daily summary for TSLA' })).toBeInTheDocument()
  })

  it('does not call the API for an invalid symbol in the URL, and explains why', async () => {
    window.history.replaceState(null, '', '/?symbol=%24TSLA')

    render(<App />)

    expect(screen.getByLabelText('Stock symbol')).toHaveValue('$TSLA')
    expect(screen.getByRole('alert')).toHaveTextContent("Use 1–15 letters, digits, '.', '-' or '='")
    expect(getIntradaySummary).not.toHaveBeenCalled()
  })
})
