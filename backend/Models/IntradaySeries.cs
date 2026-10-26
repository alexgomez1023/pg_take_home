namespace StockData.Api.Models;

/// <summary>
/// Intraday bars for one symbol, with the exchange time zone needed to assign each bar to a trading day.
/// </summary>
public sealed record IntradaySeries(string Symbol, TimeZoneInfo ExchangeTimeZone, IReadOnlyList<IntradayBar> Bars);
