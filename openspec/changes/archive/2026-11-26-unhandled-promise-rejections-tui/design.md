# Design

## Context

See proposal.md - Why. Three promise chains in the TUI lack rejection handlers. This is a small, contained defensive fix; no architectural change is required.

## Goals / Non-Goals

- Goals: ensure every promise chain in the affected TUI paths has a rejection handler so failures are surfaced gracefully instead of producing unhandled rejections.
- Non-Goals: no change to Copilot auth flow, system-info gathering, or any public behavior contract.

## Decisions

- **Append `.catch()` rather than `try/catch` inside the `.then()` callback.** The existing code uses promise chains; adding a `.catch()` at the end of each chain is the minimal, idiomatic change that keeps the `cancelled`/`disposed` guard flags intact. Alternatives (wrapping in an async IIFE with try/catch) were rejected as more invasive than needed.
- **Respect the existing guard flags.** In `systemPanel.js`, the `.catch()` must not set state after unmount; in `app.js`, the `.catch()` must not register a handler after the effect is disposed. The existing `cancelled`/`disposed` flags already gate the success path; the rejection path must honor the same flags.

## Risks / Trade-offs

- [Rejection handler swallows a real error] → Log the rejection (or set an error state) rather than silently ignoring it, so the failure is observable.
- [State update after unmount] → Guard the rejection path with the same `cancelled`/`disposed` flags used on the success path.

## Migration Plan

No migration. This is a code-only change with no config or data impact.

## Open Questions

None.
