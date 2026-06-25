## Context

The project currently has zero GitHub API calls in `src/` — all `gh` usage lives in skills as shell commands executed via the `terminal` tool. There is no GitHub token environment variable reference in source code, and no dedicated client module. The codebase uses native `fetch()` consistently (`src/tools/moa.js`, `src/tools/vision.js`, `src/tools/image.js`, `src/tools/web.js`, `src/tools/tts.js`), and `src/tools/common.js:39` has a `fetchWithTimeout()` helper that can be reused.

## Goals / Non-Goals

**Goals:**
- Create `src/gh-client.js` — a factory-based GitHub REST API client using native `fetch()`
- Provide methods for issue CRUD, PR CRUD, and comments
- Authenticate via `GITHUB_TOKEN` environment variable
- Return normalized `{ data, error }` responses
- Write unit tests that mock `fetch()`

**Non-Goals:**
- Replacing existing `gh` CLI shell calls in skills (future work)
- GraphQL API support
- Auto-pagination of list results
- Integration with `src/config/loader.js` env var system
- Integration tests against the real GitHub API

## Decisions

**Native fetch over Octokit:** The codebase already uses native `fetch()` everywhere. Adding `@octokit/rest` would introduce a dependency and require manual token handling anyway. Native fetch keeps the dependency graph clean and the code transparent.

**Factory pattern over singleton:** Each client instance is configured with its own `{ owner, repo, token }`. This allows different skills or modules to use different repos or tokens without global state. It also makes testing trivial — each test gets a fresh instance.

**Error handling strategy:** Methods return `{ data, error }` rather than throwing. This matches the pattern used elsewhere in the codebase where API calls are common and errors are expected (e.g., issue not found, rate limited). The factory throws only on configuration errors (missing token).

**No auto-pagination:** List methods accept `page` and `perPage` parameters but do not auto-paginate. This keeps the API simple and lets callers decide when to fetch more pages. The `Link` header from GitHub's response can be parsed if needed.

**Direct env var over config loader:** The client reads `GITHUB_TOKEN` directly from `process.env` rather than going through `src/config/loader.js`. This keeps the client self-contained and avoids circular import risks.

## Risks / Trade-offs

**Risk:** GitHub API rate limiting (429 responses) could cause cascading failures.
→ **Mitigation:** Methods surface the `Retry-After` header in the error object. Callers can implement backoff. The client does not auto-retry to keep it simple.

**Risk:** `editPR` fails with `gh pr edit` in this repo (per issue notes).
→ **Mitigation:** The `editPR` method uses `PATCH /repos/{owner}/{repo}/pulls/{number}` directly via the API, bypassing the `gh` CLI limitation.

**Risk:** Circular imports if config loader is used.
→ **Mitigation:** Direct `process.env` access avoids this entirely.

**Risk:** Missing `GITHUB_TOKEN` could cause silent failures.
→ **Mitigation:** The factory throws at instantiation time with a clear error message listing the expected env var name.

## Migration Plan

This is a greenfield addition — no migration needed. Future work can update skills to use the client instead of shell commands, but that is out of scope for this change.

## Open Questions

None — all technical decisions are resolved.