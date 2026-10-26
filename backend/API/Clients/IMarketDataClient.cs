using StockData.Api.Exceptions;
using StockData.Api.Models;

namespace StockData.Api.Clients;

public interface IMarketDataClient
{
    /// <summary>
    /// Gets the configured range of intraday bars for <paramref name="symbol"/>.
    /// </summary>
    /// <exception cref="SymbolNotFoundException">The provider does not know the symbol.</exception>
    /// <exception cref="MarketDataUnavailableException">The provider is unreachable or temporarily failing.</exception>
    /// <exception cref="InvalidMarketDataResponseException">The provider rejected the request or returned unusable data.</exception>
    Task<IntradaySeries> GetIntradaySeriesAsync(string symbol, CancellationToken cancellationToken);
}
