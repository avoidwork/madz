# TUI2: Terminal Interface Blueprint

*A design document for the new madz terminal interface. Grounded in the existing implementation (Ink
+ `ink-scroll-view` + structured logger), inspired by the best patterns of bitchx IRC client. The
core functionality stays the same — the new TUI renders it better.*

---

## 1. Philosophy

The interface is a terminal. Text flows in from the system, text flows out from the user. No panels,
no tabs, no switching. One scrollable output area, one input line.

The IRC layout is borrowed for its elegance: messages accumulate above, input sits at the bottom,
scrolling is natural. But the content is code, output, system responses — not conversation.

### Core Tenets

1. **Input is primary.** The user lives at the input line. The output area is secondary — read when
needed, scroll when needed.
2. **Output is a log.** System output, code output, agent responses — all flow into the same stream.
3. **Silence is the default.** The interface should feel like a quiet terminal — alive with output,
not noise.
4. **Batteries included, not scripts required.** Runtime customizations (toggles, formats, filters)
ship built-in. No config file editing needed for common changes.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  [14:23] Mads:  Hello, Jason.                                │
│  [14:24] System:  Build complete                               │
│  [14:25] Mads:  Here's the diff...                           │
│  ... (scrollable conversation) ...                             │
├─────────────────────────────────────────────────────────────┤
│  [●] Ready  | [⚡12] [💬42] [◣ 1.2k]                          │
├─────────────────────────────────────────────────────────────┤
│  > _                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
App (src/tui/app.js)
├── Banner / OnboardingPanel    — First-run experience
├── ConversationPanel           — ScrollView-based message display
│   └── ScrollView (ink-scroll-view)
│       └── MessageBubble[]     — Role-colored, markdown-rendered
├── StatusBar                   — Status indicator, skill/message/context counts
└── InputPanel                  — Text input with cursor display
```

No panels, no tabs, no switching. The interface is a single scrollable output area with one input
line.

### Key Dependencies

| Dependency | Role |
|------------|------|
| `ink` | TUI framework (Box, Text, useInput, useStdout, useWindowSize) |
| `ink-scroll-view` | Scrollable viewport (ScrollView, scrollToBottom, scrollBy, remeasure) |
| `pino` | Structured logger (dual-file: madz.log + madz_error.log) |

---

## 3. Scrolling & Viewport

The conversation area uses `ink-scroll-view`'s `ScrollView` component. This handles all viewport
management — no custom virtual scroll logic needed.

### How It Works

```jsx
// ConversationPanel wraps ScrollView around message bubbles
<ScrollView ref={scrollRef} key="scroll">
  {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
</ScrollView>
```

### Auto-Scroll Behavior

```
1. New message arrives → scrollToBottom() (deferred via setTimeout 0ms to allow React to commit)
2. Streaming content grows → scrollToBottom() (React re-render triggers scroll)
3. User scrolls up → stays where they are (no forced scroll)
4. Terminal resize → remeasure() called via stdout.on("resize")
```

### Scroll API (via ref)

|| Method | Purpose |
|--------|---------|
|| `scrollToBottom()` | Scroll to the end of content |
|| `scrollBy(delta)` | Scroll by N rows (positive = down, negative = up) |
|| `scrollTo(offset)` | Scroll to absolute position |
|| `scrollToTop()` | Scroll to offset 0 |
|| `remeasure()` | Re-measure viewport dimensions (call on terminal resize) |
|| `remeasureItem(index)` | Force re-measure of a specific child (useful for dynamic content) |
|| `getViewportHeight()` | Get visible row count |
|| `getScrollOffset()` | Get current scroll position |
|| `getContentHeight()` | Get total content height |
|| `getBottomOffset()` | Get scroll offset when at bottom |
|| `getItemHeight(index)` | Get measured height of a specific item |
|| `getItemPosition(index)` | Get position and height of a specific item |

### Keyboard Scrolling (when input is unfocused)

|| Key | Action |
|-----|--------|
|| Up arrow | `scrollBy(-1)` |
|| Down arrow | `scrollBy(1)` |
|| PageUp | `scrollBy(-viewportHeight)` |
|| PageDown | `scrollBy(viewportHeight)` |

### Controlled Mode

For advanced use cases (e.g., synchronizing multiple views), `ink-scroll-view` provides
`ControlledScrollView` which accepts a `scrollOffset` prop instead of managing state internally.

---

## 4. The Cursor

The cursor is managed by ink's `useCursor` hook, which provides `setCursorPosition` for
controlling cursor visibility and position. Passing `undefined` hides the cursor; passing a
`{x, y}` object shows it at the specified position.

### Configuration

```jsx
import { useCursor } from 'ink';

const { setCursorPosition } = useCursor();

// Hide cursor when input is unfocused
setCursorPosition(undefined);

// Show cursor at input position when focused
setCursorPosition({ x: stringWidth(prompt + text), y: 1 });
```

### Behavior

- **Input focused** — cursor shown at input position via `setCursorPosition({x, y})`
- **Input unfocused** — cursor hidden via `setCursorPosition(undefined)`
- **Blinking** — handled by the terminal emulator, not by Ink
- **Character** — sourced from `config.tui.cursorChar` (set via terminal escape sequences)

The TUI manages cursor visibility toggling based on input focus state. `useCursor` provides the
positioning primitive; the TUI decides when to show or hide.

---

## 5. Message Display

Messages are rendered as role-colored bubbles with markdown support, tool call display, and
reasoning content.

### Message Structure

```typescript
interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  time: string;              // HH:MM format
  streaming?: boolean;       // True while content is being streamed
  reasoningContent?: string; // Agent thinking (shown inline, truncated at 200 chars)
  activeToolCall?: { name: string };    // Currently running tool
  toolCallDisplay?: string;              // Completed tool calls (multi-line)
  toolCalls?: { name: string }[];        // Tool call history
  id?: string;               // Stable identifier for memoization
}
```

### Role-Based Styling

| Role | Label Color | Bubble Border | Alignment |
|------|------------|---------------|-----------|
| **user** | Green | Green | Right |
| **system** | Yellow | Yellow | Left |
| **assistant** | Cyan | Cyan | Left |

### Message Bubble Rendering

```
┌─────────────────────────────────────────┐
│ [14:23] Mads: Here's the code:          │
│                                           │
│ ```js                                     │
│ const x = 42;                             │
│ ```                                       │
│                                           │
│ - Tool: readFile (src/logger.js)          │
│ - Tool: patch (src/tui/app.js)            │
│                                           │
│ (thinking) Analyzing the request...       │
└─────────────────────────────────────────┘
```

### Memoization

`MessageBubble` uses `React.memo` with a custom `areEqual` function that compares display-relevant
fields (role, content, time, reasoningContent, streaming, toolCallDisplay, activeToolCall, id). This
prevents unnecessary re-renders of unchanged messages during streaming.

### Markdown Rendering

Assistant messages are rendered through `marked` + `marked-terminal`, which converts markdown to
ANSI terminal text. A module-level parse cache (`Map`) avoids reparsing identical content across
renders. The streaming cursor character (`█`) is stripped before parsing to avoid parser errors.

---

## 6. Runtime Configuration (Bitchx-Inspired)

Bitchx's `/toggle` command was legendary because it made common customizations instant — no config
file editing required. The TUI should ship with sensible defaults and built-in features for runtime
control. All TUI configuration lives in the `tui` section of `config.yaml`.

### TUI Configuration (config.yaml)

```yaml
tui:
  name: madz
  cursorChar: "█"
  autoScroll: true
  timestamps: true
  commandEcho: true
  cursorBreathe: true
  debugOutput: false
