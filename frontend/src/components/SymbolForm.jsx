import { useState } from 'react'
import { validateSymbolInput } from '../utils/symbol.js'

function SymbolForm({ initialSymbol = '', isLoading, onSubmit }) {
  const [value, setValue] = useState(initialSymbol)
  // A symbol from the URL is checked up front, so an invalid link shows the same message as typing it.
  const [validationError, setValidationError] = useState(() =>
    initialSymbol ? validateSymbolInput(initialSymbol).error : null,
  )

  const handleSubmit = (event) => {
    event.preventDefault()
    const { symbol, error } = validateSymbolInput(value)

    setValidationError(error)
    if (error) return

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
