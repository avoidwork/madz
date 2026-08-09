## Why

PR #696 replaced `marked-terminal` with a custom `TerminalRenderer` (commit 736b754). The table rendering pipeline introduced a delimiter mismatch: `tablecell()` wraps cell content with `^*||*^` (two pipes), but `generateTableRow()` splits on `/\^[*]+\|[*^]/` (one pipe). This causes all table cells to collapse into a single column, rendering tables as garbled text instead of properly formatted cli-table3 output.

## What Changes

- Fix the `generateTableRow()` regex in `src/tui/markdownText.js` to match the actual delimiter produced by `tablecell()`
- Update the `terminal-renderer` spec to document the table delimiter contract
- Add a regression test for table rendering

## Capabilities

### Modified Capabilities
- `terminal-renderer`: Fix table cell delimiter regex to match `^*||*^` format produced by `tablecell()`

## Impact

- **Affected code**: `src/tui/markdownText.js` (line 195 — `generateTableRow` regex)
- **No dependency changes**
- **No API surface changes**
- **Tests**: Existing table rendering tests should pass once the regex is fixed

## Non-goals

- Refactoring the table rendering pipeline
- Adding new table features (multiline cells, etc.)
- Changing the delimiter format itself