```

### Proposed: Toggle Commands

Toggle commands allow runtime overrides of the `config.yaml` defaults:

| Toggle | Default | Description |
|--------|---------|-------------|
| `autoScroll` | `true` | Auto-scroll to bottom on new messages |
| `timestamps` | `true` | Show timestamps on messages |
| `commandEcho` | `true` | Echo user commands to output |
| `cursorBreathe` | `true` | Enable breathing cursor model |
| `debugOutput` | `false` | Show debug-level messages |

Usage:
```
/toggle timestamps        → turns timestamps off
/toggle timestamps        → turns timestamps on (toggle)
/toggle                   → shows all toggles and their states
```

### Proposed: Format Customization

Bitchx's `/fset` allowed users to customize how every message type rendered. The TUI could adopt a
similar pattern:

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

### Proposed: Message Filtering

Bitchx had a sophisticated message-level system where you could filter what appeared in each window.
The TUI could adopt a similar pattern:

```
/level debug              → toggle debug messages on/off
/level                    → show active levels
/level all                → show all levels and their states
```

Available levels:
| Level | Description |
|-------|-------------|
| `user` | User messages |
| `assistant` | Agent responses |
| `system` | System notifications |
| `debug` | Debug/internal messages (hidden by default) |

> **YAGNI:** Message-level filtering adds significant complexity (parsing, persistence, UI indicators). Implement only if there is a clear, demonstrated need.

### Persistence

Runtime toggle overrides are stored in memory only. The `config.yaml` `tui` section is the source of
truth — changes to it take effect on restart. No separate `tui-config.json` file is needed.

---

## 7. Command Parser

Commands are parsed from input when Enter is pressed. The `CommandParser` class handles a dispatch
table of registered commands, with fallback to skill execution.

### Registered Commands

| Command | Behavior |
|---------|----------|
| `/quit` | Disconnect and exit |
| `/clear` | Clear conversation |
| `/new` | Start a new session |
| `/help` | Show available commands |
| `/config set <path> <value>` | Set a config value |
| `/provider set <name>` | Switch AI provider |
| `/schedule list` | List scheduled tasks |
| `/schedule pause <name>` | Pause a scheduled task |
| `/schedule resume <name>` | Resume a scheduled task |
| `/schedule run-now <name>` | Run a scheduled task immediately |
| `/gc` | Trigger V8 garbage collection |
| `/gc status` | Show GC status |

### Skill Execution

Unrecognized `/command` patterns that match a registered skill name are executed as skills:
```
/skillName [args]
```

The skill body (from `SKILL.md`) is loaded and streamed to the agent as a prompt, allowing the agent
to interpret and execute the skill instructions.

### Unknown Commands

```
/unknownCommand
→ "Unknown command: /unknownCommand. Type /help for available commands."
```

---

## 8. Interaction Model

### Keyboard Shortcuts

| Key | Action | Cursor |
|-----|--------|--------|
| Any character | Append to input | Visible |
| Enter | Submit command | Visible → Hidden (after submit) |
| Escape | Interrupt streaming / quit | Hidden |
| Tab | Toggle input focus | N/A |
| Up arrow (focused) | Scroll through command history | Visible |
| Down arrow (focused) | Scroll forward through history | Visible |
| Up arrow (unfocused) | Scroll output up | Hidden |
| Down arrow (unfocused) | Scroll output down | Hidden |
| PageUp (unfocused) | Scroll output up 1 page | Hidden |
| PageDown (unfocused) | Scroll output down 1 page | Hidden |

### Command History

The up/down arrows scroll through command history when the user is at the bottom of the output (not
scrolling the output itself). This is a terminal convention:

```
1. User presses Enter → command executes, output appears, auto-scroll active
2. User presses Up → scrolls through previous commands (not output)
3. User presses Down → scrolls forward through command history
4. User presses Up while scrolled up in output → scrolls output
```

**Note:** History is in-memory (`chatHistory` array). The structured logger (`src/logger.js`)
handles persistent logging of all interactions.

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

```
[●] Ready  | [⚡12] [💬42] [◣ 1.2k]
```

| Element | Content |
|---------|---------|
| Status indicator | `●` green (ready), `▶` yellow (streaming), `✖` red (error) |
| Status message | Current state ("Ready", "Streaming...", "Compacting context...") |
| Skill count | Number of registered skills |
| Message count | Total messages in conversation |
| Context size | Current conversation token count (human-readable: "1.2k", "15k") |

### Proposed Enhancement

Add toggle/filter indicators to the status bar:
```
[●] Ready  | [⚡12] [💬42] [◣ 1.2k]  [ts:1 scroll:1]
```

This gives the user a quick glance at which runtime features are active.

---

## 10. Edge Cases & Resilience

### Terminal Resize

```
1. Detect resize via stdout.on("resize")
2. Call scrollRef.current.remeasure() to update viewport dimensions
3. ink-scroll-view handles re-layout automatically
```

### Streaming Overflow

```
1. New message arrives during streaming
2. Content hash (messageCount + streamingContentLength) triggers re-evaluation
3. scrollToBottom() is deferred 0ms to allow ink-scroll-view's useLayoutEffect to complete
4. Previous content hash is tracked to avoid redundant scrolls
```

### Connection Loss

```
1. Error in dispatchProvider → catch block handles it
2. System message displayed: "I couldn't connect right now - {error}. Try sending your message
again?"
3. Streaming message is cleared from UI
4. Session is saved (onSaveSession callback)
```

### Model Stuck in Thinking Loop

```
1. Auto-continue circuit breaker tracks consecutive empty responses
2. After config.agent.autoContinueLimit (default 1000) empty responses:
   - Show error message
   - Reset counter
   - User must rephrase or start new session
