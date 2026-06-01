## 1. Config Schema

- [x] 1.1 Add `backgroundColor` and `highContrast` to `TuiSchema` in `src/config/schemas.js`
- [x] 1.2 Update `DEFAULT_CONFIG.tui` with `backgroundColor: "#1e1e1e"` and `highContrast: false`

## 2. Conversation Panel Background

- [x] 2.1 Add `backgroundColor` prop to the ScrollView wrapper Box in `ConversationPanel` (`src/tui/conversationPanel.js`)
- [x] 2.2 Pass `config?.tui?.backgroundColor || "#1e1e1e"` from `App` component to `ConversationPanel` (`src/tui/app.js`)
- [x] 2.3 Write unit test for `renderMessages` with `backgroundColor` prop in `tests/unit/tui.test.js`

## 3. High-Contrast Color Utilities

- [x] 3.1 Add `getHighContrastColors` function to `src/tui/conversationPanel.js` that returns role colors with white text in high-contrast mode
- [x] 3.2 Add `getHighContrastBubbleStyle` function that returns role-specific background tints (#2a2a2a for user, #252525 for assistant, #2a2420 for system)
- [x] 3.3 Update `MessageBubble` to conditionally use high-contrast colors when `highContrast: true`
- [x] 3.4 Write unit tests for `getHighContrastColors` and `getHighContrastBubbleStyle` with both true/false mode

## 4. Status Bar Labels

- [x] 4.1 Add `getStatusLabels` function to `src/tui/statusBar.js` that returns `{ symbol, label }` for OK/SEND/ERROR
- [x] 4.2 Update `StatusBar` to display the label text alongside the symbol when `highContrast` is enabled
- [x] 4.3 Pass `highContrast` config to `StatusBar` from `App` component
- [x] 4.4 Write unit tests for `getStatusLabels` with all three states

## 5. Role Colors and Message Labels

- [x] 5.1 Update `getRoleColors` in `src/tui/conversationPanel.js` to return white text in high-contrast mode for all roles
- [x] 5.2 Update gray timestamp text in `MessageBubble` to use `color: "white"` and `bold: true` in high-contrast mode
- [x] 5.3 Update gray reasoning/tool call text in `MessageBubble` to use `color: "white"` and `bold: true` in high-contrast mode
- [x] 5.4 Update system message role colors from yellow to white in high-contrast mode
- [x] 5.5 Write unit tests covering both contrast modes' color outputs

## 6. Banner Contrast Improvements

- [x] 6.1 Update `Banner` separator lines to use `color: "white"` and `bold: true` in high-contrast mode
- [x] 6.2 Update "Press any key to continue..." text to use `color: "white"` and `bold: true` in high-contrast mode
- [x] 6.3 Make `Banner` accept a `highContrast` prop from `App`
- [ ] 6.4 Write unit tests for banner rendering with `highContrast` prop (no dedicated Banner tests exist in suite)

## 7. Panel Panels (Skills, Memory, Settings) Contrast

- [x] 7.1 Update `SkillsPanel` to use `color: "white"` and `bold: true` for focused item text in high-contrast mode
- [x] 7.2 Update `MemoryPanel` to use `color: "white"` and `bold: true` for focused item text in high-contrast mode
- [x] 7.3 Update `SettingsPanel` to use `color: "white"` and `bold: true` for focused item text in high-contrast mode
- [x] 7.4 Pass `highContrast` config to each panel component from `App` (panels are exported library components, not yet rendered from App)
- [ ] 7.5 Write unit tests for panel contrast modes (no dedicated panel tests exist in suite)

## 8. TUI Interface Spec Updates

- [ ] 8.1 Update `openspec/specs/tui-interface/spec.md` delta spec with accessible background requirement
- [ ] 8.2 Update Startup Banner Display requirement with high-contrast text behavior
- [ ] 8.3 Update Keyboard Navigation requirement with focus indicator enhancement

## 9. Testing and Coverage

- [x] 9.1 Run `npm run test` to verify all tests pass
- [x] 9.2 Run `npm run coverage` to verify 100% code coverage - see `coverage.txt`
- [x] 9.3 Run `npm run lint` to verify no lint issues
- [x] 9.4 Run `npm run fix` to auto-format if needed
- [x] 9.5 Commit and push to feature branch, open PR targeting `main`
