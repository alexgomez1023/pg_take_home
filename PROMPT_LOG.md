# Prompt Log

This is a log of the AI prompts used during this assessment. Each entry includes the prompt, why I sent it, and what I kept, changed, or rejected.

**Tool used:** Claude Code (Claude Opus 5.5) in VS Code

---

## Phase 1: Requirements

### 1. Identify ambiguities

**Prompt:**

> Here are the requirements for a take-home assessment: [pasted requirements]. Before writing any code, list every ambiguity or edge case you see, and propose a reasonable assumption for each.

**Why:** I wanted to settle the requirements before writing code, so the design rests on clear assumptions instead of guesses made mid-implementation.

**Kept / Changed / Rejected:**

- **Kept:** most of the 34 assumptions. Before answering, the AI called the real Yahoo endpoint and based its answers on what came back, not on memory.
- **Check: did it catch that `interval=15m` without `range=1mo` only returns one day?** Yes. It was the first finding, from a live call.
- **Check: did it mention null values in Yahoo's quote arrays?** Yes. Bars with null values are skipped when averaging, and a null volume counts as 0.
- **Check: did it handle the timezone for grouping by day?** Yes. It groups by the exchange's timezone (`meta.exchangeTimezoneName`), not UTC or the server's local time.
- **Changed later:**
  - The zero-volume closing bar was first "kept as returned". After looking at a full month of data (entry 2e), I changed it to "excluded from averages".
  - The AI recommended .NET 10 because .NET 8 support ends in November 2026. I went with .NET 8 as the brief states. The target framework is set in one place, so upgrading is easy.
  - TypeScript became JavaScript for the frontend (see entry 3).
- **Rejected:** nothing outright. I left out currency on purpose so the response matches the required contract exactly.

### 1b. Turn it into a document

**Prompt:**

> Can you make this into an MD file?

**Why:** I wanted the assumptions in the repo where reviewers can read them, not only in chat.

**Kept / Changed / Rejected:** Kept [ASSUMPTIONS.md](ASSUMPTIONS.md). The AI rewrote the chat answer for reviewers: it added a section of verified API facts and removed the open questions meant for me. I've updated the file since then as decisions changed.

---

## Phase 2: Verifying against the real API

### 2. Explain the response structure

**Prompt:**

> Here is a raw response from the Yahoo chart endpoint for TSLA with range=1mo and interval=15m: [pasted JSON]. Explain the structure and which fields I need to produce day, lowAverage, highAverage, and volume.

**Why:** I wanted to check the AI's assumptions against real data instead of trusting its memory of the API.

**Kept / Changed / Rejected:** This took several rounds, because my first pastes didn't come from the request I thought I had made. The AI caught this each time by reading `meta.range` and `meta.dataGranularity`, instead of just explaining whatever I pasted.

**Changed** #8 in ASSUMPTIONS.md to exclude zero-volume bars from averages. **Kept** summing bar volumes as the requirement says, with no reconciliation. **Kept** a golden-file test: the recorded response, plus expected output produced by a separate Python script, so the C# code is checked against a second implementation and not against itself.

**Note:** I ran the curl requests myself to get the real responses, and also tested an invalid symbol to see the error format (HTTP 404 with `chart.error`).

---

## Phase 3: Architecture

### 3. Project structure

**Prompt:**

> Propose a project structure for a .NET 8 Web API and React frontend that will grow beyond this one endpoint. Explain how it follows SOLID principles, and give me two alternative structures with tradeoffs.

**Why:** The requirements say to treat this as an MVP that will grow, so I wanted to choose the structure deliberately and compare options rather than accept the first one.

**Kept / Changed / Rejected:**

- **Options proposed:**
  1. Layered projects (Domain / Application / Infrastructure / Api), which the AI recommended.
  2. Vertical slices in one project.
  3. One project with technical folders.
- **What I chose:** I chose the 3rd option, (One project with technical folders) because its the project structure I'm most comfortable with. There's also less boilerplate code to set up the project, which is nice.
- **What I simplified:**
  - Removed the separate Domain, Application and Infrastructure projects and their test projects. There is now one API project and one test project.
  - Controllers instead of Minimal API route groups, to match the technical-folder layout.
  - No MediatR. The AI pointed out that it's now commercially licensed and not needed for one handler.
- **What I kept from the layered design:**
  - The Yahoo client sits behind an interface (`IMarketDataClient`), so SOLID still holds inside one project and the code can be split into separate projects later.
  - Shared build settings in `Directory.Build.props` (target framework, nullable, warnings as errors).
  - Package versions pinned centrally.
  - The golden-file test.
