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

---

## Phase 6: Frontend

### 10. Stock summary page

**Prompt:**

> Build a React + Javascript page that lets the user enter a stock symbol, calls my API, and shows the results in a table and a chart. Handle loading, empty, and error states. Keep API calls in a separate service module and read the API URL from an environment variable.

**Why:** The backend was finished and tested, so the next step was the UI the requirements ask for. Keeping API calls in a service module separates fetching from rendering, so the components stay simple and the error handling can be tested on its own.

**Kept / Changed / Rejected:**

- **Kept (structure):**
  - `services/stockApi.js` holds every API call. It reads `VITE_API_BASE_URL` and turns HTTP failures into plain error kinds (`invalid-symbol`, `not-found`, `unavailable`, `network`, `unexpected`), so components never check status codes.
  - A `useIntradaySummary` hook cancels the previous request when a new search starts, so a slow old response can't overwrite a newer one.
  - Components and helpers are in technical folders, matching the backend.
- **Kept (states):**
  - An idle prompt, a loading spinner, and an empty state ("no trading data").
  - Specific error messages. Retryable errors (provider down, network) get a **Try again** button; a 404 doesn't, because retrying won't help.
  - When switching symbols, the old results stay visible but dimmed while the new ones load, so the page doesn't jump.
- **Changed (chart design):** I asked for "a chart". The AI built **two**, price and volume, and explained why: volume is in the tens of millions and prices are in the hundreds, so one chart with two y-axes would suggest a correlation that isn't in the data. It also checked the chart colors with a colorblind-safety tool in light and dark mode instead of picking them by eye. I kept both decisions, and ASSUMPTIONS.md #29 was updated.
- **Kept (details I hadn't asked for):**
  - Dates are shown as calendar dates, avoiding the JavaScript bug where `new Date('2026-10-01')` displays as Sep 30 in US browsers.
  - The symbol is saved in the URL, so a refresh or shared link shows the same data.
  - The chart library loads only when needed, which cut the first page load from 179 kB to 72 kB gzipped.
- **Verified:**
  - 41 frontend tests covering every API error mapping, every page state, symbol rules and date formatting.
  - The AI also ran the real backend and frontend together and screenshotted the page in light mode, dark mode, at 500 px wide, and for an unknown symbol, then checked the layout in those screenshots.
- **Deferred:** CORS on the API. It isn't needed locally because the Vite dev proxy forwards `/api`, but it will be needed if the frontend is served from a different origin (ASSUMPTIONS.md #26).

### 11. Frontend review

**Prompt:**

> Review this React code for accessibility, error handling, and maintainability. What would break first as features are added?

**Why:** As with the backend (entry 7), I wanted the AI-written frontend reviewed critically before building on it. I asked "what breaks first" so the review would focus on real risks rather than a long list of nitpicks.

**Kept / Changed / Rejected:**

- **Kept (findings):** the AI checked Recharts' defaults in `node_modules` and computed color contrast ratios before making claims. Its main findings were:
  - **429 handling:** once the backend adds rate limiting, a 429 would show "Something went wrong" with a **Try again** button, which encourages users to hammer the API.
  - **No protection against a backend response change:** a renamed field would show `NaN`, and a changed date format would crash the whole page, because there was no error boundary.
  - **No error boundary**, so a chart file failing to load after a redeploy would blank the page.
  - **A hard-coded 610px placeholder height** and duplicated setup in the two chart components.
- **Rejected:** reverting my focus/border CSS change. The review flagged that a border in the button's own color makes keyboard focus hard to see on the **Show data** button. I chose to keep my styling.
- **Deferred:** the other accessibility items (moving focus after a load, a screen-reader announcement when data arrives, chart names) and moving to URL-driven state with TanStack Query.

### 12. Error handling and maintainability fixes

**Prompt:**

> Lets deal with the error handling and maintanbility. I want to leave the input/button border css changes please

**Why:** I wanted the findings from entry 11 that could actually break the app fixed, without the AI touching the styling I'd chosen.

**Kept / Changed / Rejected:**

- **Kept (error handling):**
  - One table in `stockApi.js` holds every error kind's title, message and retry rule.
  - New handling for 429 (shows the `Retry-After` wait, no retry button), 504, and a 15-second request timeout.
  - `parseDailySummaries` validates every item in the response.
  - Error boundaries around each chart and around the whole app.
  - An invalid `?symbol=` in the URL gets the same check as the form.
- **Kept (maintainability):**
  - `chartConfig.js` holds each chart's title, height and series, so the loading and error fallbacks match the chart's size exactly. The 610px value is gone.
  - A shared `ChartCard` component.
  - The chart files moved to `components/charts/` with `git mv`.
  - `Results` and `useSymbolParam` moved out of `App.jsx`.
  - A test checks that the charts read fields the API returns.
- **Verified:**
  - 65 tests pass.
  - Removing the chart error boundary failed the crash test, and removing the 429 mapping failed 3 tests.
  - A screenshot showed the page unchanged.
  - My CSS was confirmed untouched.

### 13. README

**Prompt:**

> Draft a README so a reviewer on Windows or Mac can build and run the backend and frontend from a fresh clone. Then point out any step that might fail.

**Why:** Reviewers need to run the project without help, so I wanted the setup steps tested, not just written.

**Kept / Changed / Rejected:**

- **Kept:** the README, with prerequisites, a quick start, commands, the endpoint's status codes, the project structure and a troubleshooting table.
- **Verified:** the AI copied the files git would include into an empty folder and ran every step there. Build, all tests, `npm ci`, lint and build passed, and both apps ran with real data.
- **Changed (bugs found by checking the README):**
  - Settings in `frontend/.env.local` were ignored, because `vite.config.js` read `process.env` instead of using `loadEnv`.
  - `npm run preview` didn't proxy `/api` to the API.

  Both were fixed and re-tested.

- **Kept (risk list):**
  - A reviewer with only a .NET 9/10 SDK has no .NET 8 runtime.
  - PowerShell's default script policy blocks `npm.ps1` on fresh Windows installs.
  - Node versions older than 22.12 can't run the tests.
  - Yahoo may be blocked or rate-limiting on some networks.
  - macOS was not tested directly.

## Manual changes & reasoning

I moved the backend and backend.Tests to a combined folder for readability and modularity. I also tweaked some css styles for borders and spacing for better UI. Most of the implmentation was a back and forth effort with claude, where I would describe a feature and would review and change the code.
