## Context

The TUI command parser (`src/tui/commandParser.js`) uses a dispatch table (`Map`) to register slash-prefixed commands. The `/quit` command is registered at line 11 with a simple handler that returns `{ action: "quit", value: true, message: "Quitting." }`. Users have requested `/exit` as an alias because it's the more common convention across CLI tools.

## Goals / Non-Goals

**Goals:**
- Register `/exit` as a command alias that behaves identically to `/quit`.
- Update the startup banner to list both commands.
- Add a unit test for the `/exit` command.

**Non-Goals:**
- No deprecation of `/quit` — both commands remain available.
- No changes to the quit handler logic or shutdown behavior.
- No new configuration or documentation beyond the banner.

## Decisions

1. **Duplicate registration vs. shared handler**: Register `/exit` as a separate entry in the dispatch map pointing to the same handler function. This is simpler than refactoring to a shared constant and keeps the change minimal (one line).

2. **No alias map abstraction**: The current codebase has no alias infrastructure. Adding one would be over-engineering for a single alias. A direct `#register("exit", ...)` call is sufficient.

3. **Banner update**: The banner at `src/tui/banner.js` line 27 lists `/quit - exit the app`. Update to list both `/quit` and `/exit` on the same line.

## Risks / Trade-offs

- **Risk**: Minimal — this is a single-line addition with no behavioral changes.
- **Trade-off**: Duplicating the handler registration means if the handler ever changes, both entries must be updated. However, since both reference the same function, this is not a practical concern.

## Migration Plan

No migration needed. This is a pure addition — existing `/quit` usage is unaffected.

## Open Questions

None.
