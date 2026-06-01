## Context

The TUI uses React/Ink with inline style properties (e.g., `backgroundColor`, `color`). Colors are hardcoded per component:
- StatusBar: `backgroundColor: "#404040"`, colored indicators (green/yellow/red)
- ConversationPanel: no background, role-based colors via `getRoleColors()` and `getBubbleStyle()`
- StatusBar/MessageBubble: gray dim text for timestamps, labels, tool output
- Banner/Skills/Memory/Settings: cyan/gray/white palette

Ink's Text supports `color` (named colors) and `backgroundColor` Box props. No theming system exists.

## Goals / Non-Goals

**Goals:**
- Add configurable gray background for conversation panel
- High-contrast mode that improves text readability without changing layout
- Config-driven: toggle via `tui.highContrast` boolean and `tui.backgroundColor`
- No breaking changes to default visual appearance

**Non-Goals:**
- Full theme system with multiple color palettes (keep defaults as-is)
- Screen reader / VO support (terminal does not support it)
- Dynamic color scheme at runtime without reload
- WCAG 2.2 AA compliance for terminal UIs (no industry standard exists)

## Decisions

### 1. High-contrast via config flag, not runtime toggle
- **Decision**: `tui.highContrast` boolean in config.yaml
- **Rationale**: Simpler implementation, no state management overhead, follows existing pattern (e.g., `tui.cursorChar`). A runtime toggle via `:` command could be a follow-up.
- **Alternatives**:
  - CLI flag (`--high-contrast`): more explicit but requires parsing changes
  - Runtime `:contrast` command: more flexible but adds UI complexity

### 2. Gray background default
- **Decision**: Default `tui.backgroundColor` is `"#1e1e1e"` (VS Code dark gray)
- **Rationale**: Matches the status bar's `#404040` aesthetic but provides clear separation. VS Code's dark gray is a recognized accessible terminal background.
- **Alternatives**:
  - Keep conversation panel uncolored: defeats purpose
  - Use `#404040` everywhere: too dark, eliminates visual hierarchy

### 3. Contrast improvements via text color swaps, not CSS
- **Decision**: Replace `color: "gray"` with `color: "white"` and `dim: true` with `color: "white" bold: true` in high-contrast mode
- **Rationale**: Ink does not support CSS `!important` or custom styles. Color prop is the only mechanism.
- **Alternatives**:
  - Use `color: "yellow"` or `"green"`: too chromatic, reduces the "high contrast" effect
  - Add `background` color behind text: Ink does not support this on Text nodes

### 4. Status indicator text labels alongside symbols
- **Decision**: When high-contrast is on, add short labels (OK, SEND, ERROR) next to status symbols
- **Rationale**: Color-only indicators are inaccessible. Text labels fix this without removing symbols.
- **Alternatives**:
  - Replace symbols with text: loses quick visual scanning
  - Change symbols based on status (already done for shapes): color is still the only differentiator

### 5. Separate config value from runtime component logic
- **Decision**: Read `config?.tui` directly in components, no new context/provider needed
- **Rationale**: Ink already passes `config` through the component tree. Adding a React context would be over-engineering for two settings.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Some terminal emulators don't render custom hex backgrounds well | Fallback: Ink falls back to terminal color; gray bg is optional via config |
| High-contrast mode looks drastically different from default | Only active when `highContrast: true`; defaults unchanged |
| `marked-terminal` renderer may inject its own colors that ignore our settings | Markdown content colors are controlled by the renderer; contrast improvements apply to our wrapped elements only |
| Coverage must stay at 100% (pre-commit) | New code paths in high-contrast mode need tests for both true/false config values |

## Migration Plan

1. Implement config schema additions in `src/config/schemas.js`
2. Add `backgroundColor` to conversation panel Box in `conversationPanel.js`
3. Add `highContrast` read + color swap logic in `conversationPanel.js` and `statusBar.js`
4. Update `banner.js` and `messages.js` role color functions
5. Write unit tests mirroring src structure
6. Run `npm run test` then `npm run coverage` to verify 100% coverage

## Open Questions

- Should contrast improvements apply to the banner (currently cyan/white)? Banner is dismissible, so likely not worth it unless users request it.
- Should we add a `:contrast` runtime command? Could be a follow-up change.
