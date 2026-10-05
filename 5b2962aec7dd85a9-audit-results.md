# Audit Results: Re-add Firecrawl as a search engine option

## Goal Fulfillment

All goals met:
- **Goal 1** (re-add Firecrawl as a search engine option): Complete. `searchWithFirecrawl` added, wired into `detectSearchBackend` and `searchWebImpl`.

## Spec Compliance

- **firecrawl-search spec**: All requirements implemented.
  - `searchWithFirecrawl(apiKey, query, limit)` POSTs to `https://api.firecrawl.dev/v2/search` with Bearer auth and body `{ query, limit, sources: ["web"] }`. ✓
  - Maps `data.web[].description` → normalized `description`. ✓
  - Returns `{ ok: false, error }` on 401/408/500. ✓
  - Returns `{ ok: true, results: [] }` on empty results. ✓
  - Clamps limit to 1–100. ✓
  - `detectSearchBackend` returns `"firecrawl"` when `firecrawl.apiKey` set. ✓
  - `searchWebImpl` dispatches to `searchWithFirecrawl` with `backend: "firecrawl"`. ✓
- **web-search-config delta**: Updated to reflect Firecrawl as an implemented engine (config.yaml, schema, tool description). ✓

## Task Completion

All 8 tasks in tasks.md are marked complete.

## Quality Check

- **Tests**: 9 new tests in `searchFirecrawl.test.js` all pass. Full suite: 3950/3951 pass (the 1 failure is a pre-existing environmental issue — `TAVILY_API_KEY` is set in the shell, causing `detectSearchBackend({})` to return `tavily` instead of `duckduckgo`; confirmed it passes with the env var unset).
- **Lint**: 0 warnings, 0 errors.
- **Coverage**: `web/index.js` at 92.89% line coverage; maintained (no threshold gate per AGENTS.md §6.3).
- **App start**: `npm start` boots to the TUI render stage; the Ink raw-mode error is expected in a non-TTY shell, not a crash from this change.

## Notes

- The issue's audit findings referenced an `engine` enum and explicit-engine list that no longer exist in the current codebase — backend selection is config-inference based. The implementation follows the actual current pattern (mirroring Tavily).
- `src/tools/index.js` and `src/config/loader.js` already plumb `searchFirecrawlApiKey` / drop the `search` key, so no changes were needed there.

No errors found. Proceeding to archive.