```

### Output Retention

The conversation is managed by `sessionState` (not the TUI). The TUI renders whatever messages are
in its state array. Memory management (compaction, trimming) is handled by the session layer, not
the TUI.

---

## 11. Implementation Notes

### Ink-Specific Patterns

1. **`useStdout`** — For terminal resize events (call `remeasure()` on the scroll ref)
2. **`useInput`** — For keyboard handling (single handler in App component)
3. **`ScrollView` (ink-scroll-view)** — For scrollable conversation area
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

The current app uses React's built-in state (`useState`, `useRef`) rather than `useReducer`. This is
sufficient for the current scale. See Section 16 for proposed consolidation.

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
          → callReactAgent(agent, message, sessionConfig, callPrompt, streamingCallback, options)
            → LangGraph ReactAgent stream
              → streamingCallback(event) for each event type:
                  - "text" → append to committedContent, update message.content + █ cursor
                  - "reasoning" → append to committedReasoning, update message.reasoningContent
                  - "tool_start" → set message.activeToolCall
                  - "tool_end" → append to message.toolCallDisplay
                  - "tool_error" → append error to message.toolCallDisplay
                  - "compaction_start" / "compaction_end" → toggle isCompacting
```

### Streaming Callback

The `streamingCallback` is set up in `handleChat()` / `handleCommand()` and passed to
`dispatchProvider`. Each event type triggers a `setMessages()` call that clones the messages array
and mutates the last (streaming) message in place.

