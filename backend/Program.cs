using StockData.Api.Clients.Yahoo;
using StockData.Api.Filters;
using StockData.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers(options => options.Filters.Add<MarketDataExceptionFilter>());
builder.Services.AddYahooFinanceClient();
builder.Services.AddSingleton<IDailySummaryCalculator, DailySummaryCalculator>();
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

// Exposes the implicit Program class to WebApplicationFactory in the integration tests.
public partial class Program { }
