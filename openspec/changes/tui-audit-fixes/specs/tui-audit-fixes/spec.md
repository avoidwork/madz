## ADDED Requirements

### Requirement: Input cursor must be visible
The TUI input panel SHALL render a cursor character with a color distinct from the typed text color, ensuring the cursor is always visible regardless of the text color.

#### Scenario: Cursor visible with default colors
- **WHEN** the user types text in the input panel without specifying a cursor color
- **THEN** the cursor character renders in a distinct color (cyan) separate from the white text

#### Scenario: Cursor visible with custom text color
- **WHEN** the user types text with a custom text color
- **THEN** the cursor character renders in a distinct color separate from the custom text color

### Requirement: Tool call display lines must be dimmed
The conversation panel SHALL render tool call display lines with dimmed styling using the correct Ink `dimColor` prop.

#### Scenario: Tool call display is dimmed
- **WHEN** an assistant message includes tool call display output
- **THEN** each line of the tool call display renders with `dimColor: true`

### Requirement: Auto-scroll must not execute during render
The conversation panel SHALL move all auto-scroll side effects (`scrollToBottom`) out of the render phase and into a `useEffect` hook.

#### Scenario: Auto-scroll after new message
- **WHEN** a new message arrives
- **THEN** the scroll view auto-scrolls to bottom via a `useEffect` callback, not during render

#### Scenario: Auto-scroll during streaming overflow
- **WHEN** streaming content overflows the viewport
- **THEN** the scroll view auto-scrolls to bottom via a `useEffect` callback, not during render

### Requirement: Markdown must not double-wrap
The markdown text component SHALL not apply `wrap: "hard"` to already-wrapped terminal output from `marked-terminal`.

#### Scenario: Markdown renders without double-wrapping
- **WHEN** markdown content is rendered through `MarkdownText`
- **THEN** the output uses the natural line breaks from `marked-terminal` without additional wrapping

### Requirement: Markdown parse results must be cached
The markdown text component SHALL cache the parsed markdown result to avoid reparsing on every render.

#### Scenario: Parse result is reused
- **WHEN** the same markdown content is rendered across multiple renders
- **THEN** the parsed result is returned from cache without re-parsing

### Requirement: Scroll methods must be guarded for non-interactive mode
The conversation panel SHALL guard `scrollToBottom()` and other scroll API calls with an interactive mode check.

#### Scenario: Scroll methods safe in non-interactive mode
- **WHEN** the TUI runs in a non-interactive environment (CI, piped stdout)
- **THEN** scroll method calls are skipped without throwing errors

### Requirement: Dead code must be removed
All unused functions exported from TUI modules SHALL be removed to reduce maintenance debt.

#### Scenario: No dead code in inputPanel
- **WHEN** the codebase is audited
- **THEN** `renderBlink` and `getBlinkState` are not present in `inputPanel.js`

#### Scenario: No dead code in conversationPanel
- **WHEN** the codebase is audited
- **THEN** `handleScrollInput`, `handleResize`, `executeScrollInput`, `executeResize`, and `executeAutoScroll` are not present in `conversationPanel.js`
