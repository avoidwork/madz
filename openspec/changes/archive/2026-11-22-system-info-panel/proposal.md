# Proposal

## Why

There is no standard way to see resource usage from inside the TUI. Users must drop to a shell to check CPU, memory, or disk, which breaks flow. A built-in panel gives immediate visibility into the harness's resource footprint and the host environment without leaving the conversation.

## What Changes

- Add a `/system` slash command that opens a new read-only system info panel.
- Add a `SystemPanel` component that gathers and displays live system info (CPU load, memory, disk, uptime, platform, Node version, process memory) using Node built-ins only.
- Register the panel in the existing panel architecture (`PANELS`, `getPanelOrder()`, App router).
- Add `/system` to the command help text.
- Update and add tests for the new panel and command.

## Capabilities

### New Capabilities

- `tui-system-panel`: A read-only TUI panel that displays live system information (CPU, memory, disk, uptime, platform, Node version, process memory) gathered from Node built-ins, reachable via the `/system` slash command.

### Modified Capabilities

- `tui-interface`: The TUI command surface gains a new `/system` view-switching command that routes to the system panel.

## Impact

- **Code**: `src/tui/panels.js`, `src/tui/commandParser.js`, `src/tui/app.js`, `src/tui/commandHelp.js`, new `src/tui/systemPanel.js`.
- **Tests**: `tests/unit/tui/panels.test.js`, `tests/unit/tui/commandParser.test.js`, new `tests/unit/tui/systemPanel.test.js`.
- **Dependencies**: None — Node built-ins (`node:os`, `node:fs`, `node:process`) only.

## Non-goals

- Per-process, network, or GPU metrics.
- Adding the external `systeminformation` dependency.
- Any write/network capability — this is purely read-only local introspection.
