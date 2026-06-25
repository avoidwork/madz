## Why

The project currently uses the `gh` CLI for GitHub operations (issue creation, PR management, etc.) but does so by spawning shell commands via the `terminal` tool. This approach works but lacks programmatic control, consistent error handling, and testability. There is no dedicated GitHub client module in the application codebase — all GitHub API interactions are scattered across skill SKILL.md files as shell commands.

Adding a dedicated gh client centralizes GitHub API interactions, makes authentication configurable, provides a consistent interface for all GitHub operations, and enables testing without real API calls. This is a foundational improvement that will simplify future skill development and make the codebase more maintainable.

## What Changes

- Create `src/gh-client.js` — a new module that wraps the GitHub REST API using native `fetch()`
- Provide methods for issue CRUD: `createIssue`, `viewIssue`, `editIssue`, `listIssues`
- Provide methods for PR CRUD: `createPR`, `viewPR`, `editPR`, `listPRs`, `mergePR`
- Provide comment support: `createComment`
- Authentication via `GITHUB_TOKEN` environment variable with clear error on missing token
- Return normalized `{ data, error }` responses from all methods
- No new dependencies — uses native `fetch()` and reuses `fetchWithTimeout()` from `src/tools/common.js`

## Capabilities

### New Capabilities
- `gh-client`: GitHub REST API client with issue, PR, and comment CRUD operations using native fetch()

### Modified Capabilities
<!-- None — this is a greenfield addition -->

## Impact

- **New file:** `src/gh-client.js` — the main client module
- **New file:** `tests/gh-client.test.js` — unit tests
- **No changes to existing files** — this is a greenfield addition
- **Future work:** Skills that currently use `gh` CLI shell commands can be updated to use this client (out of scope for this change)
- **Dependencies:** Reuses `fetchWithTimeout()` from `src/tools/common.js`; no new npm dependencies