### Auto-Continue Circuit Breaker

If the agent returns zero text output, the TUI automatically sends a "Please continue." signal. This
repeats up to `config.agent.autoContinueLimit` (default 1000) times before triggering a circuit
breaker error. The counter resets as soon as any text output arrives. An `isAutoContinuingRef` flag
tracks whether the TUI is in auto-continue mode.

### Abort / Interrupt

The `Escape` key triggers `handleInterrupt()`, which:
1. Calls `abortControllerRef.current.abort()`
2. Sets `isStreamingRef.current = false`
3. Clears the streaming cursor from the last message
4. Awaits the `dispatchPromise` (which throws `AbortError` and is caught by the try/catch)
5. If interrupted during chat: pops the user message from sessionState, clears the partial assistant
message, deletes the checkpointer thread
6. If interrupted during skill: pops the user message, deletes the checkpointer thread

### Todo Queue Integration

The todo tool queue emits status events (`todo_status`) that flow through the LangGraph stream. The
TUI wires into this via `setTodoStreamingCallback()`, which updates `message.toolCallDisplay` with
todo status lines alongside tool call results.

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

The TUI calculates conversation tokens using `tiktoken` (with a character-count fallback). Both the
conversation and the system prompt are counted. The result is displayed in the status bar as a
human-readable size (e.g., "1.2k").

### GC Integration

