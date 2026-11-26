# Design

## Context

See proposal.md - Why. The `/new` command must clear the App-level subagent store so the SUBAGENTS panel starts empty for a new session. This is a small, contained UI-state fix; no architectural change is required.

## Goals / Non-Goals

- Goals: reset the `subagentStore` state when a new session starts so the SUBAGENTS panel is cleared.
- Non-Goals: no change to subagent event folding, panel rendering, or session persistence.

## Decisions

- **Reset via `setSubagentStore(createSubagentStore())` in `handleNewSession`.** The store module already exports `createSubagentStore()` returning `{}`; using the factory keeps the reset consistent with the store's own semantics rather than inlining a bare `{}`. This is the minimal, idiomatic change and mirrors how the store is initialized in App state.
- **Place the reset alongside the other new-session resets.** `handleNewSession` already resets conversation area, input history, active project, and cwd; adding the store reset there keeps all new-session cleanup in one place.

## Risks / Trade-offs

- [Resetting the store drops in-flight subagent output] → A new session semantically starts fresh; any subagent activity from the prior thread is no longer relevant. Acceptable and intended.

## Migration Plan

No migration. This is a code-only change with no config or data impact.

## Open Questions

None.
