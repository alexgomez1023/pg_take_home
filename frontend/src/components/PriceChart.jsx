import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatAxisPrice, formatPrice, formatShortDay } from '../utils/format.js'
import ChartTooltip from './ChartTooltip.jsx'

const SERIES = [
  { dataKey: 'highAverage', name: 'High average', color: 'var(--series-1)' },
  { dataKey: 'lowAverage', name: 'Low average', color: 'var(--series-2)' },
]

const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: 12 }

/**
 * Daily high and low averages as two lines on one price axis. The lines sit close together,
 * so they are identified by the legend rather than end labels, which would collide.
 */
function PriceChart({ days }) {
  return (
    <figure className="chart-card">
      <figcaption className="chart-card__header">
        <h3>Average price per day</h3>
        <ul className="chart-legend">
          {SERIES.map((series) => (
            <li key={series.dataKey}>
              <span className="chart-legend__line" style={{ background: series.color }} aria-hidden="true" />
              {series.name}
            </li>
          ))}
        </ul>
      </figcaption>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={days} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="day"
            tickFormatter={formatShortDay}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--baseline)' }}
            minTickGap={24}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={formatAxisPrice}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            content={(props) => <ChartTooltip {...props} formatValue={formatPrice} />}
            cursor={{ stroke: 'var(--baseline)', strokeWidth: 1 }}
          />
          {SERIES.map((series) => (
            <Line
              key={series.dataKey}
              type="linear"
              dataKey={series.dataKey}
              name={series.name}
              stroke={series.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 5, fill: series.color, stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )
}

export default PriceChart
