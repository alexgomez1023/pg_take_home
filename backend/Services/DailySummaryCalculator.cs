using StockData.Api.Models;

namespace StockData.Api.Services;

/// <summary>
/// Pure aggregation of intraday bars into daily summaries. No I/O and no clock, so the same input
/// always produces the same output.
/// </summary>
public sealed class DailySummaryCalculator : IDailySummaryCalculator
{
    private const int Decimals = 4;

    public IReadOnlyList<DailySummary> Summarize(IntradaySeries series)
    {
        ArgumentNullException.ThrowIfNull(series);

        return series.Bars
            .GroupBy(bar => ToExchangeDate(bar.Timestamp, series.ExchangeTimeZone))
            .Select(SummarizeDay)
            .OfType<DailySummary>()
            .OrderBy(summary => summary.Day)
            .ToList();
    }

    /// <summary>
    /// Converts with the exchange's time zone rules rather than a fixed offset, so bars on either side
    /// of a daylight saving change land on the correct date.
    /// </summary>
    private static DateOnly ToExchangeDate(DateTimeOffset timestamp, TimeZoneInfo exchangeTimeZone) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(timestamp, exchangeTimeZone).DateTime);

    private static DailySummary? SummarizeDay(IGrouping<DateOnly, IntradayBar> day)
    {
        // Bars missing a low or high (e.g. a trading halt) can't contribute to either average.
        var pricedBars = day.Where(bar => bar.Low.HasValue && bar.High.HasValue).ToList();
        if (pricedBars.Count == 0)
        {
            return null;
        }

        // Zero-volume bars (such as Yahoo's 16:00 closing tick) contain no trading, so they are left out of the
        // averages. Instruments that never report volume (e.g. FX pairs) would then have no bars at all, so for
        // those days every priced bar is used instead.
        var tradedBars = pricedBars.Where(bar => bar.Volume > 0).ToList();
        var averagedBars = tradedBars.Count > 0 ? tradedBars : pricedBars;

        return new DailySummary(
            day.Key,
            RoundAverage(averagedBars.Average(bar => bar.Low!.Value)),
            RoundAverage(averagedBars.Average(bar => bar.High!.Value)),
            day.Sum(bar => bar.Volume ?? 0));
    }

    // Adding a zero with five decimal places before rounding gives every result a scale of exactly four,
    // so values serialize as e.g. 372.2200 rather than 372.22, matching the required precision.
    private static decimal RoundAverage(decimal value) =>
        decimal.Round(value + 0.00000m, Decimals, MidpointRounding.AwayFromZero);
}
