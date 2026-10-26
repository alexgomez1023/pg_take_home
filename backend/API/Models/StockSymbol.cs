using System.Diagnostics.CodeAnalysis;
using System.Text.RegularExpressions;

namespace StockData.Api.Models;

/// <summary>
/// A ticker symbol that has been trimmed, uppercased and checked against the formats Yahoo uses,
/// e.g. TSLA, BRK-B, 7203.T, ^GSPC (index), EURUSD=X (FX) and GC=F (futures).
/// </summary>
public sealed partial class StockSymbol
{
    public const string FormatDescription =
        "Symbol must be 1-15 characters: letters, digits, '.', '-' or '=', optionally starting with '^'.";

    private StockSymbol(string value) => Value = value;

    public string Value { get; }

    public static bool TryParse(string? input, [NotNullWhen(true)] out StockSymbol? symbol)
    {
        var normalized = input?.Trim().ToUpperInvariant();
        symbol = normalized is not null && SymbolPattern().IsMatch(normalized) ? new StockSymbol(normalized) : null;
        return symbol is not null;
    }

    public override string ToString() => Value;

    [GeneratedRegex("^[A-Z0-9^][A-Z0-9.=-]{0,14}$", RegexOptions.CultureInvariant)]
    private static partial Regex SymbolPattern();
}
