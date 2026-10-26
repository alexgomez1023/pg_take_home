namespace StockData.Api.Exceptions;

/// <summary>
/// The provider could not be reached or is temporarily failing (network error, timeout, 429, 5xx).
/// Retrying later may succeed.
/// </summary>
public sealed class MarketDataUnavailableException : MarketDataException
{
    public MarketDataUnavailableException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}
