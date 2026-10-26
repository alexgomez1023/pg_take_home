import { formatShortDay } from '../../utils/format.js'

// Chart definitions and shared axis styling. This module must not import Recharts: the loading and
// error fallbacks use it to draw a card of the right size before the chart code has loaded.

export const PRICE_CHART = {
  title: 'Average price per day',
  plotHeight: 280,
  series: [
    { dataKey: 'highAverage', name: 'High average', color: 'var(--series-1)' },
    { dataKey: 'lowAverage', name: 'Low average', color: 'var(--series-2)' },
  ],
}

export const VOLUME_CHART = {
  title: 'Total volume per day',
  plotHeight: 200,
  series: [{ dataKey: 'volume', name: 'Volume', color: 'var(--series-3)' }],
}

export const CHART_MARGIN = { top: 8, right: 16, bottom: 0, left: 0 }

export const GRID_PROPS = { vertical: false, stroke: 'var(--grid)' }

const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: 12 }

export const X_AXIS_PROPS = {
  dataKey: 'day',
  tickFormatter: formatShortDay,
  tick: AXIS_TICK,
  tickLine: false,
  axisLine: { stroke: 'var(--baseline)' },
  minTickGap: 24,
}

export function yAxisProps(tickFormatter) {
  return { tickFormatter, tick: AXIS_TICK, tickLine: false, axisLine: false, width: 64 }
}
