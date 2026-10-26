import { formatLongDay, formatPrice, formatVolume } from '../utils/format.js'

/**
 * Every value from the charts in a table, so nothing depends on hovering or reading colors.
 */
function SummaryTable({ symbol, days }) {
  return (
    <div className="table-wrapper">
      <table className="summary-table">
        <caption>Daily summary for {symbol}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col" className="numeric">Low average</th>
            <th scope="col" className="numeric">High average</th>
            <th scope="col" className="numeric">Volume</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.day}>
              <th scope="row">{formatLongDay(day.day)}</th>
              <td className="numeric">{formatPrice(day.lowAverage)}</td>
              <td className="numeric">{formatPrice(day.highAverage)}</td>
              <td className="numeric">{formatVolume(day.volume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default SummaryTable
