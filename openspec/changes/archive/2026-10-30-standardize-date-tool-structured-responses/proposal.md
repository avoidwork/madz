# Proposal

## Why

The `date` tool's implementation function (`dateImpl`) returns a bare string, so consumers cannot reliably distinguish success from failure or parse returned data. Standardizing to structured objects enables programmatic handling, consistent error propagation, and reliable downstream processing by the orchestrator and other tools.

## What Changes

- Refactor `dateImpl` in `src/tools/date/index.js` to return `{ ok: true, date, format }` on success and `{ ok: false, error }` on failure.
- Update the `date` LangChain tool wrapper to serialize the structured result to a JSON string for the LLM (matching the `json`/`data` tool convention).
- Update JSDoc `@returns` annotations.
- Update `tests/unit/tools_date.test.js` to assert structured objects and add an invalid-format failure case.

## Capabilities

### New Capabilities
- `date-tool`: The `date` tool's response contract — it SHALL return structured `{ ok: true, date, format }` / `{ ok: false, error }` objects rather than bare strings.

### Modified Capabilities
<!-- None — no existing capability's requirements change. -->

## Impact

- **Code**: `src/tools/date/index.js` (`dateImpl` and the `date` tool wrapper).
- **Tests**: `tests/unit/tools_date.test.js`.
- **Dependencies**: None — pure refactor, no new npm packages.
- **API**: The `date` tool's `name`, `description`, and `schema` are unchanged; only the response shape changes.

## Non-goals

- No changes to other tools' response shapes.
- No new capabilities beyond the `date` tool's structured response contract.
- No changes to the `date` tool's input schema or behavior for valid inputs.
