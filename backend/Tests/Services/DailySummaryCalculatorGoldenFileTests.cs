using System.Text.Json;
using StockData.Api.Models;
using StockData.Api.Services;

namespace StockData.Api.Tests.Services;

/// <summary>
/// Runs a recorded Yahoo response (TSLA, 1 month, 15-minute bars) through the calculator and compares the result
/// with output produced independently by a separate Python script. The fixture is parsed here rather than through
/// YahooFinanceClient, so this test checks the aggregation rules only.
/// </summary>
public class DailySummaryCalculatorGoldenFileTests
{
    private const string ResponseFixture = "Fixtures/yahoo-chart-TSLA-1mo-15m.json";
    private const string ExpectedFixture = "Fixtures/expected-daily-summaries-TSLA.json";

    private static readonly JsonSerializerOptions WebJson = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task Summarize_RecordedTslaMonth_MatchesIndependentImplementation()
    {
        var series = await LoadSeriesAsync(ResponseFixture);
        var expected = JsonSerializer.Deserialize<List<DailySummary>>(await File.ReadAllTextAsync(ExpectedFixture), WebJson)!;

        var actual = new DailySummaryCalculator().Summarize(series);

        Assert.Equal(22, expected.Count);
        // DailySummary is a record, so this compares every field of every day. Decimal equality ignores trailing
        // zeros, so the script's 382.121 matches the calculator's 382.1210.
        Assert.Equal(expected, actual);
        Assert.All(actual, day =>
        {
            Assert.Equal(4, day.LowAverage.Scale);
            Assert.Equal(4, day.HighAverage.Scale);
        });
    }

    private static async Task<IntradaySeries> LoadSeriesAsync(string path)
    {
        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(path));
        var result = document.RootElement.GetProperty("chart").GetProperty("result")[0];
        var quote = result.GetProperty("indicators").GetProperty("quote")[0];

        var timestamps = result.GetProperty("timestamp").EnumerateArray().Select(t => t.GetInt64()).ToList();
        var lows = quote.GetProperty("low").EnumerateArray().ToList();
        var highs = quote.GetProperty("high").EnumerateArray().ToList();
        var volumes = quote.GetProperty("volume").EnumerateArray().ToList();

        var bars = timestamps
            .Select((timestamp, i) => new IntradayBar(
                DateTimeOffset.FromUnixTimeSeconds(timestamp),
                NullableDecimal(lows[i]),
                NullableDecimal(highs[i]),
                volumes[i].ValueKind == JsonValueKind.Null ? null : volumes[i].GetInt64()))
            .ToList();

        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(
            result.GetProperty("meta").GetProperty("exchangeTimezoneName").GetString()!);

        return new IntradaySeries("TSLA", timeZone, bars);
    }

    private static decimal? NullableDecimal(JsonElement value) =>
        value.ValueKind == JsonValueKind.Null ? null : value.GetDecimal();
}
