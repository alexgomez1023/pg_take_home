# Stock Intraday Summary

A .NET 8 Web API and a React frontend for intraday stock data. Enter a symbol, and the API fetches the last month of 15-minute bars from Yahoo Finance, groups them by trading day, and returns each day's average low, average high and total volume. The frontend shows the result as a price chart, a volume chart and a table.

```json
[
  { "day": "2026-09-24", "lowAverage": 378.0621, "highAverage": 379.8193, "volume": 23818806 }
]
```

## Prerequisites

| Tool | Version | Check with |
|---|---|---|
| [.NET SDK](https://dotnet.microsoft.com/download/dotnet/8.0) | **8.0** (see note) | `dotnet --list-sdks` and `dotnet --list-runtimes` |
| [Node.js](https://nodejs.org/) | **22.12 or newer** (24 LTS recommended) | `node --version` |
| Git | any | `git --version` |

- **.NET:** the API targets `net8.0`, so it needs the **.NET 8 runtime**. Installing the .NET 8 SDK gives you that. A newer SDK (9 or 10) can *build* the project, but `dotnet run` and `dotnet test` still need `Microsoft.NETCore.App 8.0.x` and `Microsoft.AspNetCore.App 8.0.x` in `dotnet --list-runtimes`.
- **Node:** the test runner (Vitest 5) needs Node 22.12+. Node 20 can run the app but not the tests.
- **Network:** you need internet access, both to restore packages (nuget.org, npmjs.org) and for the API to reach Yahoo Finance. The tests don't call Yahoo.

The commands below are the same on Windows (PowerShell or Command Prompt) and macOS (Terminal).

## Quick start

Use two terminals, both starting in the repository root.

**Terminal 1: API** (http://localhost:5080)

```bash
cd backend
dotnet run --project API
```

Wait for `Now listening on: http://localhost:5080`.

**Terminal 2: frontend** (http://localhost:5173)

```bash
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173** and enter a symbol such as `TSLA`, `AAPL`, `BRK-B` or `^GSPC`.

The frontend calls the API through the Vite dev server's proxy (`/api` → `http://localhost:5080`), so no CORS or `.env` setup is needed locally.

## Backend

All commands run from the `backend/` folder, which contains the solution file (`StockData.sln`).

```bash
dotnet build              # build the API and the tests
dotnet test               # 31 tests, run offline against a recorded Yahoo response
dotnet run --project API  # start the API
```

When it's running:

- **Swagger UI:** http://localhost:5080/swagger
- **Health check:** http://localhost:5080/health
- **Endpoint:** `GET /api/stocks/{symbol}/intraday`

```bash
curl http://localhost:5080/api/stocks/TSLA/intraday
```

> On Windows PowerShell 5.1, `curl` is a different command (an alias for `Invoke-WebRequest`). Use `curl.exe` instead, or open the URL in a browser.

| Status | When |
|---|---|
| 200 | An array of days, oldest first. It's `[]` if the symbol exists but had no trades. |
| 400 | The symbol format is invalid. Allowed: 1–15 letters, digits, `.`, `-` or `=`, optionally starting with `^`. |
| 404 | Yahoo has no data for the symbol. |
| 502 | Yahoo rejected the request or returned data that can't be used. |
| 503 | Yahoo is unreachable, timed out or is rate-limiting. |

Errors are returned as [RFC 7807](https://www.rfc-editor.org/rfc/rfc7807) `application/problem+json`.

**Configuration** lives in [`backend/API/appsettings.json`](backend/API/appsettings.json) under `YahooFinance`: base URL, User-Agent, range (`1mo`), interval (`15m`) and timeout. Invalid values stop the app at startup.

## Frontend

All commands run from the `frontend/` folder.

```bash
npm ci            # install the exact versions in package-lock.json
npm run dev       # dev server at http://localhost:5173, with hot reload
npm test          # 65 tests (Vitest + Testing Library)
npm run lint      # oxlint
npm run build     # production build into frontend/dist
npm run preview   # serve the production build at http://localhost:4173
```

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | empty | Base URL of the API. Leave it empty to use same-origin requests through the dev proxy. |
| `VITE_API_PROXY_TARGET` | `http://localhost:5080` | Where the dev and preview servers forward `/api`. |

To set them, copy [`frontend/.env.example`](frontend/.env.example) to `frontend/.env.local`. If `VITE_API_BASE_URL` points to a different origin than the frontend, the API needs CORS enabled for that origin, which isn't configured yet.

## Project structure

```
├── backend/
│   ├── StockData.sln             # solution: API + tests
│   ├── global.json               # .NET SDK selection (8.0 or newer)
│   ├── Directory.Build.props     # shared .NET settings (net8.0, nullable, warnings as errors)
│   ├── Directory.Packages.props  # NuGet versions, managed centrally
│   ├── API/                      # ASP.NET Core Web API (StockData.Api.csproj)
│   │   ├── Controllers/          # HTTP endpoint and status codes
│   │   ├── Clients/Yahoo/        # typed HttpClient for the Yahoo chart API
│   │   ├── Services/             # daily aggregation (pure, no I/O)
│   │   ├── Models/  Exceptions/  Filters/
│   │   └── appsettings.json
│   └── Tests/                    # xUnit tests, with recorded Yahoo fixtures
└── frontend/                     # React + Vite (JavaScript)
    └── src/
        ├── services/         # all API calls and error mapping
        ├── hooks/            # data loading and URL state
        ├── components/       # page sections; charts in components/charts
        └── utils/            # formatting and symbol validation
```

## Documentation

- [**ASSUMPTIONS.md**](ASSUMPTIONS.md): every ambiguity in the requirements and the decision taken. It covers how averages are calculated, timezones, rounding, zero-volume bars and error codes.
- [**PROMPT_LOG.md**](PROMPT_LOG.md): the AI prompts used, why each was sent, what was kept, changed or rejected, and the manual changes made outside of AI.

## Troubleshooting

| Problem | Fix |
|---|---|
| `You must install or update .NET to run this application` or `Framework 'Microsoft.NETCore.App', version '8.0.0' was not found` | Install the [.NET 8 runtime](https://dotnet.microsoft.com/download/dotnet/8.0) (the ASP.NET Core Runtime includes both) next to your newer SDK. |
| Windows PowerShell: `npm.ps1 cannot be loaded because running scripts is disabled` | Run `npm.cmd ci` / `npm.cmd run dev`, use Command Prompt, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. |
| `npm ci` or `npm test` fails with an engine or syntax error | Your Node is too old. Install Node 22.12+ (`node --version`). |
| `Failed to bind to address http://localhost:5080: address already in use` | Another process is using port 5080. Stop it, or change `applicationUrl` in `backend/API/Properties/launchSettings.json` *and* set `VITE_API_PROXY_TARGET` to match. |
| The page shows **Server unreachable** | The API isn't running, or it's on a different port. Start Terminal 1 first. |
| The page shows **Market data unavailable** or **Too many requests** | Yahoo couldn't be reached or is rate-limiting. This happens on some corporate networks and VPNs. Try again later or from another network. |
