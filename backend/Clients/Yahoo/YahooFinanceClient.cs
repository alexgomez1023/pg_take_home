using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using StockData.Api.Exceptions;
using StockData.Api.Models;

namespace StockData.Api.Clients.Yahoo;

/// <summary>
/// Typed HttpClient for Yahoo Finance's unofficial v8 chart endpoint.
/// </summary>
public sealed partial class YahooFinanceClient(
    HttpClient httpClient,
    IOptions<YahooFinanceOptions> options,
    ILogger<YahooFinanceClient> logger) : IMarketDataClient
{
    private const string NotFoundErrorCode = "Not Found";

    private readonly YahooFinanceOptions _options = options.Value;

    public async Task<IntradaySeries> GetIntradaySeriesAsync(string symbol, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(symbol);

        using var response = await SendAsync(symbol, cancellationToken);
        var body = await TryReadBodyAsync(response, cancellationToken);

        ThrowIfError(symbol, response.StatusCode, body?.Chart?.Error);

        var result = body?.Chart?.Result?.FirstOrDefault()
            ?? throw new InvalidMarketDataResponseException("Yahoo returned a successful response without chart data.");

        return MapSeries(symbol, result);
    }

    private async Task<HttpResponseMessage> SendAsync(string symbol, CancellationToken cancellationToken)
    {
        var requestUri = new Uri(
            $"v8/finance/chart/{Uri.EscapeDataString(symbol)}?range={_options.Range}&interval={_options.Interval}",
            UriKind.Relative);

        try
        {
            return await httpClient.GetAsync(requestUri, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            LogTransportFailure(logger, symbol, ex);
            throw new MarketDataUnavailableException("Could not reach the market data provider.", ex);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            // HttpClient reports its own timeout as a cancellation the caller did not request.
            LogTransportFailure(logger, symbol, ex);
            throw new MarketDataUnavailableException("The market data provider timed out.", ex);
        }
    }

    private static async Task<YahooChartResponse?> TryReadBodyAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<YahooChartResponse>(cancellationToken);
        }
        catch (JsonException)
        {
            // Non-JSON bodies (e.g. an HTML error page from a proxy) are classified by status code instead.
            return null;
        }
    }

    private void ThrowIfError(string symbol, HttpStatusCode statusCode, YahooChartError? error)
    {
        // Only trust Yahoo's own error code: a bare 404 could also mean a misconfigured BaseUrl.
        if (string.Equals(error?.Code, NotFoundErrorCode, StringComparison.OrdinalIgnoreCase))
        {
            throw new SymbolNotFoundException(symbol);
        }

        if (statusCode == HttpStatusCode.TooManyRequests || (int)statusCode >= 500)
        {
            LogUpstreamError(logger, symbol, (int)statusCode, error?.Code, error?.Description);
            throw new MarketDataUnavailableException($"The market data provider is unavailable (HTTP {(int)statusCode}).");
        }

        if ((int)statusCode is < 200 or > 299 || error is not null)
        {
            // Any other rejection (e.g. 422 for an unsupported range/interval) means our request was wrong.
            LogUpstreamError(logger, symbol, (int)statusCode, error?.Code, error?.Description);
            throw new InvalidMarketDataResponseException($"The market data provider rejected the request (HTTP {(int)statusCode}).");
        }
    }

    private IntradaySeries MapSeries(string requestedSymbol, YahooChartResult result)
    {
        var meta = result.Meta
            ?? throw new InvalidMarketDataResponseException("Yahoo chart data is missing its metadata.");

        EnsureMatchesRequest(requestedSymbol, meta);

        var timeZone = ResolveTimeZone(meta.ExchangeTimezoneName);
        var symbol = string.IsNullOrWhiteSpace(meta.Symbol) ? requestedSymbol : meta.Symbol;
        var timestamps = result.Timestamp ?? [];

        // A known symbol with no trades in the range has no timestamps; that is an empty series, not an error.
        if (timestamps.Count == 0)
        {
            return new IntradaySeries(symbol, timeZone, []);
        }

        var quote = result.Indicators?.Quote?.FirstOrDefault()
            ?? throw new InvalidMarketDataResponseException("Yahoo chart data has timestamps but no quote values.");

        var lows = AlignedOrNull(quote.Low, timestamps.Count, "low");
        var highs = AlignedOrNull(quote.High, timestamps.Count, "high");
        var volumes = AlignedOrNull(quote.Volume, timestamps.Count, "volume");

        var bars = new IntradayBar[timestamps.Count];
        for (var i = 0; i < bars.Length; i++)
        {
            bars[i] = new IntradayBar(
                DateTimeOffset.FromUnixTimeSeconds(timestamps[i]),
                lows?[i],
                highs?[i],
                volumes?[i]);
        }

        return new IntradaySeries(symbol, timeZone, bars);
    }

    /// <summary>
    /// Yahoo answers some invalid parameters with 200 and different data instead of an error,
    /// so the echoed range and interval are checked before the data is used.
    /// </summary>
    private void EnsureMatchesRequest(string symbol, YahooChartMeta meta)
    {
        if (string.Equals(meta.Range, _options.Range, StringComparison.Ordinal)
            && string.Equals(meta.DataGranularity, _options.Interval, StringComparison.Ordinal))
        {
            return;
        }

        LogRequestMismatch(logger, symbol, _options.Range, _options.Interval, meta.Range, meta.DataGranularity);
        throw new InvalidMarketDataResponseException(
            $"Yahoo returned range '{meta.Range}' and interval '{meta.DataGranularity}' " +
            $"instead of the requested '{_options.Range}' and '{_options.Interval}'.");
    }

    private static TimeZoneInfo ResolveTimeZone(string? ianaName)
    {
        if (string.IsNullOrWhiteSpace(ianaName) || !TimeZoneInfo.TryFindSystemTimeZoneById(ianaName, out var timeZone))
        {
            throw new InvalidMarketDataResponseException($"Yahoo returned an unknown exchange time zone '{ianaName}'.");
        }

        return timeZone;
    }

    /// <summary>
    /// A missing array is treated as "no values" (every bar gets null). An array of the wrong length cannot be
    /// matched to timestamps safely, so it is rejected instead of silently shifting values onto the wrong bars.
    /// </summary>
    private static IReadOnlyList<T?>? AlignedOrNull<T>(IReadOnlyList<T?>? values, int expectedCount, string field)
        where T : struct
    {
        if (values is null || values.Count == expectedCount)
        {
            return values;
        }

        throw new InvalidMarketDataResponseException(
            $"Yahoo returned {values.Count} '{field}' values for {expectedCount} timestamps.");
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Could not reach Yahoo Finance for {Symbol}")]
    private static partial void LogTransportFailure(ILogger logger, string symbol, Exception exception);

    [LoggerMessage(Level = LogLevel.Error, Message = "Yahoo Finance returned HTTP {StatusCode} for {Symbol}: {ErrorCode} {ErrorDescription}")]
    private static partial void LogUpstreamError(ILogger logger, string symbol, int statusCode, string? errorCode, string? errorDescription);

    [LoggerMessage(Level = LogLevel.Error, Message = "Yahoo Finance returned range {ActualRange}/{ActualInterval} for {Symbol}, expected {ExpectedRange}/{ExpectedInterval}")]
    private static partial void LogRequestMismatch(ILogger logger, string symbol, string expectedRange, string expectedInterval, string? actualRange, string? actualInterval);
}
