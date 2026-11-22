# Design

## Context

The TUI already has a panel architecture: `PANELS` in `src/tui/panels.js` (a frozen constant), `getPanelOrder()` for tab navigation, view-switching commands in `src/tui/commandParser.js`, and a panel-routing if/else chain in `src/tui/app.js`. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Add a `/system` view-switching command that routes to a new read-only system panel.
- Add a `SystemPanel` component gathering system info from Node built-ins only.
- Register the panel in `PANELS`, `getPanelOrder()`, and the App router.
- Add `/system` to the command help text.
- Update and add tests.

**Non-Goals:**
- Per-process, network, or GPU metrics.
- Adding the external `systeminformation` dependency.
- Any write/network capability.

## Decisions

### Use Node built-ins only (no new dependency)

The external `systeminformation` package offers richer metrics but adds a dependency. The Node built-in `os` module plus `fs.statfs` covers the core needs (CPU, memory, disk, uptime, platform, Node version, process memory) with zero new dependencies. Decision: use `node:os`, `node:fs`, `node:process`. Revisit `systeminformation` only if deeper metrics are wanted.

### Follow the established panel pattern

The new `SystemPanel` mirrors existing panels (`SettingsPanel`, `SubagentsPanel`) in structure and props (`onViewChange`, `activeView`). This keeps the router wiring consistent and the component testable in isolation.

### Register `/system` as a pure view-switching command

Adding `["system", "system"]` to the view-switching loop in `commandParser.js` returns `{ action: "view", value: "system" }`. Because `isViewCommand()` parses the input and checks `result?.action === "view"`, `/system` is automatically treated as a pure panel switch that will not interrupt an in-flight stream.

### Graceful handling of edge cases

`fs.statfs` may be unavailable on older Node versions; load average may be unavailable on some platforms. The info-gathering function reports these as unavailable rather than throwing, so the panel renders without crashing.

## Risks / Trade-offs

- **Panel count changes from 7 to 8** → Existing `tests/unit/tui/panels.test.js` asserts `order.length === 7` and the last panel. Must update to 8 and adjust the last-panel assertion.
- **`fs.statfs` availability varies by Node version** → Guard the call and report disk usage as unavailable on failure.
- **Load average unavailable on some platforms** → Guard and report as unavailable.
