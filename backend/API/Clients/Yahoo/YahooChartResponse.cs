namespace StockData.Api.Clients.Yahoo;

// Wire format of GET /v8/finance/chart/{symbol}. Only the fields this app uses are mapped.
// Everything is nullable because Yahoo's API is undocumented and omits fields freely.

internal sealed record YahooChartResponse(YahooChart? Chart);

internal sealed record YahooChart(IReadOnlyList<YahooChartResult>? Result, YahooChartError? Error);

internal sealed record YahooChartError(string? Code, string? Description);

internal sealed record YahooChartResult(YahooChartMeta? Meta, IReadOnlyList<long>? Timestamp, YahooIndicators? Indicators);

internal sealed record YahooChartMeta(string? Symbol, string? ExchangeTimezoneName, string? Range, string? DataGranularity);

internal sealed record YahooIndicators(IReadOnlyList<YahooQuote>? Quote);

internal sealed record YahooQuote(IReadOnlyList<decimal?>? Low, IReadOnlyList<decimal?>? High, IReadOnlyList<long?>? Volume);
