import { useEffect } from 'react'
import Results from './components/Results.jsx'
import StatusMessage from './components/StatusMessage.jsx'
import SymbolForm from './components/SymbolForm.jsx'
import { useIntradaySummary } from './hooks/useIntradaySummary.js'
import { useSymbolParam } from './hooks/useSymbolParam.js'
import { isValidSymbol } from './utils/symbol.js'
import './App.css'

function App() {
  const [initialSymbol, setSymbolParam] = useSymbolParam()
  const { status, requestedSymbol, data, error, load } = useIntradaySummary()

  // An invalid ?symbol= is not sent to the API; the form shows the same validation message instead.
  useEffect(() => {
    if (isValidSymbol(initialSymbol)) load(initialSymbol)
  }, [initialSymbol, load])

  const handleSubmit = (symbol) => {
    setSymbolParam(symbol)
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
          title={error.title}
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

export default App
