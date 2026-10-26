/**
 * The single panel used for the idle, loading, empty and error states, so they share layout and styling.
 * `variant` only changes the accent; the title and text always say what happened.
 */
function StatusMessage({ variant = 'info', title, children, action }) {
  const isError = variant === 'error'

  return (
    <div className={`status status--${variant}`} role={isError ? 'alert' : 'status'}>
      {variant === 'loading' && <span className="status__spinner" aria-hidden="true" />}
      <div>
        <p className="status__title">{title}</p>
        {children && <p className="status__body">{children}</p>}
        {action}
      </div>
    </div>
  )
}

export default StatusMessage
