# Assumptions & Edge Cases

This document lists the ambiguities found in the requirements and the assumption made for each one. It was written before any code. The assumptions are based on calls made to the real Yahoo Finance chart API, not only on reading the spec.

## API observations

These were verified against `query1.finance.yahoo.com/v8/finance/chart` on 2026-10-25.

- **The example curl has no `range` parameter, so it returns only the current day.** With `range=1mo&interval=15m` it returns one month in a single request. For TSLA that was 573 bars over 22 sessions, from 2026-09-24 to 2026-10-23.
- **Each regular session has 26 fifteen-minute bars, 09:30 to 15:45 ET.** Only the most recent session has a 27th bar: a 16:00 closing tick with zero volume, where low, high, open and close are all the same price.
- **Timestamps are UTC epoch seconds.** The exchange timezone is returned separately in `meta.exchangeTimezoneName`, for example `America/New_York`. `meta.gmtoffset` holds only the *current* offset, so it is wrong for bars from before a daylight saving change.
- **Quote values are parallel arrays** (`indicators.quote[0].low[]`, `high[]`, `volume[]`, …) indexed the same way as `timestamp[]`. Any value can be `null`, and the order of keys changes between responses.
- **An unknown symbol returns HTTP 404** with `chart.error = {"code":"Not Found","description":"No data found, symbol may be delisted"}`.
- **Yahoo does not reject every bad parameter.** `range=1m` (one minute, not one month) returns 200 with two bars and `"error": null`. Asking for 1-minute bars over more than 8 days returns HTTP 422 `Unprocessable Entity`.
- **Volume for the most recent bars is unreliable.** The same bar reported 328,327 shares with `range=1d` and 0 with `range=1m`.
- **Summed bar volume does not match `meta.regularMarketVolume`.** On 2026-10-23 the 15-minute bars add up to 48.7M shares, while `meta` reports 34.8M.

## Data semantics

| # | Ambiguity | Assumption |
|---|---|---|
| 1 | What "last month" means | Use Yahoo's `range=1mo` (one calendar month back, about 21–22 trading days). We don't compute our own `period1`/`period2`. |
| 2 | What `lowAverage` and `highAverage` mean | The arithmetic mean of the 15-minute bars' `low` and `high` values for each day. They are **not** the day's lowest low or highest high. |
| 3 | What `volume` means | The sum of all bar volumes for that day, as an integer. It is not reconciled with `meta.regularMarketVolume`, which comes from a different source and does not match. |
| 4 | Precision and rounding | The averages are rounded to 4 decimal places using `MidpointRounding.AwayFromZero`. We use `decimal` instead of `double` so values serialize cleanly (`40.2958`, not `40.295799999`). Trailing zeros are dropped (`382.121`), since they don't change a JSON number. |
| 5 | Day boundaries | Days are calendar dates in the **exchange's timezone**, looked up by IANA name from `meta.exchangeTimezoneName`. We don't use UTC, the server's local time or `gmtoffset`. A one-month window can contain a daylight saving change (e.g. 2026-11-01). |
| 6 | Pre-market and after-hours bars | Excluded. Only the regular session is used, which is Yahoo's default (`includePrePost=false`). |
| 7 | Null values in quote arrays (halts, gaps) | A bar with a null low or high is left out of the averages. A null volume counts as 0. Days with no valid bars are omitted. |
| 8 | Zero-volume bars | **Excluded from the averages**, but still included in the volume sum, where they add 0. The zero-volume 16:00 closing tick appears only on the latest session. Counting it would average that day over 27 bars when every other day uses 26, and would shift its averages by about 0.04 (2026-10-23 `lowAverage`: 371.0123 with the tick, 370.9658 without). |
| 9 | Today's partial session | Included. The required format has no field to mark a day as partial, so the UI notes that the latest day may still be in progress and its volume may still change. |
| 10 | Interval | Fixed at **15 minutes**, as in the example, and read from configuration. The averages depend on bar size: averaging 15-minute lows gives a lower number than averaging 1-minute lows. Changing the interval would therefore change the results. 15-minute data covers 60 days, so one request covers the whole month and the data never has to be fetched in chunks. |
| 11 | Sort order | Ascending by date. |
| 12 | The example's `2009-01-30` date (before TSLA's 2010 IPO) | Treated as an illustration of the format only. |
| 13 | Response envelope | The response is the bare array, exactly as specified. Errors use RFC 7807 `ProblemDetails`. |

## Symbol input

