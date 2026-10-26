import { Suspense, lazy, useEffect, useState } from 'react'
import StatusMessage from './components/StatusMessage.jsx'
import SummaryTable from './components/SummaryTable.jsx'
import SymbolForm from './components/SymbolForm.jsx'
import { useIntradaySummary } from './hooks/useIntradaySummary.js'
import { normalizeSymbol } from './utils/symbol.js'
import './App.css'

// The chart library is most of the bundle and is only needed once data arrives, so it loads separately.
const PriceChart = lazy(() => import('./components/PriceChart.jsx'))
const VolumeChart = lazy(() => import('./components/VolumeChart.jsx'))

const ERROR_TITLES = {
  'invalid-symbol': 'Invalid symbol',
  'not-found': 'Symbol not found',
  unavailable: 'Market data unavailable',
  network: 'Server unreachable',
  unexpected: 'Something went wrong',
}

// The symbol lives in the URL (?symbol=TSLA) so a refresh or a shared link shows the same data.
function readSymbolFromUrl() {
  return normalizeSymbol(new URLSearchParams(window.location.search).get('symbol'))
}

function writeSymbolToUrl(symbol) {
  const url = new URL(window.location.href)
  url.searchParams.set('symbol', symbol)
  window.history.replaceState(null, '', url)
}

function App() {
  const [initialSymbol] = useState(readSymbolFromUrl)
  const { status, requestedSymbol, data, error, load } = useIntradaySummary()

  useEffect(() => {
    if (initialSymbol) load(initialSymbol)
  }, [initialSymbol, load])

  const handleSubmit = (symbol) => {
    writeSymbolToUrl(symbol)
    load(symbol)
  }

  const isLoading = status === 'loading'

  return (
    <main className="page">
      <header className="page__header">
        <h1>Stock Intraday Summary</h1>
        <p className="page__subtitle">Daily averages from the last month of 15-minute trading data.</p>
      </header>

      <SymbolForm initialSymbol={initialSymbol} isLoading={isLoading} onSubmit={handleSubmit} />

      {status === 'idle' && (
        <StatusMessage title="Enter a symbol to get started">
          Try TSLA, AAPL, BRK-B or ^GSPC (S&amp;P 500).
        </StatusMessage>
      )}

      {isLoading && !data && <StatusMessage variant="loading" title={`Loading ${requestedSymbol}…`} />}

      {status === 'error' && (
        <StatusMessage
          variant="error"
          title={ERROR_TITLES[error.kind] ?? ERROR_TITLES.unexpected}
          action={
            error.isRetryable && (
              <button type="button" className="button-secondary" onClick={() => load(requestedSymbol)}>
                Try again
              </button>
            )
          }
        >
          {error.message}
        </StatusMessage>
      )}

      {data && status !== 'error' && <Results data={data} isLoading={isLoading} requestedSymbol={requestedSymbol} />}
    </main>
  )
}

function Results({ data, isLoading, requestedSymbol }) {
  const { symbol, days } = data

  return (
    <section className={`results${isLoading ? ' results--stale' : ''}`} aria-busy={isLoading} aria-labelledby="results-title">
      <div className="results__header">
        <h2 id="results-title">{symbol}</h2>
        {isLoading && (
          <p className="results__updating" role="status">
            Loading {requestedSymbol}…
          </p>
        )}
      </div>

      {days.length === 0 ? (
        <StatusMessage variant="empty" title={`No trading data for ${symbol}`}>
          The symbol exists, but it had no trades in the last month.
        </StatusMessage>
      ) : (
        <>
          <div className="charts">
            <Suspense fallback={<div className="chart-placeholder" aria-hidden="true" />}>
              <PriceChart days={days} />
              <VolumeChart days={days} />
            </Suspense>
          </div>
          <SummaryTable symbol={symbol} days={days} />
          <p className="results__note">
            Days are in the exchange&apos;s local time. The latest day may still change while the market is open.
          </p>
        </>
      )}
    </section>
  )
}

export default App