- **Frontend:** I chose **JavaScript** instead of TypeScript. I am more comfortable with Javascript over Typescript, and for a take-home assessment its the language I want to use. Vite + React 19, Vitest and Testing Library, with a dev proxy to the API.

---

## Phase 4: Implementation

### 4. Yahoo chart client

**Prompt:**

> Write only the typed HttpClient for the Yahoo chart endpoint. Use IHttpClientFactory, read the base URL and User-Agent from configuration, handle null data points, and map Yahoo errors (like an invalid symbol) to domain exceptions. Do not write the controller yet.

**Why:** I wanted to build the backend one layer at a time, starting with the riskiest dependency: an unofficial API that changes without notice. A narrow prompt (client only, no controller) keeps the output small enough to review properly, and lets me check the error handling before anything depends on it.

**Kept / Changed / Rejected:**

- **Kept:**
  - `YahooFinanceClient` behind an `IMarketDataClient` interface, registered with `AddHttpClient`.
  - Options validated when the app starts. Range and interval are limited to values Yahoo actually accepts, which catches mistakes like `range=1m` (Phase 2).
- **Kept (null handling):** missing values become `null` on the bar, and the aggregation decides what to do with them. A missing array means every bar has `null` for that field. Arrays whose length doesn't match the timestamps are rejected, so values can't end up on the wrong bar.
- **Kept (error mapping):** three exceptions with no Yahoo-specific names:
  - `SymbolNotFoundException`
  - `MarketDataUnavailableException` (network, timeout, 429, 5xx)
  - `InvalidMarketDataResponseException` (422, unparseable data, wrong range or interval)

  A 404 counts as "symbol not found" only when Yahoo's own error body says so, because a bare 404 could mean a misconfigured base URL.

