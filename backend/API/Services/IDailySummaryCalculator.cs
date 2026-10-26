using StockData.Api.Models;

namespace StockData.Api.Services;

public interface IDailySummaryCalculator
{
    /// <summary>
    /// Groups the series' bars into exchange-local trading days, oldest first.
    /// </summary>
    IReadOnlyList<DailySummary> Summarize(IntradaySeries series);
}
