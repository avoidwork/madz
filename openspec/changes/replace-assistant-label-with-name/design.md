## Context

`getRoleLabel` in `src/tui/messages.js` returns a hardcoded `"Assistant"` for the `"assistant"` role. The TUI chat log always shows "Assistant:" as the label regardless of project identity. Config is available at the top level in `index.js` and passed to the `App` component, but `ConversationPanel` does not currently receive config.

## Goals / Non-Goals

**Goals:**
- Add a `tui.name` config field with default `"madz"`.
- Replace the hardcoded `"Assistant"` label with the configurable value.
- Keep the change minimal and non-breaking — the label falls back to the raw role name if `assistantName` is undefined.

**Non-Goals:**
- Configuring labels for `user` or `system` roles.
- Per-session assistant name overrides.
- Changing the message `role` field (`"assistant"` stays the internal role).

## Decisions

1. **Add `tui.name` under a new `tui` top-level config schema**
   - Rationale: Keeps TUI-specific config grouped. Follows the existing pattern of top-level sections (`sandbox`, `memory`, `session`).
   - Alternative: Add `name` at root level. Rejected because root config is shared across subsystems.

2. **Pass `assistantName` through `App` → `ConversationPanel` → `getRoleLabel`**
   - Rationale: Minimal prop threading. `getRoleLabel` is a pure function; adding a parameter keeps it testable and side-effect-free.
   - Alternative: Module-level singleton import of config. Rejected because it introduces an implicit dependency and hurts testability.

3. **`getRoleLabel` accepts an optional second parameter `assistantName`**
   - Rationale: No signature changes for callers that don't care (e.g., tests). If not provided, returns `"Assistant"` as current default.

## Risks / Trade-offs

- [Breaking prop change] → `ConversationPanel` and `formatMessage` need the new prop; all existing callers must be updated. Mitigations: explicit `undefined` fallback preserves old behaviour.
- [Config schema migration] → Existing `config.yaml` files without `tui` section get the default. No manual migration needed.
