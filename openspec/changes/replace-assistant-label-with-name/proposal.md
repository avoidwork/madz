## Why

The assistant label in the TUI chat log is hardcoded as "Assistant", which is generic and does not reflect the project identity. Making it a configurable value (defaulting to "madz") lets users personalise the label or know the project name at a glance, and aligns with the configurable nature of the system.

## What Changes

- Add a `tui.name` top-level config field to the schema, defaulting to `"madz"`.
- Update `getRoleLabel` in `src/tui/messages.js` to accept an optional `assistantName` parameter; when the role is `"assistant"` and the parameter is provided, return it instead of the hardcoded `"Assistant"`.
- Update `formatMessage` to accept and pass the `assistantName` through to `getRoleLabel`.
- Update existing callers in the TUI (conversation panel) to read `settings.tui.name` from config.
- Update the TUI label test in `tests/unit/tui.test.js` to cover the parameterised label.

## Capabilities

### New Capabilities
- `config-system`: Add `tui.name` field to the configuration schema with a default value.

### Modified Capabilities
- `tui-interface`: `Assistant` label in chat log is now configurable instead of hardcoded.

## Impact

- `src/config/schemas.js` — schema and defaults extend with `tui` object.
- `src/tui/messages.js` — `getRoleLabel` and `formatMessage` signatures change to accept `assistantName`.
- `src/tui/conversationPanel.js` — caller reads config and passes `assistantName` to format functions.
- `tests/unit/tui.test.js` — tests updated to use parameterised label.
