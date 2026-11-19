# TUI: Terminal Interface Blueprint

*A design document for the madz terminal interface. Grounded in the existing implementation (Ink + a homegrown virtualized scroll view), inspired by the best patterns of bitchx IRC client. The core functionality stays the same — the new TUI renders it better.*

## What This Document Is

This is a **design blueprint** for the madz terminal interface. It describes the philosophy, the current implementation, and the proposed direction — including features that are imagined but not yet built.

**Who it's for:** Developers working on the TUI, and anyone who wants to understand how the terminal interface is structured. It assumes familiarity with React, Ink, and terminal UIs.

**How to read it:** Sections marked **Implemented** describe what exists in `src/tui/`. Sections marked **Proposed** describe features that may not be built yet — they are design intent, not a spec of current behavior. Sections marked **Debt** describe known architectural trade-offs and suggested refactors. When a section is not marked, treat it as a mix of current behavior and design intent; cross-check against the source before relying on it.

**Status legend:** `✅ Implemented` — live in the codebase. `🔶 Proposed` — design intent, not yet built. `⚠️ Debt` — known trade-off or suggested refactor.

---

## 1. Philosophy

The interface is a terminal. Text flows in from the system, text flows out from the user. No panels, no tabs, no switching. One scrollable output area, one input line.

> **Note:** "No panels, no tabs, no switching" is the **aspiration**, not the current state. The current implementation _does_ have a panel system (`skillsPanel`, `memoryPanel`, `settingsPanel`, `projectsPanel`, `sessionsPanel`, `subagentsPanel`) reachable via `/skills`, `/memories`, `/settings`, `/projects`, `/sessions`, `/subagents`. See §16 (Architectural Debt) for the proposal to remove them.

The IRC layout is borrowed for its elegance: messages accumulate above, input sits at the bottom, scrolling is natural. But the content is code, output, system responses — not conversation.

### Core Tenets

1. **Input is primary.** The user lives at the input line. The output area is secondary — read when needed, scroll when needed.
2. **Output is a log.** System output, code output, agent responses — all flow into the same stream.
3. **Silence is the default.** The interface should feel like a quiet terminal — alive with output, not noise.
4. **Batteries included, not scripts required.** Runtime customizations (toggles, formats, filters) ship built-in. No config file editing needed for common changes.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  [14:23] Mads:  Hello, Jason.                               │
│  [14:24] System:  Build complete                            │
│  [14:25] Mads:  Here's the diff...                          │
│  ... (scrollable conversation) ...                          │
├─────────────────────────────────────────────────────────────┤
│  ∙∙∙ [model] ∙ ⚡12 ∙ 💬42 ∙ ▋▋▋░░░░░░░ 30%                │
├─────────────────────────────────────────────────────────────┤
│  > _                                                        │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
App (src/tui/app.js)
├── MouseProvider / MouseGate      — terminal mouse reporting on/off
├── Banner / OnboardingPanel       — First-run experience
├── ConversationArea               — Streaming handler + message state
│   └── ConversationPanel          — Virtualized message display
│       └── MessageList            — Message store (Map keyed by id)
│           └── VirtualScrollView  — Homegrown virtualization (scrollView.js)
│               └── MessageBubble[] — Role-colored, markdown-rendered
├── InputArea                      — Owns input + status state
│   ├── StatusBar                  — Status indicator, model, skill/message/context counts
│   ├── InputPanel                 — Text input (ink-text-input)
│   ├── FilePicker                 — `@` file autocomplete (fast-glob)
│   └── CommandPicker              — `/` command autocomplete
└── Panel views (conditional)      — SkillsPanel, MemoryPanel, SettingsPanel,
                                     SessionsPanel, ProjectsPanel, SubagentsPanel
```

> **Note:** The current implementation uses `ConversationArea`/`InputArea` as the top-level containers, with `ConversationPanel`/`InputPanel`/`StatusBar`/`FilePicker`/`CommandPicker` nested inside. The panel views (`/skills`, `/memories`, `/settings`, `/sessions`, `/projects`, `/subagents`) are separate views, not part of the conversation view.

### Key Dependencies

| Dependency                   | Role                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `ink`                        | TUI framework (Box, Text, useInput, useStdout, useWindowSize, useBoxMetrics)   |
| `@ink-tools/ink-mouse`       | Terminal mouse reporting, click hit-testing (MouseProvider, useMouse, useOnClick) |
| `ink-text-input`             | Text entry (patched via `scripts/patch-ink-text-input.mjs`)                    |
| `ink-spinner`                | Streaming spinner in the status bar and pending message bubbles               |
| `ink-select-input`           | Selection input for panels                                                    |
| `fast-glob`                  | File autocomplete globbing (filePicker.js)                                    |
| `marked`                     | Markdown → HTML parsing (markdownText.js)                                     |
| `clipboardy`                 | Copy selected text to the system clipboard (drag selection)                   |
| `ansi-regex`                 | ANSI stripping for selection/link layout (selectionLayout.js)                 |

> **Note:** There is **no `ink-scroll-view`** dependency. Scrolling is handled by a homegrown `VirtualScrollView` in `src/tui/scrollView.js` built on Ink's `useBoxMetrics`. There is **no `marked-terminal`** and **no `tiktoken`** dependency — markdown is rendered via `marked` directly, and context token counting uses the model's `getNumTokensFromMessages` (see §12).

---

## 3. Scrolling & Viewport

The conversation area uses a **homegrown virtualized scroll view** (`src/tui/scrollView.js`), not `ink-scroll-view`. It renders only the visible window of items plus an overscan buffer, instead of mounting every item.

### How It Works

`VirtualScrollView` is a `React.memo`-wrapped `forwardRef` component that:

- Maintains a height map (`id → rows`) using measured heights for mounted items and estimated heights for off-window ones.
- Computes cumulative offsets and renders only the visible range plus overscan, using spacer boxes for the off-window regions to preserve the scroll position in estimated coordinate space.
- Measures each mounted item's real height via `useBoxMetrics` (the `MeasuredItem` wrapper), correcting the height map lazily as items scroll into view.
- Clamps the scroll offset at render time so the visible window always overlaps the content.

The pure function `computeVisibleRange(heights, viewportHeight, scrollOffset, overscan)` returns the inclusive index range `[start, end)` to mount, the cumulative offsets, and the total content height.

### Auto-Scroll Behavior

```
1. New message arrives → scrollToBottom() (via the imperative ref)
2. Streaming content grows → onRemeasure() forces a re-measure, which updates
   contentHeight and fires onContentHeightChange, which drives auto-scroll
