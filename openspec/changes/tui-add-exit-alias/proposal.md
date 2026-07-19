## Why

Users naturally expect `/exit` to terminate the application — it's the more common convention across CLI tools and terminals. While `/quit` works, it feels less intuitive. Having both available reduces friction and matches user expectations without breaking existing muscle memory.

## What Changes

- Add `/exit` as a command alias alongside `/quit` in the TUI command parser. Both commands invoke the same shutdown handler and behave identically.
- Update the startup banner help text to list both `/quit` and `/exit` as available commands.
- Add a unit test verifying `/exit` returns the same result as `/quit`.

## Capabilities

### Modified Capabilities

- `tui-interface`: The TUI command entry capability is extended to support `/exit` as an additional command alongside the existing `/quit` command.

## Impact

- `src/tui/commandParser.js` — add a new `#register("exit", ...)` call in the constructor.
- `src/tui/banner.js` — update the help banner to list both commands.
- `tests/unit/commandParser.test.js` — add a test for the `/exit` command.
- No API changes, no new dependencies, no breaking changes.
