import { Component } from 'react'

/**
 * Shows `fallback` instead of crashing the whole page when something below it throws while rendering,
 * including a lazily loaded chunk that fails to download (e.g. an old tab after a redeploy).
 * Give it a `key` that changes with the data to clear the error when new data arrives.
 */
class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Render error caught by ErrorBoundary', error, info.componentStack)
  }

  render() {
    return this.state.error ? this.props.fallback : this.props.children
  }
}

export default ErrorBoundary
