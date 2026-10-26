import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactVolume, formatVolume } from '../../utils/format.js'
import ChartCard from './ChartCard.jsx'
import ChartTooltip from './ChartTooltip.jsx'
import { CHART_MARGIN, GRID_PROPS, VOLUME_CHART, X_AXIS_PROPS, yAxisProps } from './chartConfig.js'

const [VOLUME] = VOLUME_CHART.series

/**
 * Total volume per day. Kept as its own chart rather than a second y-axis on the price chart,
 * because two scales on one plot suggest correlations that aren't in the data.
 */
function VolumeChart({ days }) {
  return (
    <ChartCard {...VOLUME_CHART}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days} margin={CHART_MARGIN} barCategoryGap="20%">
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...X_AXIS_PROPS} />
          <YAxis {...yAxisProps(formatCompactVolume)} />
          <Tooltip
            content={(props) => <ChartTooltip {...props} formatValue={formatVolume} />}
            cursor={{ fill: 'var(--hover-wash)' }}
          />
          <Bar
            dataKey={VOLUME.dataKey}
            name={VOLUME.name}
            fill={VOLUME.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export default VolumeChart
