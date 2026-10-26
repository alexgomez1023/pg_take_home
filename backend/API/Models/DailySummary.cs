namespace StockData.Api.Models;

/// <summary>
/// Aggregated intraday data for one trading day, dated in the exchange's time zone.
/// </summary>
public sealed record DailySummary(DateOnly Day, decimal LowAverage, decimal HighAverage, long Volume);
