/**
 * Frame shared by every chart and by its loading and error fallbacks. The plot area has a fixed height
 * from the chart's config, so swapping a fallback for the real chart never moves the page.
 * A legend is shown only for two or more series; with one series the title already names it.
 */
function ChartCard({ title, plotHeight, series = [], children }) {
  return (
    <figure className="chart-card">
      <figcaption className="chart-card__header">
        <h3>{title}</h3>
        {series.length > 1 && (
          <ul className="chart-legend">
            {series.map((item) => (
              <li key={item.dataKey}>
                <span className="chart-legend__line" style={{ background: item.color }} aria-hidden="true" />
                {item.name}
              </li>
            ))}
          </ul>
        )}
      </figcaption>
      <div className="chart-card__plot" style={{ height: plotHeight }}>
        {children}
      </div>
    </figure>
  )
}

export default ChartCard
