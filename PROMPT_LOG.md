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

## Manual changes & reasoning

None so far. Every change up to this point was made through the AI.
