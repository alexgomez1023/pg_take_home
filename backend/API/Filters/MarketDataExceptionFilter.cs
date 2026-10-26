using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using StockData.Api.Exceptions;

namespace StockData.Api.Filters;

/// <summary>
/// Translates market data failures into ProblemDetails responses. Runs as an MVC filter rather than global
/// exception middleware because the .NET 8 middleware logs every exception as an unhandled error, which would
/// turn each mistyped symbol into error-level noise. Upstream failures are already logged by the client.
/// </summary>
public sealed class MarketDataExceptionFilter(ProblemDetailsFactory problemDetailsFactory) : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not MarketDataException exception)
        {
            return;
        }

        // Upstream details stay in the server logs; clients only get a stable, non-leaky description.
        var (statusCode, title, detail) = exception switch
        {
            SymbolNotFoundException notFound => (
                StatusCodes.Status404NotFound,
                "Symbol not found",
                $"No market data was found for symbol '{notFound.Symbol}'."),
            MarketDataUnavailableException => (
                StatusCodes.Status503ServiceUnavailable,
                "Market data unavailable",
                "The market data provider is temporarily unavailable. Please try again later."),
            _ => (
                StatusCodes.Status502BadGateway,
                "Invalid response from market data provider",
                "The market data provider returned a response that could not be used."),
        };

        var problem = problemDetailsFactory.CreateProblemDetails(context.HttpContext, statusCode, title, detail: detail);
        context.Result = new ObjectResult(problem) { StatusCode = statusCode };
        context.ExceptionHandled = true;
    }
}
