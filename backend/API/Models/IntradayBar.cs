namespace StockData.Api.Models;

/// <summary>
/// One intraday bar. Price and volume are null when the provider has no data for that interval
/// (e.g. a trading halt); consumers decide how to treat the gap.
/// </summary>
public sealed record IntradayBar(DateTimeOffset Timestamp, decimal? Low, decimal? High, long? Volume);
