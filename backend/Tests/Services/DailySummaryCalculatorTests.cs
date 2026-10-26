using System.Globalization;
using StockData.Api.Models;
using StockData.Api.Services;

namespace StockData.Api.Tests.Services;

public class DailySummaryCalculatorTests
{
    private static readonly TimeZoneInfo NewYork = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");

    private readonly DailySummaryCalculator _calculator = new();

    [Fact]
    public void Summarize_NullSeries_Throws()
    {
        Assert.Throws<ArgumentNullException>(() => _calculator.Summarize(null!));
    }

    [Fact]
    public void Summarize_NoBars_ReturnsEmpty()
    {
        var result = _calculator.Summarize(Series());

        Assert.Empty(result);
    }

    [Fact]
    public void Summarize_SingleBar_UsesItsValuesWithFourDecimalScale()
    {
        var result = _calculator.Summarize(Series(Bar("2026-10-23T13:30:00Z", 372.22m, 373.5m, 1_000)));

        var day = Assert.Single(result);
        Assert.Equal(new DateOnly(2026, 10, 23), day.Day);
        Assert.Equal("372.2200", day.LowAverage.ToString(CultureInfo.InvariantCulture));
        Assert.Equal("373.5000", day.HighAverage.ToString(CultureInfo.InvariantCulture));
        Assert.Equal(1_000, day.Volume);
    }

    [Fact]
    public void Summarize_SingleBarWithZeroVolume_IsStillAveraged()
    {
        var result = _calculator.Summarize(Series(Bar("2026-10-23T13:30:00Z", 10m, 20m, 0)));

        var day = Assert.Single(result);
        Assert.Equal(10m, day.LowAverage);
        Assert.Equal(20m, day.HighAverage);
        Assert.Equal(0, day.Volume);
    }

    [Fact]
    public void Summarize_MultipleBars_AveragesLowsAndHighsAndSumsVolume()
    {
        var result = _calculator.Summarize(Series(
            Bar("2026-10-23T13:30:00Z", 10m, 30m, 100),
            Bar("2026-10-23T13:45:00Z", 20m, 41m, 200),
            Bar("2026-10-23T14:00:00Z", 31m, 50m, 300)));

        var day = Assert.Single(result);
        Assert.Equal(20.3333m, day.LowAverage);
        Assert.Equal(40.3333m, day.HighAverage);
        Assert.Equal(600, day.Volume);
    }

    [Fact]
    public void Summarize_ZeroVolumeBarAmongTradedBars_IsExcludedFromAveragesButVolumeIsSummed()
    {
        // Mirrors Yahoo's 16:00 closing tick: a zero-volume bar at a different price than the session.
        var result = _calculator.Summarize(Series(
            Bar("2026-10-23T13:30:00Z", 10m, 20m, 100),
            Bar("2026-10-23T19:45:00Z", 30m, 40m, 200),
            Bar("2026-10-23T20:00:00Z", 99m, 99m, 0)));

        var day = Assert.Single(result);
        Assert.Equal(20m, day.LowAverage);
        Assert.Equal(30m, day.HighAverage);
        Assert.Equal(300, day.Volume);
    }

    [Fact]
    public void Summarize_DayWithNoTradedVolume_AveragesAllPricedBars()
    {
        // FX pairs such as EURUSD=X report zero volume for every bar.
        var result = _calculator.Summarize(Series(
            Bar("2026-10-23T13:30:00Z", 1.1m, 1.2m, 0),
            Bar("2026-10-23T13:45:00Z", 1.3m, 1.4m, 0)));

        var day = Assert.Single(result);
        Assert.Equal(1.2m, day.LowAverage);
        Assert.Equal(1.3m, day.HighAverage);
        Assert.Equal(0, day.Volume);
    }

    [Theory]
    // Midpoints round away from zero; banker's rounding would give 1.0000 and -1.0000 for the first two.
    [InlineData("1.00005", "1.0001")]
    [InlineData("-1.00005", "-1.0001")]
    [InlineData("1.00015", "1.0002")]
    [InlineData("1.000049", "1.0000")]
    // Repeating averages: (0 + 0 + 1) / 3 and (0 + 1 + 1) / 3.
    [InlineData("0,0,1", "0.3333")]
    [InlineData("0,1,1", "0.6667")]
    public void Summarize_RoundsAveragesToFourDecimalsAwayFromZero(string lows, string expected)
    {
        var bars = lows.Split(',')
            .Select((low, i) => Bar(
                DateTimeOffset.Parse("2026-10-23T13:30:00Z", CultureInfo.InvariantCulture).AddMinutes(15 * i).ToString("O", CultureInfo.InvariantCulture),
                decimal.Parse(low, CultureInfo.InvariantCulture),
                100m,
                1))
            .ToArray();

        var day = Assert.Single(_calculator.Summarize(Series(bars)));

        Assert.Equal(expected, day.LowAverage.ToString(CultureInfo.InvariantCulture));
    }

    [Theory]
    [InlineData(null, 99.0)]
    [InlineData(99.0, null)]
    public void Summarize_BarMissingLowOrHigh_IsExcludedFromBothAverages(double? low, double? high)
    {
        var result = _calculator.Summarize(Series(
            Bar("2026-10-23T13:30:00Z", 10m, 20m, 100),
            Bar("2026-10-23T13:45:00Z", (decimal?)low, (decimal?)high, 100)));

        var day = Assert.Single(result);
        Assert.Equal(10m, day.LowAverage);
        Assert.Equal(20m, day.HighAverage);
    }

