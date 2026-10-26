import StatusMessage from './StatusMessage.jsx'

/**
 * Last-resort screen when the app itself fails to render. Reloading also fetches fresh code,
 * which fixes the common case of a tab left open across a redeploy.
 */
function PageErrorFallback() {
  return (
    <main className="page">
      <StatusMessage
        variant="error"
        title="This page stopped working"
        action={
          <button type="button" className="button-secondary" onClick={() => window.location.reload()}>
            Reload page
          </button>
        }
      >
        An unexpected error occurred. Reloading the page usually fixes it.
      </StatusMessage>
    </main>
  )
}

export default PageErrorFallback
