namespace StockData.Api.Exceptions;

/// <summary>
/// The provider rejected our request or returned data we cannot trust (unparseable body, misaligned arrays,
/// or a range/interval other than the one requested). Indicates a bug or an upstream contract change,
/// so retrying will not help.
/// </summary>
public sealed class InvalidMarketDataResponseException : MarketDataException
{
    public InvalidMarketDataResponseException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}
