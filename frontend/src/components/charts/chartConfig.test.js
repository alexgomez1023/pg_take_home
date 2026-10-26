import { describe, expect, it } from 'vitest'
import { parseDailySummaries } from '../../services/stockApi.js'
import { PRICE_CHART, VOLUME_CHART, X_AXIS_PROPS } from './chartConfig.js'

// The charts read API fields by name. The App tests mock the charts out, so this is what catches
// a chart pointing at a field the API doesn't return.
describe('chart config', () => {
  const [apiDay] = parseDailySummaries([
    { day: '2026-10-23', lowAverage: 370.9658, highAverage: 373.3877, volume: 48688397 },
  ])

  it.each([...PRICE_CHART.series, ...VOLUME_CHART.series].map((series) => [series.dataKey]))(
    'plots %s, which the API returns',
    (dataKey) => {
      expect(apiDay).toHaveProperty(dataKey)
    },
  )

  it('uses the API day field for the x-axis', () => {
    expect(apiDay).toHaveProperty(X_AXIS_PROPS.dataKey)
  })
})