3. User scrolls up → stays where they are (no forced scroll)
4. Terminal resize → remeasure() called via stdout.on("resize")
```

### Scroll API (via ref)

| Method                   | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `scrollTo(offset)`       | Scroll to an absolute offset (clamped to content bounds)          |
| `scrollBy(delta)`        | Scroll by N rows (positive = down, negative = up)                 |
| `scrollToTop()`          | Scroll to offset 0                                                |
| `scrollToBottom()`       | Scroll to the end of content                                      |
| `getScrollOffset()`      | Get current scroll offset                                         |
| `getContentHeight()`     | Get total content height                                          |
| `getViewportHeight()`    | Get visible row count                                             |
| `getBottomOffset()`      | Get scroll offset when at bottom                                  |
| `remeasure()`            | Force a re-render so mounted items re-measure via useBoxMetrics   |
| `remeasureItem(index)`   | Re-measure a specific item by global index                        |

### Keyboard and Mouse Scrolling

Mouse reporting is **on by default**: the mouse wheel scrolls the conversation, clicks expand collapsed tool/reasoning blocks and open markdown links, and drag selects text (copied via `clipboardy`). The input stays live for typing.

| Key        | Default mode                | Select mode (Tab)           |
| ---------- | --------------------------- | --------------------------- |
| Up arrow   | Input history (previous)    | `scrollBy(-1)`              |
| Down arrow | Input history (next)        | `scrollBy(1)`               |
| PageUp     | `scrollBy(-viewportHeight)` | `scrollBy(-viewportHeight)` |
| PageDown   | `scrollBy(viewportHeight)`  | `scrollBy(viewportHeight)`  |

**Select mode** is opt-in: Tab toggles it. Mouse reporting is turned off so the terminal handles drag-select and copy/paste natively. Any printable key, Tab, or Ctrl+F (search) exits select mode; the printable key is delivered to the input. The input stays visible in select mode so you can see where typed keys will land.

Mouse handling is implemented in `src/tui/useMouseScroll.js`, which parses SGR mouse sequences (`\x1b[<b;x;yM` / `\x1b[<b;x;ym`) directly from stdin. It distinguishes wheel events (button codes 64/65) from left-button drag selection (button code 0), and reports clicks (press+release on the same cell) for link opening.

---

## 4. The Cursor

The TUI does **not** use Ink's `useCursor`/`setCursorPosition` — there are zero matches in the codebase. Cursor handling is delegated to `ink-text-input` (patched via `scripts/patch-ink-text-input.mjs`), which manages its own cursor. The `CommandPicker` and `FilePicker` render their own manual cursor indicators (an inverse-video character at the cursor position) since they own keystrokes while open.

### Behavior

- **Default mode** — cursor shown by `ink-text-input` at the input position.
- **Select mode** — the input is unfocused (`focus: false`), so `ink-text-input` ignores keys; the cursor is effectively hidden.
- **Blinking** — handled by the terminal emulator, not by Ink.
- **Character** — the cursor character is managed by `ink-text-input`; there is no `config.tui.cursorChar` key.

---

## 5. Message Display

Messages are rendered as role-colored bubbles with markdown support, tool call display, and reasoning content.

### Message Structure

```typescript
interface Message {
	role: "user" | "assistant" | "system";
	content: string;
	time: string; // HH:MM format
	streaming?: boolean; // True while content is being streamed
	reasoningContent?: string; // Agent thinking (shown inline)
	activeToolCall?: { name: string }; // Currently running tool
	toolCallDisplay?: string; // Completed tool calls (multi-line)
	completedToolCalls?: { [name: string]: number }; // Tool call count map
	turnStartTime?: number; // Timestamp when the turn started
	turnDuration?: number; // Final elapsed time in ms when streaming ended
	segments?: { type: "message" | "reasoning" | "tool", content: string, name?: string, id?: string }[];
	id?: string; // Stable identifier for memoization
}
```

### Role-Based Styling

| Role          | Label Color | Bubble Border | Alignment |
| ------------- | ----------- | ------------- | --------- |
| **user**      | Green       | Gray (top/bottom) | `flex-start` |
| **system**    | Yellow      | —             | `flex-start` |
| **assistant** | Cyan        | —             | `flex-start` |

> **Note:** All roles are left-aligned (`flex-start`). The docs previously claimed `user` was right-aligned (`flex-end`) — that is incorrect. `getBubbleStyle` in `conversationPanel.js` returns `alignment: "flex-start"` for all three roles.

### Message Bubble Rendering

````
┌───────────────────────────────────────────┐
│ [14:23] Mads: Here's the code:            │
│                                           │
│ ```js                                     │
│ const x = 42;                             │
│ ```                                       │
│                                           │
│ 🔧 readFile →                            │
│   { "path": "src/logger.js" }             │
│                                           │
│ 💭 Thinking… →                           │
│   Analyzing the request...                │
│                                           │
│ ⚡ 2 tool calls: readFile, patch          │
│ ⏱  3.2s                                   │
└───────────────────────────────────────────┘
````

### Memoization

`MessageBubble` is wrapped in `React.memo(MessageBubbleInner)` with **no custom `areEqual`** — it uses React's default shallow comparison of props. Streaming content updates are delivered via a pub/sub topic (`msg-{id}`) rather than prop updates, so the memo guard only needs to catch prop-level changes (role, content, time, reasoningContent, streaming, toolCallDisplay, activeToolCall, assistantName). `MessageList` is likewise wrapped in `React.memo` around a `forwardRef` component, with a stable `contentRef` so unchanged message content keeps the same string reference across renders.

### Markdown Rendering

Assistant messages are rendered through `marked` (with a link-extraction pass in `markdownText.js`). A module-level parse cache avoids reparsing identical content across renders. The streaming cursor character is stripped before parsing to avoid parser errors.

---

## 6. Runtime Configuration (Bitchx-Inspired)

Bitchx's `/toggle` command was legendary because it made common customizations instant — no config file editing required. The TUI should ship with sensible defaults and built-in features for runtime control. All TUI configuration lives in the `tui` section of `config.yaml`.

### TUI Configuration (config.yaml)

```yaml
tui:
  name: madz
  overscan: 10
  mouseScrollLines: 1
  showToolResults: false
  reasoningCollapsed: true
  toolCallCollapsed: true
  statusBar:
    model: true
    skills: true
    messages: true
    context: true
    tokens: true
    quote: true
    version: true
    project: true
```

> **Note:** The real config keys are `overscan`, `mouseScrollLines`, `showToolResults`, `reasoningCollapsed`, `toolCallCollapsed`, and the `statusBar.*` booleans. The previously documented keys `cursorChar`, `autoScroll`, `timestamps`, `commandEcho`, `cursorBreathe`, and `debugOutput` **do not exist** in the schema (`src/config/schemas/tui.js`).

### 🔶 Proposed: Toggle Commands

> **Status: Proposed — not implemented.** The `/toggle` command does not exist in `commandParser.js`. This is design intent only.

Toggle commands would allow runtime overrides of the `config.yaml` defaults:

| Toggle          | Default | Description                           |
| --------------- | ------- | ------------------------------------- |
| `autoScroll`    | `true`  | Auto-scroll to bottom on new messages |
| `timestamps`    | `true`  | Show timestamps on messages           |
| `commandEcho`   | `true`  | Echo user commands to output          |
| `cursorBreathe` | `true`  | Enable breathing cursor model         |
| `debugOutput`   | `false` | Show debug-level messages             |

Usage:

```
/toggle timestamps        → turns timestamps off
/toggle timestamps        → turns timestamps on (toggle)
/toggle                   → shows all toggles and their states
```

### 🔶 Proposed: Format Customization

> **Status: Proposed — not implemented.** The `/format` command does not exist. This is design intent only.

Bitchx's `/fset` allowed users to customize how every message type rendered. The TUI could adopt a similar pattern:

```
/format system "[%T] %BSystem%n: %I%t%n"
/format error "[%T] %RError%n: %t"
/format agent "[%T] %CMads%n: %t"
```

Format specifiers:

- `%T` — timestamp (respects `timestamps` toggle)
- `%t` — text body
- `%B` — bold, `%n` — null color (reset)
- `%I` — italic, `%R` — red, `%C` — cyan, `%M` — magenta

> **YAGNI:** These format specifiers are speculative. Implement only if there is a clear, demonstrated need. Do not build a full format customization system without evidence that users will use it.

### 🔶 Proposed: Message Filtering

> **Status: Proposed — not implemented.** The `/level` command does not exist. This is design intent only.

Bitchx had a sophisticated message-level system where you could filter what appeared in each window. The TUI could adopt a similar pattern:

```
/level debug              → toggle debug messages on/off
/level                    → show active levels
/level all                → show all levels and their states
```

Available levels:

| Level       | Description                                 |
| ----------- | ------------------------------------------- |
| `user`      | User messages                               |
| `assistant` | Agent responses                             |
| `system`    | System notifications                        |
| `debug`     | Debug/internal messages (hidden by default) |

> **YAGNI:** Message-level filtering adds significant complexity (parsing, persistence, UI indicators). Implement only if there is a clear, demonstrated need.

### Persistence

Runtime toggle overrides are stored in memory only. The `config.yaml` `tui` section is the source of truth — changes to it take effect on restart. No separate `tui-config.json` file is needed.

---

## 7. Command Parser

Commands are parsed from input when Enter is pressed. The `CommandParser` class handles a dispatch table of registered commands, with fallback to skill execution.

### Registered Commands

| Command                      | Behavior                                             |
| ---------------------------- | ---------------------------------------------------- |
| `/quit`                      | Disconnect and exit                                  |
| `/exit`                      | Disconnect and exit (alias for `/quit`)              |
| `/clear`                     | Clear conversation                                   |
| `/new`                       | Start a new session                                  |
| `/help`                      | Show available commands                              |
| `/config set <path> <value>` | Set a config value                                   |
| `/provider set <name>`       | Switch AI provider                                   |
| `/schedule list`             | List scheduled tasks                                 |
| `/schedule pause <name>`     | Pause a scheduled task                               |
| `/schedule resume <name>`    | Resume a scheduled task                              |
| `/schedule run-now <name>`   | Run a scheduled task immediately                     |
| `/projects`                  | Open the projects panel (select a project directory) |
| `/projects clear`            | Clear the active project                             |
| `/gc`                        | Trigger V8 garbage collection                        |
| `/gc status`                 | Show GC status                                       |
| `/compact`                   | Compact the context window                           |
| `/sessions`                  | Open the sessions panel                              |
| `/memories`                  | Open the memories panel                              |
| `/skills`                    | Open the skills panel                                |
| `/subagents`                 | Open the subagents panel                             |
| `/settings`                  | Open the settings panel                              |

> **Note:** There are **16 registered commands** (quit, exit, provider, config, schedule, projects, clear, new, sessions, memories, skills, settings, subagents, help, gc, compact). The previously documented list of 14 was missing `/compact` and `/subagents`.

### Skill Execution

Unrecognized `/command` patterns that match a registered skill name are executed as skills:

```
/skillName [args]
```

The command parser falls back to the skill registry: if the command name matches a discovered skill, it returns a `skill` action that the conversation area routes through the **deepagents skill system** — the skill is invoked as a proper skill (with its metadata, permissions, and scripts), not by dumping the `SKILL.md` body as a chat prompt.

### Unknown Commands

```
/unknownCommand
→ "Unknown command: /unknownCommand. Type /help for available commands."
```

### Command Autocomplete

While typing a `/` command, a `CommandPicker` (`src/tui/commandPicker.js`) opens to suggest registered commands and skill names. It filters by substring match, shows a rotating window of up to 3 options, and owns all keystrokes while open (printable chars insert at cursor, backspace deletes, left/right move the cursor, up/down navigate, Enter selects, Escape closes).

---

## 8. Interaction Model

### Keyboard Shortcuts

| Key                         | Action                                                | Cursor                          |
| --------------------------- | ----------------------------------------------------- | ------------------------------- |
| Any character               | Append to input                                       | Visible                         |
| Enter                       | Submit command                                        | Visible → Hidden (after submit) |
| Escape                      | Interrupt streaming / quit                            | Hidden                          |
| Tab                         | Toggle select mode (mouse reporting off)              | N/A                             |
| Any character (select mode) | Exit select mode and append to input                  | Visible                         |
| Up arrow (default)          | Scroll through command history                        | Visible                         |
| Down arrow (default)        | Scroll forward through history                        | Visible                         |
| Up arrow (select mode)      | Scroll output up                                      | Hidden                          |
| Down arrow (select mode)    | Scroll output down                                    | Hidden                          |
| PageUp (both modes)         | Scroll output up 1 page                               | Unchanged                       |
| PageDown (both modes)       | Scroll output down 1 page                             | Unchanged                       |
| Ctrl+F                      | Toggle in-conversation search                         | N/A                             |
| Ctrl+R                      | Toggle reasoning block collapse/expand                | N/A                             |
| Ctrl+T                      | Toggle tool-call result block collapse/expand         | N/A                             |

### Command History

The up/down arrows scroll through command history when the user is at the bottom of the output (not scrolling the output itself). This is a terminal convention:

```
1. User presses Enter → command executes, output appears, auto-scroll active
2. User presses Up → scrolls through previous commands (not output)
3. User presses Down → scrolls forward through command history
4. User presses Up while scrolled up in output → scrolls output
```

**Note:** History is in-memory (`chatHistory` array). The structured logger (`src/shared/logger.js`) handles persistent logging of all interactions.

### Input Lifecycle

```
1. User presses key → cursor appears, input focused
2. User types → cursor follows text end
3. User presses Enter → command executed, output appended, input cleared, cursor fades
4. 2 seconds idle → cursor hidden (color transition to dark gray)
5. User presses key again → cycle repeats
```

---

## 9. Status Bar

The status bar displays connection status, system metrics, and contextual information.

### Current Implementation

The status bar is a single row with a left-aligned cluster of indicators and a right-aligned version/quote area. Each element can be toggled via the `tui.statusBar` config section (e.g., `statusBar.model: false` hides the model). Elements are separated by `∙` (middle dot) characters, and the context element renders a block-character utilization meter.

```
∙∙∙ [gpt-4o] ∙ ⚡12 ∙ 💬42 ∙ ▋▋▋░░░░░░░ 30% ∙ 💎 120/4.1k ∙ backend-api      quote text   v1.154.2
```

| Element          | Config toggle        | Content                                                                 |
| ---------------- | -------------------- | ----------------------------------------------------------------------- |
| Status indicator | —                    | `∙∙∙` (idle) or a spinner (streaming)                                   |
| Model            | `statusBar.model`    | The active model name, e.g. `[gpt-4o]`                                  |
| Skill count      | `statusBar.skills`   | Number of registered skills, `⚡12`                                     |
| Message count    | `statusBar.messages` | Total messages in conversation, `💬42`                                  |
| Context size     | `statusBar.context`  | Context utilization meter, `▋▋▋░░░░░░░ 30%` (or `1.2k` when no window)  |
| Token budget     | `statusBar.tokens`   | Rolling budget usage, `💎 120/4.1k` (only when `maxTokensMinute > 0`)   |
| Active project   | `statusBar.project`  | The active project name, `backend-api` (only when a project is set)     |
| Quote            | `statusBar.quote`    | A rotating quote line (right-aligned)                                   |
| Version          | `statusBar.version`  | App version (right-aligned)                                             |

> **Note:** The context element renders a block-character utilization meter (`▋▋▋░░░░░░░ 30%`) when a context window is configured, or a human-readable size (`1.2k`) when it is not. The `isStreaming` state is passed as a **direct prop** to `StatusBar`, not derived from a status message string. The `project` element is gated by `statusBar.project` and shows only the subdirectory name within `projects/`.

### 🔶 Proposed Enhancement

Add toggle/filter indicators to the status bar:

```
[●] Ready  | [⚡12] [💬42] [◣ 1.2k]  [ts:1 scroll:1]
```

> **Status: Proposed — not implemented.** The `[ts:1 scroll:1]` toggle indicators are design intent only.

This would give the user a quick glance at which runtime features are active.

---

## 10. Edge Cases & Resilience

### Terminal Resize

```
1. Detect resize via stdout.on("resize")
2. Call scrollRef.current.remeasure() to update viewport dimensions
3. VirtualScrollView re-layouts automatically
```

### Streaming Overflow

```
1. New message arrives during streaming
2. onRemeasure() forces a re-measure of the growing bubble
3. scrollToBottom() is deferred to allow the re-measure to complete
4. Previous content length is tracked to avoid redundant scrolls
```

### Connection Loss

```
1. Error in dispatchProvider → catch block handles it
2. System message displayed: "I couldn't connect right now - {error}. Try sending your message again?"
3. Streaming message is cleared from UI
4. Session is saved (onSaveSession callback)
```

### Output Retention

The conversation is managed by `sessionState` (not the TUI). The TUI renders whatever messages are in its state array. Memory management (compaction, trimming) is handled by the session layer, not the TUI.

---

## 11. Implementation Notes

### Ink-Specific Patterns

1. **`useBoxMetrics`** — For measuring rendered item heights in the virtualized scroll view
2. **`useInput`** — For keyboard handling (single handler in App component)
3. **`VirtualScrollView` (scrollView.js)** — For scrollable conversation area
4. **`React.memo`** — For MessageBubble optimization

### Key Patterns

```jsx
// Scroll to bottom with deferred timing
const scrollHandle = () => {
	if (scrollRef.current) {
		scrollRef.current.scrollToBottom();
	}
};
const timer = setTimeout(scrollHandle, 0);

// Terminal resize handling
useEffect(() => {
	const resizeHandler = () => {
		if (scrollRef.current && stdout.isTTY && !process.env.CI) {
			scrollRef.current.remeasure();
		}
	};
	stdout.on("resize", resizeHandler);
	return () => stdout.off("resize", resizeHandler);
}, [stdout, scrollRef]);

// Abort controller for streaming interruption
abortControllerRef.current = new AbortController();
// ...
abortControllerRef.current.abort();
```

### State Management

The current app uses React's built-in state (`useState`, `useRef`) rather than `useReducer`. This is sufficient for the current scale. See Section 16 for proposed consolidation.

---

## 12. Streaming Architecture

This section describes how the TUI wires into the AI agent's streaming pipeline.

### Data Flow

```
User Input (Enter)
  → App.handleSubmit()
    → App.handleChat() or App.handleCommand()
      → dispatchProvider(message, provider, streamingCallback, signal)
        → callProvider()
          → agent.stream(...)
            → streamingCallback(event) for each event type:
                - "message" → append to committedContent, update message content
                - "reasoning" → append to committedReasoning, update reasoning segment
                - "on_chat_model_stream" → chunk.content / chunk.reasoning
                - "on_tool_start" → set message.activeToolCall
                - "on_tool_end" → increment completedToolCalls
                - "tool" → append tool result segment
                - "on_tool_error" → set activeToolCall error state
                - "clarify" → surface a clarification question
                - "subagent_message" / "subagent_reasoning" / "subagent_tool" /
                  "subagent_tool_start" / "subagent_tool_end" → fold into subagent store
```

### Streaming Event Types

The streaming handler in `conversationArea.js` handles these event types:

| Event type                  | Segment / action produced                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `message`                   | `{ type: "message", content, id? }` — `id` set from `event.index`                                                  |
| `reasoning`                 | `{ type: "reasoning", content, id? }` — `id` set from `event.id`                                                   |
| `on_chat_model_stream`      | `chunk.content` → message segment; `chunk.reasoning` → reasoning segment (no `id`)                                  |
| `on_tool_start`             | Sets `activeToolCall` with `{ name, input, status: "running" }`                                                    |
| `on_tool_end`               | Increments `completedToolCalls[name]`, clears `activeToolCall`                                                     |
| `tool`                      | `{ type: "tool", content, name }` — rendered as a collapsible tool result block                                    |
| `on_tool_error`             | Sets `activeToolCall` with `{ name, error, status: "error" }`                                                      |
| `clarify`                   | Surfaces a clarification question, arms pending-clarify state                                                      |
| `subagent_message`          | Folded into the subagent store (message segment)                                                                   |
| `subagent_reasoning`        | Folded into the subagent store (reasoning segment)                                                                 |
| `subagent_tool`             | Folded into the subagent store (tool segment)                                                                      |
| `subagent_tool_start`       | Folded into the subagent store (running tool call)                                                                 |
| `subagent_tool_end`         | Folded into the subagent store (completed tool call)                                                               |

> **Note:** The previously documented event types `text`, `compaction_start`, `compaction_end`, and `todo_status` **do not exist** in the current streaming handler. The real types are `message`, `reasoning`, `on_chat_model_stream`, `on_tool_start`, `on_tool_end`, `tool`, `on_tool_error`, `clarify`, and the `subagent_*` family.

### Segment Coalescing

Streaming segments are coalesced in `src/tui/messages.js` (`coalesceSegments`). Message segments coalesce by block identity (`id`); reasoning segments coalesce with the last reasoning segment even if a message interleaved between chunks. See [STREAMING.md](./STREAMING.md) for the full behavior table.

### Abort / Interrupt

The `Escape` key triggers `handleInterrupt()`, which:

1. Calls `abortControllerRef.current.abort()`
2. Sets `isStreamingRef.current = false`
3. Clears the streaming cursor from the last message
4. Awaits the `dispatchPromise` (which throws `AbortError` and is caught by the try/catch)
5. If interrupted during chat: pops the user message from sessionState, clears the partial assistant message, deletes the checkpointer thread
6. If interrupted during skill: pops the user message, deletes the checkpointer thread

### Subagent Store

Subagent activity is folded into a dedicated store (`src/tui/subagentStore.js`) keyed by stream namespace, and rendered live in the SUBAGENTS panel (`src/tui/subagentsPanel.js`). Each subagent's reasoning/message segments and tool calls are kept separate from the main conversation.

---

## 13. Session & Persistence

### Session Lifecycle

```
1. index.js creates session via createSession()
2. SessionStateManager wraps the session state
3. App receives sessionState as a prop
4. On user message: sessionState.addExchange({ role: "user", content })
5. On agent response: sessionState.addExchange({ role: "assistant", content })
6. onSaveSession callback persists to memory/sessions/
```

### Context Token Calculation

The TUI calculates conversation tokens using the model's `getNumTokensFromMessages` (with a character-count fallback). Both the conversation and the system prompt are counted. The result is displayed in the status bar as a context utilization meter or a human-readable size.

### GC Integration

When GC is enabled (`config.memory.gc.enabled !== false`), a `gcManager` is initialized in `index.js`. The TUI receives `gcManager.onActivity` as a prop, which is called after each message exchange to trigger idle GC. The `/gc` command allows manual triggering and status inspection.

---

## 14. Onboarding & Banner

### Banner

A BBS-style ASCII art banner displays on first launch. It shows command help grouped by category (Chat, Command). Dismisses on any key press (Escape exits the app).

### Onboarding Panel

When no user profile exists, the onboarding flow activates:

1. `OnboardingPanel` renders with prompts from the onboarding instance
2. User responses are processed via `onboarding.processResponse()`
3. Progress is shown as `(current/total)`
4. On completion, the banner displays and normal conversation begins

---

## 15. Summary

This blueprint describes the madz terminal interface, grounded in the existing implementation. The design is defined by four principles:

1. **Input is primary.** The user lives at the input line. Output is secondary.
2. **Silence is the default.** The interface should feel like a quiet terminal — alive with output, not noise.
3. **Batteries included.** Runtime customizations (toggles, formats, filters) should ship built-in — no config file editing required.
4. **The terminal is the window.** The homegrown `VirtualScrollView` handles scrolling, Ink handles rendering, the structured logger handles persistence.

The result is an interface that feels like a quiet terminal — present, alive, and ready for work. Not a dashboard. Not a tool. A workspace.

---

## 16. ⚠️ Architectural Debt & Proposed Improvements

> **Status: Debt — documented trade-offs, not current behavior.** The recommendations in this section are not implemented. They describe how the TUI _could_ be reorganized, not how it _is_ organized.

The current implementation works, but several structural decisions compound as the TUI grows. This section documents known debt and proposed improvements for future refactoring.

### 16.1 State Management — `useReducer` over `useState`

The current `app.js` has fifteen independent `useState` calls with no coordination:

```typescript
const [showBanner, setShowBanner] = useState(true);
const [showOnboarding, setShowOnboarding] = useState(!!onboarding);
const [onboardingResponse, setOnboardingResponse] = useState(0);
const [selectMode, setSelectMode] = useState(false);
const [currentView, setCurrentView] = useState(PANELS.CONVERSATION);
const [pendingInput, setPendingInput] = useState("");
const [inputHistory, setInputHistory] = useState([]);
const [activeProject, setActiveProject] = useState("");
const [reasoningCollapsed, setReasoningCollapsed] = useState(true);
const [toolCallCollapsed, setToolCallCollapsed] = useState(true);
const [selection, setSelection] = useState(null);
const [searchMode, setSearchMode] = useState(false);
const [searchQuery, setSearchQuery] = useState("");
const [subagentStore, setSubagentStore] = useState({});
const [isStreaming, setIsStreaming] = useState(false);
```

When a message arrives, you're updating `messages`, `statusMessage`, `contextSize`, and `chatHistory` — all separate calls, all separate renders. Consolidate into a single `useReducer` with a `TUIState` interface. One state tree, one render cycle per meaningful change.

### 16.2 Streaming Logic — Extract to Its Own Hook

The streaming callback is set up inline in `handleChat()` / `handleCommand()` and passed through multiple layers. Extract into a `useStreaming()` hook that:

- Manages the `AbortController` lifecycle
- Translates stream events into state transitions
- Handles the auto-continue circuit breaker
- Exposes a clean `streamingState` object to the UI

Separates _how we stream_ from _what we stream_.

### 16.3 File Structure — Group by Concern, Not by Component

The current flat 36-file layout works for now but doesn't scale. Proposed structure:

```
src/tui/
├── app.js              # Root component, providers
├── state/
│   ├── reducer.js      # TUIState + all action types
│   ├── types.js        # Action type constants
│   └── selectors.js    # Derived state (contextSize, statusMessage, etc.)
├── hooks/
│   ├── useStreaming.js # AbortController, event transformation, auto-continue
│   ├── useScroll.js    # ScrollView ref, resize handling, keyboard scroll
│   ├── useInput.js     # Keyboard routing (scroll vs history vs input)
│   └── useCommand.js   # Command parsing + dispatch
├── components/
│   ├── ConversationPanel.js
│   ├── InputPanel.js
│   ├── StatusBar.js
│   ├── MessageBubble.js
│   └── Banner.js
├── panels/
│   ├── OnboardingPanel.js
│   └── (future panels, if any)
├── utils/
│   ├── commandParser.js
│   ├── contextTokens.js
│   ├── markdownText.js
│   └── format.js       # Format specifiers, toggle logic
└── index.js
```

Not dogma — predictability. When you're looking for streaming logic, you know exactly where to look.

### 16.4 Remove the Panel System Entirely

The `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js`, `subagentsPanel.js` files contradict the blueprint's philosophy ("No panels, no tabs, no switching"). If Jason needs to inspect skills or memory, those are commands (`/skills`, `/memories`) that produce output in the conversation stream — not separate UI surfaces. The TUI should be one thing: a terminal.

### 16.5 Command Parser — Event-Driven, Not Switch-Driven

The current `commandParser.js` is a dispatch table. Make it more extensible — a command registry where commands are registered as objects with `validate`, `execute`, and `help` properties. Adding a new command is a registration, not a switch case edit.

### 16.6 What to Keep

- The homegrown `VirtualScrollView` for scrolling — works well
- `React.memo` on MessageBubble — correct optimization
- The structured logger — dual-file pino is solid
- The model-based context token calculation — accurate
- The overall component hierarchy (App → ConversationPanel + StatusBar + InputPanel) — that part is right

### 16.7 What to Keep the Same

The _philosophy_ — input is primary, output is a log, silence is the default. That's the right mental model. It's the implementation scaffolding around it that should be reorganized.

---

## 17. Implementation Spec

This section provides the concrete types, interfaces, and patterns needed to implement the TUI.

### 17.1 State Shape

```typescript
interface TUIState {
	// Messages
	messages: Message[];
	chatHistory: string[];
	historyIndex: number;

	// Input
	inputText: string;
	selectMode: boolean;

	// Status
	statusMessage: string;
	contextSize: number;
	isCompacting: boolean;

	// Streaming
	isStreaming: boolean;

	// Scroll
	scrollOffset: number;
	viewportHeight: number;

	// Config overrides (runtime toggles)
	toggles: {
		autoScroll: boolean;
		timestamps: boolean;
		commandEcho: boolean;
		cursorBreathe: boolean;
		debugOutput: boolean;
	};
}

const initialState: TUIState = {
	messages: [],
	chatHistory: [],
	historyIndex: -1,
	inputText: "",
	selectMode: false,
	statusMessage: "Ready",
	contextSize: 0,
	isCompacting: false,
	isStreaming: false,
	scrollOffset: 0,
	viewportHeight: 0,
	toggles: {
		autoScroll: true,
		timestamps: true,
		commandEcho: true,
		cursorBreathe: true,
		debugOutput: false,
	},
};
```

### 17.2 Action Types

```typescript
type TUIAction =
	// Messages
	| { type: "ADD_MESSAGE"; message: Message }
	| { type: "UPDATE_MESSAGE"; id: string; updates: Partial<Message> }
	| { type: "CLEAR_MESSAGES" }
	| { type: "ADD_HISTORY"; text: string }
	| { type: "SET_HISTORY_INDEX"; index: number }

	// Input
	| { type: "SET_INPUT_TEXT"; text: string }
	| { type: "SUBMIT_INPUT" }
	| { type: "SET_INPUT_FOCUSED"; focused: boolean }

	// Status
	| { type: "SET_STATUS"; message: string }
	| { type: "SET_CONTEXT_SIZE"; size: number }
	| { type: "SET_COMPACTING"; compacting: boolean }

	// Streaming
	| { type: "SET_STREAMING"; streaming: boolean }
	| { type: "SET_AUTO_CONTINUING"; autoContinuing: boolean }
	| { type: "INCREMENT_AUTO_CONTINUE" }
	| { type: "RESET_AUTO_CONTINUE" }

	// Scroll
	| { type: "SET_SCROLL_OFFSET"; offset: number }
	| { type: "SET_VIEWPORT_HEIGHT"; height: number }

	// Config
	| { type: "TOGGLE_CONFIG"; key: keyof TUIState["toggles"] }
	| { type: "SET_CONFIG"; updates: Partial<TUIState["toggles"]> };
```

### 17.3 Command Registry Schema

```typescript
interface Command {
	name: string;
	description: string;
	usage: string;
	validate: (args: string[]) => boolean | string; // returns error message on failure
	execute: (
		args: string[],
		state: TUIState,
		dispatch: React.Dispatch<TUIAction>,
		helpers: CommandHelpers,
	) => Promise<void> | void;
}

interface CommandHelpers {
	dispatchProvider: (
		message: string,
		provider: string,
		streamingCallback: StreamingCallback,
		signal: AbortSignal,
	) => Promise<void>;
	sessionState: SessionStateManager;
	config: Config;
	scrollRef: React.RefObject<ScrollViewRef>;
}

// Registration
const commands: Record<string, Command> = {
	quit: {
		name: "quit",
		description: "Disconnect and exit",
		usage: "/quit",
		validate: () => true,
		execute: async () => {
			/* ... */
		},
	},
	// ... more commands
};
```

### 17.4 Streaming Callback Transformation

```typescript
type StreamEventType =
	| "message"
	| "reasoning"
	| "on_chat_model_stream"
	| "on_tool_start"
	| "on_tool_end"
	| "tool"
	| "on_tool_error"
	| "clarify"
	| "subagent_message"
	| "subagent_reasoning"
	| "subagent_tool"
	| "subagent_tool_start"
	| "subagent_tool_end";

interface StreamingCallback {
	(event: StreamEvent): void;
}

interface StreamEvent {
	type: StreamEventType;
	content?: string; // for 'message', 'reasoning', 'tool'
	name?: string; // for tool events
	error?: string; // for 'on_tool_error'
	index?: number; // content-block index for 'message'
	id?: string; // block id for 'reasoning'
	data?: any; // raw event payload
}
```

### 17.5 File Structure

```
src/tui/
├── app.js                    # Root component, providers, reducer
├── state/
│   ├── reducer.js            # useReducer implementation, all action handlers
│   ├── types.js              # TUIState, TUIAction, Message interfaces
│   └── selectors.js          # Derived state (contextSize, statusMessage, etc.)
├── hooks/
│   ├── useStreaming.js       # AbortController, event transformation, auto-continue
│   ├── useScroll.js          # ScrollView ref, resize handling, keyboard scroll
│   ├── useInput.js           # Keyboard routing (scroll vs history vs input)
│   └── useCommand.js         # Command parsing + dispatch
├── components/
│   ├── ConversationPanel.js  # ScrollView + MessageBubble[]
│   ├── InputPanel.js         # Text input with cursor
│   ├── StatusBar.js          # Status indicator, metrics
│   ├── MessageBubble.js      # Role-colored, markdown-rendered
│   └── Banner.js             # ASCII art banner
├── panels/
│   └── OnboardingPanel.js    # First-run onboarding flow
├── utils/
│   ├── commandParser.js      # Command registry, dispatch table
│   ├── contextTokens.js      # Model-based token calculation
│   ├── markdownText.js       # marked rendering
│   └── format.js             # Format specifiers, toggle logic
└── index.js                  # Entry point, render()
```

### 17.6 Test Strategy

**Unit tests** (`tests/unit/tui/`):

- `reducer.test.js` — All action types, edge cases (empty state, concurrent updates)
- `commandParser.test.js` — Command validation, execution, unknown commands
- `contextTokens.test.js` — Model-based token calculation, character-count fallback
- `markdownText.test.js` — Markdown rendering, streaming cursor stripping, cache behavior
- `useStreaming.test.js` — Event transformation, auto-continue circuit breaker, abort handling

**Integration tests** (`tests/integration/tui/`):

- `full-flow.test.js` — User input → streaming → message display → command execution

**Mocking**:

- `dispatchProvider` — Mock with resolved promise, configurable streaming events
- `marked` — Mock with plain text output
- `@ink-tools/ink-mouse` — Mock MouseProvider/useMouse hooks
- `VirtualScrollView` — Mock ref with no-op methods

**Coverage**: 100% on all new files. Existing files maintain current coverage.

---

## References

### Libraries

- **[Ink](https://github.com/vadimdemedes/ink)** — React for CLIs. [README](https://raw.githubusercontent.com/vadimdemedes/ink/refs/heads/master/readme.md)
- **[@ink-tools/ink-mouse](https://github.com/ink-tools/ink-mouse)** — Terminal mouse reporting and click hit-testing

---

_Blueprint for the madz terminal interface. Grounded in the existing implementation and the homegrown VirtualScrollView + Ink libraries._
