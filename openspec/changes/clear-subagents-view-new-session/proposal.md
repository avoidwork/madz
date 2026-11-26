# Proposal

## Why

The `/new` command resets the conversation area, input history, active project, and working directory, but never resets the App-level `subagentStore`. As a result, the SUBAGENTS panel (opened via `/subagents`) continues to show the previous session's subagent activity after a new session starts. This is a UI-state bug: a new session should present a clean slate, including the subagents view.

## What Changes

- Reset the App-level `subagentStore` state when a new session starts, so the SUBAGENTS panel is cleared.
- No change to subagent event folding, the panel rendering, or any public API.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a defensive UI-state fix that does not change any spec-level behavior contract, so `skip_specs: true` is set in `.openspec.yaml`.

## Impact

- `src/tui/app.js` — reset `subagentStore` in `handleNewSession`.
- No dependencies, config, or external systems affected.

## Non-goals

- No change to subagent event capture or the SUBAGENTS panel rendering.
- No change to session persistence or conversation reset behavior.
- No new public APIs or config surface.
