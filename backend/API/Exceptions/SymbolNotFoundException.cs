namespace StockData.Api.Exceptions;

/// <summary>
/// The provider has no data for the requested symbol. This is the caller's problem, not an outage.
/// </summary>
public sealed class SymbolNotFoundException : MarketDataException
{
    public SymbolNotFoundException(string symbol)
        : base($"No market data was found for symbol '{symbol}'.")
    {
        Symbol = symbol;
    }

    public string Symbol { get; }
}
