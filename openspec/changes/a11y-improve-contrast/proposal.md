## Why

The TUI color scheme uses low-contrast gray text for timestamps, tool call results, and dimmed labels. Status indicators and highlights rely solely on color without shape or text differentiation. Users with visual impairments or those using terminals with non-standard color palettes may struggle to read content. Adding a gray background and high-contrast mode improves readability and accessibility compliance.

## What Changes

- Add configurable gray background color for the conversation panel area (default: `#1e1e1e`)
- Introduce a high-contrast mode toggle via config (`tui.highContrast`) that:
  - Replaces gray text with white/bright text (replacing `color: "gray"` and `dim` on timestamps, tool output, thinking, and separator text)
  - Strengthens status indicator visibility with text labels (e.g., "OK", "SENDING", "ERROR") alongside the shape
  - Increases panel focus border thickness via brighter highlight text
  - Adds explicit `backgroundColor` on status bar to match conversation panel contrast level
- Make conversation panel bubbles more distinguishable with subtle background colors per role when in high-contrast mode

## Capabilities

### New Capabilities
- `a11y-high-contrast`: High-contrast accessibility mode for the TUI with configurable background colors and role-specific color overrides

### Modified Capabilities
- `tui-interface`: Status indicator requirements now include text labels alongside colored shapes; conversation panel background is configurable

## Impact

- **Files**: `src/tui/app.js`, `src/tui/conversationPanel.js`, `src/tui/statusBar.js`, `src/tui/banner.js`, `src/tui/inputPanel.js`, `src/tui/skillsPanel.js`, `src/tui/memoryPanel.js`, `src/tui/settingsPanel.js`, `src/tui/markdownText.js`, `src/tui/messages.js`
- **Config**: Adds `tui.backgroundColor` and `tui.highContrast` settings to `config.yaml`
- **Breaking**: No. Defaults maintain current behavior unless `tui.highContrast: true` is set
