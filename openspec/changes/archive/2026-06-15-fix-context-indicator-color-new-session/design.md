## Context

The TUI status bar displays a context size indicator whose color reflects the compaction state:
- Red (`"red"`) when `isCompacting` is `true` (context is being compacted)
- Gray (`"#606060"`) when `isCompacting` is `false` (normal state)

The `isCompacting` state is managed in `src/tui/app.js` via React `useState`. It is set to `true` during context compaction but was never reset when starting a new session.

## Goals / Non-Goals

**Goals:**
- Reset `isCompacting` to `false` when `handleNewSession()` is called
- Ensure the context size indicator returns to gray after starting a new session

**Non-Goals:**
- Refactoring the state management approach
- Adding new features or capabilities
- Changing the compaction logic itself

## Decisions

**Decision:** Add a single `setIsCompacting(false)` call to `handleNewSession()`.

**Rationale:** This is the minimal, most targeted fix. The function already resets related state (`messages`, `chatHistory`, `contextSize`, `statusMessage`), so adding `isCompacting` to that list is consistent with the existing pattern.

**Alternatives considered:**
- Resetting `isCompacting` in `StatusBar` on mount — rejected because the state is application-level, not component-level
- Adding a dedicated cleanup function — rejected as over-engineering for a single missing reset

## Risks / Trade-offs

**Risk:** None significant. This is a single-line state reset in an existing function.

**Trade-off:** None. The fix is strictly additive and follows the established pattern.