| # | Ambiguity | Assumption |
|---|---|---|
| 14 | Valid symbol format | Input is trimmed and uppercased. Allowed characters are `A–Z 0–9 . - ^ =`, up to 15 characters, so `BRK-B`, `^GSPC`, `EURUSD=X` and `7203.T` work. Anything else gets a 400 before Yahoo is called. The symbol is always URL-encoded. |
| 15 | Non-equity symbols (indices, FX, crypto) | Allowed if Yahoo has data for them. FX often reports a volume of 0, and crypto trades 24/7. Both work with timezone-correct grouping. |
| 16 | Unknown symbol, or one with no data | Yahoo's 404 or `chart.error = "Not Found"` is returned as a 404 from our API, with a clear message. |

## Upstream reliability

Yahoo's chart API is unofficial and undocumented.

| # | Ambiguity | Assumption |
|---|---|---|
| 17 | Upstream failures (429, 5xx, timeout) | These map to 502, 503 or 504 problem responses. A typed `HttpClient` uses a standard resilience handler (timeout, retry with backoff for transient errors, circuit breaker). Details are logged on the server, and raw upstream errors are never sent to the client. |
| 18 | Upstream rejects our request (e.g. 422) | That means **our** request was invalid, not the user's. It is logged as an error and returned as a 502, never as a 4xx. Only "symbol not found" is the client's problem. |
| 19 | Upstream returns 200 but with the wrong data | `meta.range` and `meta.dataGranularity` are checked against what we requested. If they don't match, the response is treated as an upstream failure (502), not used to produce wrong numbers. `range` and `interval` come only from validated configuration, never from free text. |
| 20 | Schema changes, or Yahoo starts requiring cookies or a crumb | Yahoo sits behind an `IMarketDataClient` interface so another provider (Polygon, Alpha Vantage) can replace it. Responses that can't be parsed map to 502. The aggregation logic is pure and doesn't depend on the provider. |
| 21 | Rate limits | Each symbol's result is cached in memory for about 5 minutes, behind a decorator so Redis can replace it later. ASP.NET's built-in rate limiter also protects our own endpoint. |
| 22 | User-Agent | Yahoo requires one. It is sent from configuration. |

## API design and stack

| # | Ambiguity | Assumption |
|---|---|---|
| 23 | Which backend: .NET or Node | **.NET 8**, which meets ".NET 8+". .NET 8 support ends on 2026-11-10. The target framework is set in one place (`Directory.Build.props`), so upgrading to .NET 10 LTS is a one-line change. |
| 24 | Solution structure | One API project in `backend/`, organized into technical folders (`Controllers/`, `Services/`, `Clients/`, `Models/`). One test project sits next to it in `backend.Tests/`. The solution file and shared build settings are at the repo root. This is the simplest layout to navigate for an MVP. Dependencies point inward through interfaces such as `IMarketDataClient`, so the code can be split into separate projects later without changing its design. |
| 25 | Endpoint shape | `GET /api/v1/stocks/{symbol}/intraday/daily-summary`, versioned so the API can grow. Built with controllers. OpenAPI/Swagger and a `/health` endpoint are included. |
| 26 | Frontend framework | React + **JavaScript** + Vite. Local development uses the Vite dev proxy, and CORS is configured for the frontend origin. |
| 27 | Authentication | None, since this is a public read-only MVP. |
| 28 | What "self-hosted" means | It runs locally with `dotnet run` and `npm run dev`. A `docker-compose.yml` is an optional extra. |

## Frontend

| # | Ambiguity | Assumption |
|---|---|---|
| 29 | Table, chart or both | Both. The chart shows the high and low averages as lines and volume as bars. The table formats volume with thousands separators. |
| 30 | Date rendering | Dates such as `"2026-10-01"` are treated as plain text and never passed to `new Date()`. JavaScript parses that format as UTC, so browsers in US timezones would show the previous day. |
| 31 | Error states | Separate messages for invalid input, unknown symbol, service unavailable and network failure. Loading, empty and retry states are also handled. |
| 32 | Shareable state | The symbol goes in the URL (`?symbol=TSLA`), so it survives a refresh and can be linked. |
| 33 | Currency display | Not shown, because the required format has no currency field. Adding one would change the contract. |
| 34 | Symbol search or autocomplete | Out of scope for the MVP. |

## Quality and deliverables

| # | Ambiguity | Assumption |
|---|---|---|
| 35 | Testing | Unit tests cover the aggregation: grouping, rounding, nulls, zero volume, timezone and daylight saving, and an empty series. A **golden-file test** runs a real recorded 1-month TSLA response through parsing and aggregation, and compares the result with expected output produced independently by a separate script. Provider tests use a mocked `HttpMessageHandler`. The API has integration tests (`WebApplicationFactory`) and the frontend has component tests (Vitest + Testing Library). No test calls Yahoo live. |
| 36 | `PROMPT_LOG.md` | Kept up to date throughout development. |
| 37 | Where manual changes are described | In a "Manual changes & reasoning" section of `PROMPT_LOG.md`. |
