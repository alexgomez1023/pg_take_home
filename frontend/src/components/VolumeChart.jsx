import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactVolume, formatShortDay, formatVolume } from '../utils/format.js'
import ChartTooltip from './ChartTooltip.jsx'

const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: 12 }

/**
 * Total volume per day. Kept as its own chart rather than a second y-axis on the price chart,
 * because two scales on one plot suggest correlations that aren't in the data.
 */
function VolumeChart({ days }) {
  return (
    <figure className="chart-card">
      <figcaption className="chart-card__header">
        <h3>Total volume per day</h3>
      </figcaption>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={days} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barCategoryGap="20%">
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
            tickFormatter={formatCompactVolume}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            content={(props) => <ChartTooltip {...props} formatValue={formatVolume} />}
            cursor={{ fill: 'var(--hover-wash)' }}
          />
          <Bar
            dataKey="volume"
            name="Volume"
            fill="var(--series-3)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  )
}

export default VolumeChart