- **Kept:** prices are read as `decimal` instead of `double`, so the 4-decimal rounding later works on exact values.
- **Verified:** the AI checked the client with a temporary test file and then deleted it, because the prompt asked for the client only. The file stubbed responses for every error path and also called the real Yahoo API for TSLA and for an invalid symbol. All 14 checks passed.
- **Deferred:**
  - Retry and circuit breaker (ASSUMPTIONS.md #17). The client only has a fixed timeout for now.
  - Permanent tests for the client, which will be a separate prompt.

### 5. Daily aggregation service

**Prompt:**

> Write the logic that groups 15-minute intraday data by day and returns lowAverage, highAverage (rounded to 4 decimals), and total volume. Make it a pure, testable service separate from the HTTP client. Group days using the exchange's timezone offset from the response.

**Why:** This is the core business logic of the task. Keeping it pure (no HTTP, no clock) means it can be tested on its own with hand-built data, and separate from the client.

**Kept / Changed / Rejected:**

- **Changed (timezone):** the AI pushed back on "the exchange's timezone offset". Yahoo's `gmtoffset` is only the _current_ offset, and US clocks change on 2026-11-01, inside a one-month window. It grouped by the timezone _name_ (`exchangeTimezoneName`), which gives the correct offset for each bar. I agreed: that was what I meant, and the offset would have been a real bug.
- **Kept:** `DailySummaryCalculator` behind `IDailySummaryCalculator`. Bars without a low or high are skipped, null volume counts as 0, and zero-volume bars are left out of the averages.
- **Changed (new edge case):** the AI noticed that the zero-volume rule would remove _every_ day for FX pairs (e.g. `EURUSD=X`), which never report volume. It added a fallback: if no bar in a day has volume, all priced bars are averaged. I kept it, and it was added to ASSUMPTIONS.md #8.
- **Changed (precision):** C# rounding doesn't add trailing zeros, so averages could serialize as `372.22` or `382.121`. Averages now always have exactly 4 decimals (`372.2200`) to match the required format. ASSUMPTIONS.md #4 was updated.
- **Verified:** with temporary checks, then deleted. The recorded TSLA month matched the separate Python output on all 22 days.

### 6. Controller endpoint

**Prompt:**

> Write the controller endpoint GET /api/stocks/{symbol}/intraday. Validate the symbol format, return ProblemDetails for errors, and use the correct status codes for invalid input, unknown symbols, and upstream failures.

**Why:** With the client and the aggregation done, the controller only needed to connect them and turn failures into a clear HTTP contract for the frontend.

**Kept / Changed / Rejected:**

- **Changed:** my route replaced the versioned `/api/v1/.../daily-summary` route in ASSUMPTIONS.md #25.
- **Kept (status codes):**
  - 400 for an invalid format (Yahoo is never called)
  - 404 for an unknown symbol
  - 502 when Yahoo rejects our request or returns unusable data
  - 503 when Yahoo is unreachable
  - 500 for anything else

  Every error is ProblemDetails, and Yahoo's details are never included.

- **Kept:** `StockSymbol` trims, uppercases and validates the symbol. `BRK-B`, `^GSPC`, `EURUSD=X` and `7203.T` all pass.
- **Kept (design choice):** errors are mapped by an MVC exception filter rather than global middleware. In .NET 8 the middleware logs every exception as an error, so every mistyped symbol would have created error-level logs.
- **Changed (bug found by checks):** the controller-level `[Produces("application/json")]` attribute was turning 400 responses into `application/json` instead of `application/problem+json`. It was removed, and `application/json` is now declared only on the 200 response.
- **Verified:** with 16 temporary checks, then deleted. They covered every status code, made sure no upstream details leaked, and made live calls for TSLA (22 days) and an unknown symbol (404).

---

## Phase 5: Review & testing

### 7. Strict code review

**Prompt:**

> Review this backend code as a strict senior engineer doing a production code review: @backend/Controllers/StocksController.cs @backend/Filters/MarketDataExceptionFilter.cs, all the models, all the exceptions, and the all the client files. List problems by severity: bugs, security, performance, maintainability.

**Why:** The AI wrote this code, so I asked it to review it from a different point of view, and to check its claims instead of guessing. I wanted the gaps found before they were built on.

**Kept / Changed / Rejected:**

- **Kept (findings):** the AI checked the uncertain claims against the live API and the .NET runtime first. The confirmed problems were:
  - **Unlogged failures:** when Yahoo's JSON schema changes, the client swallows the `JsonException`, returns a 502 and logs nothing.
  - **Config combinations that always fail:** `Interval: "60m"` passes validation, but Yahoo echoes back `"1h"`. `range=max&interval=15m` silently returns monthly bars. Both turn every request into a 502.
  - **Request amplification:** with no caching and no rate limiting, anyone looping on the endpoint can get our IP banned by Yahoo.
  - **Unbounded responses:** response bodies can be up to 2 GB.
  - **Zero tests** for any of the reviewed code.
- **Kept (positives):** the error types, the range/interval check (it caught the `max`/`15m` case) and exact `decimal` parsing were confirmed to work.
- **Deferred:** the fixes themselves. I chose to write the tests first (entries 8–9).

### 8. Aggregation tests

**Prompt:**

> Write xUnit tests for the aggregation service, including null values, a single data point, empty data, and day boundaries in the exchange timezone. Then tell me which cases I am still missing.

**Why:** The review's biggest maintainability finding was that nothing had tests. I started with the aggregation service because it holds the business rules. I also asked what was missing, rather than assuming the cases I listed were enough.

**Kept / Changed / Rejected:**

- **Kept:** 20 tests covering:
  - Empty data and a null series.
  - A single bar, including the 4-decimal format and a zero-volume single bar.
  - Every null-value rule.
  - 8 day-boundary cases: midnight in New York, both daylight-saving changes, and Tokyo, which is ahead of UTC.
- **Verified the tests can fail:** the AI deliberately broke the service twice (grouping by UTC date, and treating missing prices as 0). 5 and 4 tests failed respectively, and the service was then restored.
- **Kept (gap list):** the most important gap it found was that _no test averaged more than one distinct value_, so code that returned the first bar instead of the mean would have passed. Other gaps: the zero-volume rule, the FX fallback, midpoint rounding, and the unused golden file.

### 9. Core requirement tests

**Prompt:**

> Can we test the rest of the core requirements please?

**Why:** To close the gaps from entry 8 that test the task's actual requirements (averaging, rounding, volume rules), and to keep this log up to date.

**Kept / Changed / Rejected:**

- **Kept:** 10 more tests, for 31 in total:
  - A real average over several bars.
  - The zero-volume closing tick.
  - The FX all-zero-volume fallback.
  - Midpoint rounding, including negative values and repeating thirds.
  - A **golden-file test**: the recorded TSLA month compared field by field with the 22 days from the separate Python script.
- **Kept (design choice):** the golden-file test reads the fixture JSON directly instead of going through `YahooFinanceClient`, so only the aggregation rules are tested.
- **Verified the tests can fail:** 5 deliberate bugs, each caught:
  - banker's rounding (2 tests failed)
  - keeping zero-volume bars (3)
  - dropping the FX fallback (2)
  - using the first bar instead of the mean (6)
  - losing the fixed 4-decimal scale (1)
- **Not yet addressed:** duplicate timestamps, sub-cent prices and negative prices still need a decision before they can be tested.

## Manual changes & reasoning

None so far. Every change up to this point was prompted through the AI.
