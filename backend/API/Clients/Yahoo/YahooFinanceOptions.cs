using System.ComponentModel.DataAnnotations;

namespace StockData.Api.Clients.Yahoo;

public sealed class YahooFinanceOptions
{
    public const string SectionName = "YahooFinance";

    [Required]
    public Uri? BaseUrl { get; set; }

    /// <summary>
    /// Yahoo rejects requests without a browser-like User-Agent.
    /// </summary>
    [Required]
    public string UserAgent { get; set; } = string.Empty;

    /// <summary>
    /// Restricted to Yahoo's valid ranges. Yahoo silently accepts invalid values such as "1m" and returns different data.
    /// </summary>
    [Required]
    [RegularExpression("^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$")]
    public string Range { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(1m|2m|5m|15m|30m|60m|90m|1h|1d|5d|1wk|1mo|3mo)$")]
    public string Interval { get; set; } = string.Empty;

    [Range(1, 120)]
    public int TimeoutSeconds { get; set; } = 10;
}
