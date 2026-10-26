import { Suspense } from 'react'
import ErrorBoundary from '../ErrorBoundary.jsx'
import ChartCard from './ChartCard.jsx'

/**
 * Wraps one lazily loaded chart: an empty card of the right size while the chart code downloads,
 * and a message in the same card if the chart fails, so one broken chart never takes the page down.
 */
function ChartSlot({ config, resetKey, children }) {
  return (
    <ErrorBoundary
      key={resetKey}
      fallback={
        <ChartCard {...config}>
          <p className="chart-card__message">This chart couldn&apos;t be displayed. The table below has every value.</p>
        </ChartCard>
      }
    >
      <Suspense fallback={<ChartCard {...config} />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

export default ChartSlot
