## ADDED Requirements

### Requirement: Input cursor must be visible
The TUI input panel SHALL render a cursor character with a color distinct from the typed text color, ensuring the cursor is always visible regardless of the text color. The specific cursor color is a design decision and may vary by theme or configuration.

#### Scenario: Cursor visible with default colors
- **WHEN** the user types text in the input panel without specifying a custom text color
- **THEN** the cursor character renders in a color distinct from the text color

#### Scenario: Cursor visible with custom text color
- **WHEN** the user types text with a custom text color
- **THEN** the cursor character renders in a color distinct from the custom text color

### Requirement: Tool call display lines must be dimmed
The conversation panel SHALL render tool call display lines with dimmed styling using the correct Ink `dimColor` prop.

#### Scenario: Tool call display is dimmed
- **WHEN** an assistant message includes tool call display output
- **THEN** each line of the tool call display renders with `dimColor: true`

### Requirement: Auto-scroll must not execute during render
The conversation panel SHALL move all auto-scroll side effects (`scrollToBottom`) out of the render phase and into a `useEffect` hook. Auto-scroll is triggered by changes in `messages.length` or by detecting streaming content overflow (content height exceeding viewport height).

#### Scenario: Auto-scroll after new message
- **WHEN** a new message is added to the messages array (length increases)
- **THEN** the scroll view auto-scrolls to bottom via a `useEffect` callback that watches `messages.length`, not during render

#### Scenario: Auto-scroll during streaming overflow
- **WHEN** streaming content overflows the viewport (content height > viewport height)
- **THEN** the scroll view auto-scrolls to bottom via a `useEffect` callback that compares `getContentHeight()` against `getViewportHeight()`, not during render

### Requirement: Markdown must not double-wrap
The markdown text component SHALL not apply `wrap: "hard"` to already-wrapped terminal output from `marked-terminal`. The output uses the natural line breaks from `marked-terminal` without additional wrapping.

**Note:** Long unbroken strings (URLs, base64 tokens, very long tool output) may overflow the terminal width if `marked-terminal` does not break them. This is an existing limitation of `marked-terminal` and is not addressed by this change.

**Note:** `marked-terminal` produces ANSI escape codes. Ink's Yoga layout engine calculates dimensions by character count, not visual width. Wide characters (CJK, emoji) and ANSI codes may cause minor layout misalignment. This is a known limitation of the `marked-terminal` + Ink integration.

#### Scenario: Markdown renders without double-wrapping
- **WHEN** markdown content is rendered through `MarkdownText`
- **THEN** the output uses the natural line breaks from `marked-terminal` without additional wrapping

### Requirement: Markdown parse results must be cached
The markdown text component SHALL cache the parsed markdown result to avoid reparsing on every render. This is a performance optimization implemented via a `useRef` cache keyed by content.

**Note:** This is a design constraint, not a behavioral requirement. The scenario below describes the expected behavior; verification requires code inspection or instrumentation (mocking `marked.parse()`).

#### Scenario: Parse result is reused
- **WHEN** the same markdown content is rendered across multiple renders
- **THEN** the cached result is returned without calling `marked.parse()` again (verifiable via code inspection or mocking)

### Requirement: Scroll methods must be guarded for non-interactive mode
The conversation panel SHALL guard `scrollToBottom()` and other scroll API calls with Ink's interactive mode detection (checking both `stdout.isTTY` and absence of CI environment). Scroll method calls are skipped in non-interactive environments without throwing errors.

#### Scenario: Scroll methods safe in non-interactive mode
- **WHEN** the TUI runs in a non-interactive environment (CI detected via `process.env.CI`, or `stdout.isTTY` is falsy)
- **THEN** scroll method calls are skipped without throwing errors

### Requirement: Streaming cursor must not be parsed as markdown
When rendering streaming assistant content (with the cursor character `\u2588` appended), the markdown parser SHALL not attempt to parse the cursor character. The streaming content must be stripped of the cursor character before being passed to the markdown parser.

#### Scenario: Streaming content renders without parser errors
- **WHEN** an assistant message is in streaming mode (cursor character `\u2588` appended to content)
- **THEN** the markdown parser receives content without the cursor character and produces valid output

#### Scenario: Streaming cursor is visible during rendering
- **WHEN** an assistant message is in streaming mode
- **THEN** the cursor character `\u2588` is visible at the end of the streamed content

### Requirement: MessageBubble memo must handle index shifts
The `MessageBubble` component's `areEqual` memo comparison SHALL use a stable identifier (e.g., message content hash or a unique message ID) rather than array index, to correctly handle re-renders when messages are filtered or reordered.

#### Scenario: Memo does not skip re-render after message filter
- **WHEN** streaming messages are filtered out (error case) and remaining messages shift indices
- **THEN** the memo comparison uses a stable identifier and does not incorrectly skip re-renders

### Requirement: InputPanel must have a stable key prop
The `InputPanel` component SHALL have a stable `key` prop assigned in its parent component (`app.js`) to ensure correct React reconciliation when the component is conditionally rendered.

#### Scenario: InputPanel reconciles correctly on focus toggle
- **WHEN** the input panel is shown/hidden or focus state changes
- **THEN** React correctly reconciles the component without warnings or state loss

### Requirement: Scroll API methods must use verified ink-scroll-view interface
All scroll API calls (`scrollToBottom`, `scrollBy`, `getContentHeight`, `getViewportHeight`, `remeasure`) SHALL use methods verified against the `ink-scroll-view` package API. The scroll ref must be checked for null before calling any method.

#### Scenario: Scroll methods called on valid ref
- **WHEN** scroll methods are invoked (auto-scroll, keyboard scroll, resize)
- **THEN** the scroll ref is verified as non-null before each method call

### Requirement: Dead code must be removed
All unused functions exported from TUI modules SHALL be removed to reduce maintenance debt.

#### Scenario: No dead code in inputPanel
- **WHEN** the codebase is audited
- **THEN** `renderBlink` and `getBlinkState` are not present in `inputPanel.js`

#### Scenario: No dead code in conversationPanel
- **WHEN** the codebase is audited
- **THEN** `handleScrollInput`, `handleResize`, `executeScrollInput`, `executeResize`, and `executeAutoScroll` are not present in `conversationPanel.js`
