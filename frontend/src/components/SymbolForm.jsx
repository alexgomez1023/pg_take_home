import { useState } from 'react'
import { SYMBOL_HINT, isValidSymbol, normalizeSymbol } from '../utils/symbol.js'

function SymbolForm({ initialSymbol = '', isLoading, onSubmit }) {
  const [value, setValue] = useState(initialSymbol)
  const [validationError, setValidationError] = useState(null)

  const handleSubmit = (event) => {
    event.preventDefault()
    const symbol = normalizeSymbol(value)

    if (!symbol) {
      setValidationError('Enter a stock symbol, for example TSLA.')
      return
    }
    if (!isValidSymbol(symbol)) {
      setValidationError(SYMBOL_HINT)
      return
    }

    setValidationError(null)
    setValue(symbol)
    onSubmit(symbol)
  }

  return (
    <form className="symbol-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor="symbol-input">Stock symbol</label>
      <div className="symbol-form__row">
        <input
          id="symbol-input"
          name="symbol"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="e.g. TSLA"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          maxLength={20}
          aria-invalid={validationError ? 'true' : undefined}
          aria-describedby={validationError ? 'symbol-error' : undefined}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Loading…' : 'Show data'}
        </button>
      </div>
      {validationError && (
        <p id="symbol-error" className="symbol-form__error" role="alert">
          {validationError}
        </p>
      )}
    </form>
  )
}

export default SymbolForm
