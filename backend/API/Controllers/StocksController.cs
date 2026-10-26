using Microsoft.AspNetCore.Mvc;
using StockData.Api.Clients;
using StockData.Api.Models;
using StockData.Api.Services;

namespace StockData.Api.Controllers;

[ApiController]
[Route("api/stocks")]
public sealed class StocksController(
    IMarketDataClient marketDataClient,
    IDailySummaryCalculator dailySummaryCalculator) : ControllerBase
{
    /// <summary>
    /// Daily low/high averages and total volume from the last month of 15-minute intraday data, oldest day first.
    /// </summary>
    /// <param name="symbol">Ticker symbol, e.g. TSLA. Case-insensitive.</param>
    /// <param name="cancellationToken">Cancelled when the client disconnects.</param>
    [HttpGet("{symbol}/intraday")]
    [ProducesResponseType<IReadOnlyList<DailySummary>>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status502BadGateway, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<IReadOnlyList<DailySummary>>> GetIntraday(string symbol, CancellationToken cancellationToken)
    {
        if (!StockSymbol.TryParse(symbol, out var stockSymbol))
        {
            ModelState.AddModelError(nameof(symbol), StockSymbol.FormatDescription);
            return ValidationProblem(ModelState);
        }

        var series = await marketDataClient.GetIntradaySeriesAsync(stockSymbol.Value, cancellationToken);

        return Ok(dailySummaryCalculator.Summarize(series));
    }
}
