import { formatLongDay } from '../utils/format.js'

/**
 * Tooltip for both charts. Values are the strong element and series names are secondary,
 * because the reader already knows which series they are looking at and wants the number.
 */
function ChartTooltip({ active, payload, label, formatValue }) {
  if (!active || !payload?.length) return null

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__day">{formatLongDay(label)}</p>
      <ul>
        {payload.map((item) => (
          <li key={item.dataKey}>
            <span className="chart-tooltip__key" style={{ background: item.color }} aria-hidden="true" />
            <strong>{formatValue(item.value)}</strong>
            <span className="chart-tooltip__name">{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ChartTooltip
