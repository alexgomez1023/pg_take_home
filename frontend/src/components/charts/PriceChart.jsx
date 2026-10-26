import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatAxisPrice, formatPrice } from '../../utils/format.js'
import ChartCard from './ChartCard.jsx'
import ChartTooltip from './ChartTooltip.jsx'
import { CHART_MARGIN, GRID_PROPS, PRICE_CHART, X_AXIS_PROPS, yAxisProps } from './chartConfig.js'

/**
 * Daily high and low averages as two lines on one price axis. The lines sit close together,
 * so they are identified by the legend rather than end labels, which would collide.
 */
function PriceChart({ days }) {
  return (
    <ChartCard {...PRICE_CHART}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={days} margin={CHART_MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...X_AXIS_PROPS} />
          <YAxis {...yAxisProps(formatAxisPrice)} domain={['auto', 'auto']} />
          <Tooltip
            content={(props) => <ChartTooltip {...props} formatValue={formatPrice} />}
            cursor={{ stroke: 'var(--baseline)', strokeWidth: 1 }}
          />
          {PRICE_CHART.series.map((series) => (
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
    </ChartCard>
  )
}

export default PriceChart
