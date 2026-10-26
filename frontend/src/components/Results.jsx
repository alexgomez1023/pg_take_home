import { lazy } from 'react'
import ChartSlot from './charts/ChartSlot.jsx'
import { PRICE_CHART, VOLUME_CHART } from './charts/chartConfig.js'
import StatusMessage from './StatusMessage.jsx'
import SummaryTable from './SummaryTable.jsx'

// The chart library is most of the bundle and is only needed once data arrives, so it loads separately.
const PriceChart = lazy(() => import('./charts/PriceChart.jsx'))
const VolumeChart = lazy(() => import('./charts/VolumeChart.jsx'))

/**
 * Charts and table for one symbol. While another symbol loads, the previous results stay visible
 * but dimmed, so the page doesn't flash empty.
 */
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
            <ChartSlot config={PRICE_CHART} resetKey={symbol}>
              <PriceChart days={days} />
            </ChartSlot>
            <ChartSlot config={VOLUME_CHART} resetKey={symbol}>
              <VolumeChart days={days} />
            </ChartSlot>
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

export default Results