When GC is enabled (`config.memory.gc.enabled !== false`), a `gcManager` is initialized in
`index.js`. The TUI receives `gcManager.onActivity` as a prop, which is called after each message
exchange to trigger idle GC. The `/gc` command allows manual triggering and status inspection.

---

## 14. Onboarding & Banner

### Banner

A BBS-style ASCII art banner displays on first launch. It shows command help grouped by category
(Chat, Command). Dismisses on any key press (Escape exits the app).

### Onboarding Panel

When no user profile exists, the onboarding flow activates:
1. `OnboardingPanel` renders with prompts from the onboarding instance
2. User responses are processed via `onboarding.processResponse()`
3. Progress is shown as `(current/total)`
4. On completion, the banner displays and normal conversation begins

---

## 15. Summary

This blueprint describes the madz terminal interface, grounded in the existing implementation. The
design is defined by four principles:

1. **Input is primary.** The user lives at the input line. Output is secondary.
2. **Silence is the default.** The interface should feel like a quiet terminal — alive with output,
not noise.
3. **Batteries included.** Runtime customizations (toggles, formats, filters) should ship built-in —
no config file editing required.
4. **The terminal is the window.** `ink-scroll-view` handles scrolling, Ink handles rendering, the
structured logger handles persistence.

The result is an interface that feels like a quiet terminal — present, alive, and ready for work.
Not a dashboard. Not a tool. A workspace.

---

## 16. Architectural Debt & Proposed Improvements

The current implementation works, but several structural decisions compound as the TUI grows. This
section documents known debt and proposed improvements for future refactoring.

### 16.1 State Management — `useReducer` over `useState`

The current `app.js` has eight independent `useState` calls with no coordination:

```typescript
const [messages, setMessages] = useState([]);
const [statusMessage, setStatusMessage] = useState("Ready");
const [chatHistory, setChatHistory] = useState([]);
const [historyIndex, setHistoryIndex] = useState(-1);
const [inputText, setInputText] = useState("");
const [inputFocused, setInputFocused] = useState(true);
const [contextSize, setContextSize] = useState(0);
const [isCompacting, setIsCompacting] = useState(false);
```

When a message arrives, you're updating `messages`, `statusMessage`, `contextSize`, and
`chatHistory` — all separate calls, all separate renders. Consolidate into a single `useReducer`
with a `TUIState` interface. One state tree, one render cycle per meaningful change.

### 16.2 Streaming Logic — Extract to Its Own Hook

The streaming callback is set up inline in `handleChat()` / `handleCommand()` and passed through
multiple layers. Extract into a `useStreaming()` hook that:

- Manages the `AbortController` lifecycle
- Translates stream events into state transitions
- Handles the auto-continue circuit breaker
- Exposes a clean `streamingState` object to the UI

Separates *how we stream* from *what we stream*.

### 16.3 File Structure — Group by Concern, Not by Component

The current flat 17-file layout works for now but doesn't scale. Proposed structure:

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

The `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js` files contradict the
blueprint's philosophy ("No panels, no tabs, no switching"). If Jason needs to inspect skills or
memory, those are commands (`/skills`, `/memory`) that produce output in the conversation stream —
not separate UI surfaces. The TUI should be one thing: a terminal.

### 16.5 Command Parser — Event-Driven, Not Switch-Driven

The current `commandParser.js` is a dispatch table. Make it more extensible — a command registry
where commands are registered as objects with `validate`, `execute`, and `help` properties. Adding a
new command is a registration, not a switch case edit.

### 16.6 What to Keep

- `ink-scroll-view` for scrolling — works well
- `React.memo` on MessageBubble — correct optimization
- The structured logger — dual-file pino is solid
- The `tiktoken` context token calculation — accurate
- The overall component hierarchy (App → ConversationPanel + StatusBar + InputPanel) — that part is right

### 16.7 What to Keep the Same

The *philosophy* — input is primary, output is a log, silence is the default. That's the right
mental model. It's the implementation scaffolding around it that should be reorganized.

---

*Design document. Reflects the current implementation and proposes compatible extensions.*
