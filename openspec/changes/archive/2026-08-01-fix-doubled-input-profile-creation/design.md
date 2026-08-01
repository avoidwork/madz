## Context

The TUI uses Ink for its terminal UI. During profile creation (onboarding), the `useInput` hook in `src/tui/app.js` handles keyboard input. Previously, it manually appended every keystroke to `inputText` state. After a refactoring that migrated `InputPanel` to use `ink-text-input`, both handlers fire simultaneously — the hook appends characters manually, and `ink-text-input` also processes them natively — resulting in every character appearing twice.

## Goals / Non-Goals

**Goals:**
- Remove the redundant manual character-appending from the onboarding branch of `useInput`.
- Ensure Enter (submit) and Escape (quit) still work correctly during onboarding.
- Align the code with the existing documented intent ("InputPanel now uses ink-text-input for text entry").

**Non-Goals:**
- Changes to input handling outside of onboarding.
- Modifications to `ink-text-input` or `InputPanel`.
- Changes to other TUI panels or general input handling.

## Decisions

1. **Remove, don't patch.** The manual character-appending block is entirely redundant now. There is no scenario where onboarding needs both handlers. A surgical removal is cleaner than adding conditional logic.

2. **Scope to onboarding branch only.** The `useInput` hook has different behavior for onboarding vs. regular conversation. Only the onboarding branch is affected.

## Risks / Trade-offs

- [Risk] Removing the block could break input if `ink-text-input` somehow fails to capture keystrokes. → **Mitigation**: `ink-text-input` is well-tested and is the established pattern used elsewhere in the codebase.
- [Risk] The fix is narrowly scoped but the root cause may affect other areas. → **Mitigation**: The audit findings and issue description confirm this is isolated to profile creation/onboarding.

## Migration Plan

No migration needed. This is a simple code removal — no config changes, no data migrations, no deployment steps beyond merging the PR.

## Open Questions

None. The fix is straightforward and well-documented in the issue.
