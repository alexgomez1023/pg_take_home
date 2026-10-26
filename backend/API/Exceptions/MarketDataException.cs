namespace StockData.Api.Exceptions;

/// <summary>
/// Base type for failures retrieving market data, independent of which provider is used.
/// </summary>
public abstract class MarketDataException : Exception
{
    protected MarketDataException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}