    [Fact]
    public void Summarize_BarMissingPrices_StillCountsTowardVolume()
    {
        var result = _calculator.Summarize(Series(
            Bar("2026-10-23T13:30:00Z", 10m, 20m, 100),
            Bar("2026-10-23T13:45:00Z", null, null, 250)));

        Assert.Equal(350, Assert.Single(result).Volume);
    }

    [Fact]
    public void Summarize_NullVolume_CountsAsZeroAndIsExcludedFromAveragesLikeZeroVolume()
    {
        var result = _calculator.Summarize(Series(
            Bar("2026-10-23T13:30:00Z", 10m, 20m, 100),
            Bar("2026-10-23T13:45:00Z", 50m, 60m, null)));

        var day = Assert.Single(result);
        Assert.Equal(10m, day.LowAverage);
        Assert.Equal(20m, day.HighAverage);
        Assert.Equal(100, day.Volume);
    }

    [Fact]
    public void Summarize_DayWithNoPricedBars_IsOmittedButOtherDaysRemain()
    {
        var result = _calculator.Summarize(Series(
            Bar("2026-10-22T13:30:00Z", null, null, 500),
            Bar("2026-10-23T13:30:00Z", 10m, 20m, 100)));

        Assert.Equal(new DateOnly(2026, 10, 23), Assert.Single(result).Day);
    }

    [Fact]
    public void Summarize_AllValuesNull_ReturnsEmpty()
    {
        var result = _calculator.Summarize(Series(
            Bar("2026-10-23T13:30:00Z", null, null, null),
            Bar("2026-10-23T13:45:00Z", null, null, null)));

        Assert.Empty(result);
    }

    [Theory]
    // New York, daylight time (UTC-4): the exchange date differs from the UTC date late in the evening.
    [InlineData("America/New_York", "2026-10-23T23:30:00Z", "2026-10-23")]
    [InlineData("America/New_York", "2026-10-24T03:59:59Z", "2026-10-23")]
    [InlineData("America/New_York", "2026-10-24T04:00:00Z", "2026-10-24")]
    // New York, after clocks fall back on 2026-11-01 (UTC-5): midnight moves an hour later in UTC.
    [InlineData("America/New_York", "2026-11-02T04:30:00Z", "2026-11-01")]
    [InlineData("America/New_York", "2026-11-02T05:00:00Z", "2026-11-02")]
    // New York, before clocks spring forward on 2026-03-08 (still UTC-5).
    [InlineData("America/New_York", "2026-03-08T04:30:00Z", "2026-03-07")]
    // Tokyo (UTC+9, no daylight saving): the exchange date is ahead of the UTC date.
    [InlineData("Asia/Tokyo", "2026-10-22T14:59:59Z", "2026-10-22")]
    [InlineData("Asia/Tokyo", "2026-10-22T15:00:00Z", "2026-10-23")]
    public void Summarize_AssignsBarsToExchangeLocalDate(string timeZoneId, string utcTimestamp, string expectedDay)
    {
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);

        var result = _calculator.Summarize(Series(timeZone, Bar(utcTimestamp, 10m, 20m, 100)));

        Assert.Equal(DateOnly.ParseExact(expectedDay, "yyyy-MM-dd", CultureInfo.InvariantCulture), Assert.Single(result).Day);
    }

    [Fact]
    public void Summarize_BarsAcrossExchangeMidnight_SplitIntoSeparateDays()
    {
        // 23:45 and 00:00 New York time, which are the same UTC date (2026-10-24).
        var result = _calculator.Summarize(Series(
            Bar("2026-10-24T03:45:00Z", 10m, 20m, 100),
            Bar("2026-10-24T04:00:00Z", 30m, 40m, 200)));

        Assert.Collection(
            result,
            first =>
            {
                Assert.Equal(new DateOnly(2026, 10, 23), first.Day);
                Assert.Equal(100, first.Volume);
            },
            second =>
            {
                Assert.Equal(new DateOnly(2026, 10, 24), second.Day);
                Assert.Equal(200, second.Volume);
            });
    }

    [Fact]
    public void Summarize_UnorderedBars_ReturnsDaysOldestFirst()
    {
        var result = _calculator.Summarize(Series(
            Bar("2026-10-23T13:30:00Z", 1m, 2m, 1),
            Bar("2026-10-21T13:30:00Z", 1m, 2m, 1),
            Bar("2026-10-22T13:30:00Z", 1m, 2m, 1)));

        Assert.Equal(
            [new DateOnly(2026, 10, 21), new DateOnly(2026, 10, 22), new DateOnly(2026, 10, 23)],
            result.Select(day => day.Day));
    }

    private static IntradaySeries Series(params IntradayBar[] bars) => Series(NewYork, bars);

    private static IntradaySeries Series(TimeZoneInfo timeZone, params IntradayBar[] bars) =>
        new("TEST", timeZone, bars);

    private static IntradayBar Bar(string utcTimestamp, decimal? low, decimal? high, long? volume) =>
        new(DateTimeOffset.Parse(utcTimestamp, CultureInfo.InvariantCulture), low, high, volume);
}
