using Microsoft.Extensions.Options;

namespace StockData.Api.Clients.Yahoo;

public static class YahooFinanceServiceCollectionExtensions
{
    /// <summary>
    /// Registers <see cref="YahooFinanceClient"/> as the <see cref="IMarketDataClient"/> through IHttpClientFactory,
    /// configured from the "YahooFinance" section. Invalid configuration fails at startup, not on the first request.
    /// </summary>
    public static IServiceCollection AddYahooFinanceClient(this IServiceCollection services)
    {
        services.AddOptions<YahooFinanceOptions>()
            .BindConfiguration(YahooFinanceOptions.SectionName)
            .ValidateDataAnnotations()
            .Validate(o => o.BaseUrl is null || o.BaseUrl.IsAbsoluteUri, "YahooFinance:BaseUrl must be an absolute URL.")
            .ValidateOnStart();

        services.AddHttpClient<IMarketDataClient, YahooFinanceClient>((serviceProvider, client) =>
        {
            var options = serviceProvider.GetRequiredService<IOptions<YahooFinanceOptions>>().Value;

            client.BaseAddress = WithTrailingSlash(options.BaseUrl!);
            client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
            client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
            // TryAddWithoutValidation: browser User-Agent strings don't always satisfy the strict header parser.
            client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", options.UserAgent);
        });

        return services;
    }

    // Without a trailing slash, relative request paths replace the last segment of the base address.
    private static Uri WithTrailingSlash(Uri baseUrl) =>
        baseUrl.AbsoluteUri.EndsWith('/') ? baseUrl : new Uri(baseUrl.AbsoluteUri + "/");
}
