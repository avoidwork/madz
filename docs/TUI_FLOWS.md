# TUI Code Flows

Call chains and component interactions for all primary code paths in the terminal UI.

## Table of Contents

- [Application Lifecycle](#application-lifecycle)
- [Banner Dismissal](#banner-dismissal)
- [Chat Message Flow (Streaming)](#chat-message-flow-streaming)
  - [Context Window Counting (`updateContextSize`)](#context-window-counting-updatecontextsize)
- [Command Parsing Flow](#command-parsing-flow)
- [Keyboard Input (useInput, app.js:282)](#keyboard-input-useinput-appjs282)
- [Conversation Panel Render](#conversation-panel-render)
- [Panel Navigation (Tab Cycles)](#panel-navigation-tab-cycles)
- [Input Panel](#input-panel)
- [Markdown Rendering](#markdown-rendering)
- [Scroll Input](#scroll-input)
- [Auto-Scroll](#auto-scroll)
- [Status Bar](#status-bar)
- [Error Handling](#error-handling)
- [File Dependencies](#file-dependencies)

## Application Lifecycle

**Entry:** `src/tui/index.js` → `export { default as App } from "./app.js"`

```
App({ config, registry, sessionState, dispatchProvider, scheduleManager, appInfo, onboarding, onSaveSession, gcManager, gcTrigger, contextEstimate })
├── useEffect: register process.on("uncaughtException", "unhandledRejection")
├── useInput: global key listener (key, input)
├── useWindowSize: { rows } for layout height
└── Render tree (view-routed):
    ├── OnboardingPanel (showOnboarding === true)
    ├── Banner (showBanner === true AND NOT showOnboarding)
    ├── ConversationArea (currentView === conversation AND NOT showOnboarding)
    │   ├── ConversationPanel (ScrollView + MessageBubble[])
    │   └── InputArea (StatusBar + InputPanel + FilePicker)
    ├── SkillsPanel | MemoryPanel | SettingsPanel | SessionsPanel | ProjectsPanel
    │   (currentView === skills | memories | settings | sessions | projects)
    └── Text("exit-newline")
```

**Note:** `scheduleManager`, `onboarding`, `onSaveSession`, `gcManager`, `gcTrigger`, and `contextEstimate` are additional props passed from `index.js` but not documented in the original flow diagram.

Mount order: state init → effects (error handlers) → input listener → window size → render.

---

## Banner Content

`src/tui/banner.js` defines `BANNER_ART` — ASCII ship art displayed at startup, plus `COMMAND_GROUPS` — categorized help commands:

```
BANNER_ART:
├── ASCII header graphic
├── APP_NAME + " — your terminal AI companion"
└── COMMAND_GROUPS listing:
    ├── Chat commands: (type a message and press Enter)
    ├── Navigation: arrow keys scroll conversation, Tab cycles panels
    ├── Command mode: /commands like /quit, /help, /provider
    └── Exit: press Enter on empty input sends message
```

Press any key (except Escape) to dismiss and begin using the app. Escape exits immediately.

---

## Banner Dismissal

```
User presses key (useInput callback, app.js:282)
├── key === escape && showBanner
│   └── App.handleQuit() → process.exit(0)
├── key !== escape && showBanner
│   └── setShowBanner(false)
│       └── Render re-evaluates:
│           ├── OnboardingPanel (if showOnboarding === true)
│           ├── Banner → ConversationPanel (if showBanner transitions)
│           ├── StatusBar (NOT showBanner AND NOT showOnboarding)
│           ├── InputPanel (showOnboarding OR NOT showBanner)
│           └── Text("exit-newline")
```

---

## Chat Message Flow (Streaming)

```
User presses Enter (useInput, app.js)
└── InputArea.handleSubmit(inputText)
    ├── track in chatHistory, clear input, call onSubmit(trimmed)
    └── App routes to ConversationArea.handleChat(text)
        ├── sessionState.addExchange({ role: "user", content: text })
        ├── updateContextSize(sessionState, config, [new HumanMessage(text)])
        │   └── passes the just-sent user message explicitly so the counter
        │       increments immediately (on the first turn the checkpointer
        │       doesn't have it yet, so sourcing from graph state would miss it)
        ├── streamingMsgId = messageList.addMessage("assistant", "", { streaming: true })
        ├── abortController = new AbortController(); isStreaming = true
        ├── dispatchProvider(text, provider, createStreamingHandler(...), signal)
        │   └── createStreamingHandler returns an async event handler:
        │       ├── event.type === "message"
        │       │   └── committedContent += event.text
        │       │   └── messageList.updateMessage(id, { segments: [{type:"message", content}],
        │       │       content: committedContent, streaming: true })
        │       ├── event.type === "reasoning"
        │       │   └── committedReasoning += event.text (sentence-boundary guarded)
        │       │   └── messageList.updateMessage(id, { segments: [{type:"reasoning", content}] })
        │       ├── event.type === "on_chat_model_stream"
        │       │   ├── chunk.content → message segment
        │       │   └── chunk.reasoning → reasoning segment
        │       ├── event.type === "on_tool_start"
        │       │   └── messageList.updateMessage(id, { activeToolCall: { name, input, status } })
        │       ├── event.type === "on_tool_end"
        │       │   └── append to toolCallDisplay, clear activeToolCall
        │       └── event.type === "on_tool_error"
        │           └── append error to toolCallDisplay, clear activeToolCall
        ├── await dispatchPromise
        ├── messageList.updateMessage(id, { streaming: false, content: committedContent })
        ├── sessionState.addExchange({ role: "assistant", content: responseContent })
        └── updateContextSize(sessionState, config)   // end-of-turn resync
```

### Context Window Counting (`updateContextSize`)

The status bar's `[▤ N]` context counter is maintained by `updateContextSize` in
`src/tui/conversationArea.js`. It is called at three points: immediately on the
user's send (with the just-sent message), during streaming (debounced, approximate),
and once at end-of-turn (accurate resync). The system prompt is not part of graph
state, so it is sourced separately and prepended to the counted messages.

```
updateContextSize(sessionState, config, messages?)
├── cancel any pending debounced update (contextUpdateTimerRef)
├── determine the message set to count:
│   ├── messages provided (e.g. [new HumanMessage(text)]) → use directly
│   └── else source from the real checkpointer:
│       ├── getContextMessages() → agent.getState(thread).values.messages
│       │   └── returns null on error → fall back to sessionState.getConversation()
│       └── fallback: sessionState.getConversation()
├── normalize every message via toLangChainMessage():
│   ├── already a BaseMessage (has _getType) → pass through
│   └── plain { role, content } → new HumanMessage / AIMessage / SystemMessage
│       (model.getNumTokensFromMessages calls _getType() on each message, so
│        hand-rolled plain objects crash — real LangChain objects are required)
├── prepend the system prompt: [new SystemMessage(systemPrompt), ...counted]
│   └── systemPrompt = SYSTEM_PROMPT + "\n\n---\n\n" + AGENTS.md (built by
│       createDeepAgentsOrchestrator, exposed via return { agent, model, systemPrompt }
│       and threaded index.js → app.js → ConversationArea)
├── totalTokens = model.getNumTokensFromMessages(counted).totalCount
├── totalTokens += maxTokens (output budget, matching token-budget middleware)
└── setContextSize(totalTokens); onContextChange(totalTokens)
```

**System prompt exposure:** `createDeepAgentsOrchestrator` (src/agent/deepAgents.js)
now returns `{ agent, model, systemPrompt }`. `index.js` destructures it and passes
`systemPrompt` (plus `getContextMessages` and `model`) into `App`, which threads them
into `ConversationArea`. `getContextMessages` reads the live LangChain message array
from the checkpointer via `agent.getState(thread).values.messages`, degrading to `null`
so the counter falls back to `sessionState.getConversation()` when the checkpointer is
unavailable.

**Streaming approximation:** during streaming, `createStreamingHandler` debounces a
token count of the committed content (via `model.getNumTokensFromMessages([new AIMessage(text)])`)
every ~33ms and reports `preStreamContextSize + cached.tokens`. This keeps the status bar
responsive; the end-of-turn `updateContextSize` call replaces it with an accurate recount.

Streaming re-renders: each `updateMessage` call triggers a `MessageList` re-render. `MessageBubble` is wrapped in `React.memo` (default shallow comparison) — streaming content is delivered via a pub/sub topic (`msg-{id}`), so only the active streaming message updates. `MessageList` keeps a stable `contentRef` so unchanged content keeps the same string reference across renders.

---

## Command Parsing Flow

```
User enters "/command ...", presses Enter (useInput)
└── InputArea.handleSubmit(inputText)
    ├── track in chatHistory, clear input, call onSubmit(trimmed)
    └── App routes to ConversationArea.handleCommand(trimmed)
        ├── parser.parse(trimmed, context)
        │   ├── trimmed.startsWith("/") → yes
        │   ├── parts = trimmed.slice(1).trim().split(/\s+/)
        │   │   ├── commandName = parts[0] (e.g., "quit")
        │   │   └── args = parts.slice(1)
        │   ├── handler = #dispatch.get(commandName)
        │   │   └── if found → handler(args, context)
        │   └── fallback: if commandName matches a discovered skill → { action: "skill", subAction: "invoke" }
        │       └── else → { action: "unknown" }
        └── dispatch on result.action:
            ├── "quit" → onQuit() → process.exit(0)
            ├── "new" → onNewSession()
            ├── "clear" → messageList.clear() + onStatusChange
            ├── "unknown" → onStatusChange(message)
            ├── "view" → onViewChange(value) (switch to a panel)
            ├── "project" + "clear" → reset active project, silent handleChat
            ├── "skill" + "invoke" → synthesize "Run the <skill> skill" prompt, silent handleChat
            └── else → addMessage({ role: "user", content: trimmed })
```

### Dispatch Table (CommandParser constructor)

| Command     | Subcommands              | Effect                           |
|-------------|--------------------------|----------------------------------|
| `/quit`     | —                        | `process.exit(0)`                |
| `/exit`     | —                        | `process.exit(0)` (alias)        |
| `/provider` | `set <name>`             | `sessionState.setProvider(name)` |
| `/config`   | `set <path> <value>`     | `setConfigValue(config, path, v)`|
| `/schedule` | `list`, `pause <n>`, `resume <n>`, `run-now <n>` | Schedule actions |
| `/projects` | `clear`                  | Open projects panel / clear active project |
| `/clear`    | —                        | Clear conversation messages      |
| `/new`      | —                        | Start a fresh session            |
| `/gc`       | `status`                 | Trigger V8 GC or show status     |
| `/help`     | —                        | Available commands message       |

**Note:** `/sessions`, `/memories`, `/skills`, `/settings`, and `/projects` are view-switching commands registered in the constructor that return `{ action: "view" }`. The actual registered commands are: quit, exit, provider, config, schedule, projects, clear, new, sessions, memories, skills, settings, help, gc.

---

## Keyboard Input (useInput, app.js)

```
useInput((input, key))
├── showOnboarding === true
│   ├── key.return && !key.shift → processOnboardingInput(inputAreaRef.getInputText())
│   └── key.escape → handleQuit()
├── showBanner === true
│   ├── key.escape → handleQuit() → process.exit(0)
│   └── else → setShowBanner(false) → fall through
├── currentView !== conversation → defer to active panel's own useInput({ isActive })
├── input === "\t" || key.tab → toggle inputFocused
├── file picker open (inputAreaRef.isPickerOpen()) → bail (picker owns keystrokes)
├── key.escape → conversationAreaRef.interrupt() (500ms debounce)
└── focus-aware routing:
    ├── inputFocused:
    │   ├── key.upArrow → inputAreaRef.navigateHistory("up")
    │   ├── key.downArrow → inputAreaRef.navigateHistory("down")
    │   └── printable input → inputAreaRef.insertText(input)
    └── !inputFocused:
        ├── key.upArrow → conversationAreaRef.scrollBy(-1)
        ├── key.downArrow → conversationAreaRef.scrollBy(1)
        ├── key.pageUp → conversationAreaRef.scrollBy(-viewportHeight)
        └── key.pageDown → conversationAreaRef.scrollBy(viewportHeight)
```

> **Note:** The `useInput` handler is a single global listener in `App`. It routes based on phase (onboarding, banner, panel view) and focus state. When the file picker is open, it owns all keystrokes and the app-level handler bails. Escape interrupts a running stream (via `conversationAreaRef.interrupt()`) rather than quitting the app — quitting is only via `/quit`, `/exit`, or Escape while the banner is showing.

---

## Conversation Panel Render

```
ConversationPanel({ messages, assistantName, messageListRef })
└── Thin wrapper delegating to MessageList (component-based store).
    ├── useEffect (mount only): if messages provided (session restore),
    │   └── panelRef.setMessages(messages)
    └── <Box flexDirection="column" flexGrow="1">
        └── <MessageList ref={panelRef} assistantName showToolResults scrollRef />
```

`MessageList` is the message store. It is a `React.memo`-wrapped `forwardRef` component that:
- Holds messages in a `Map` keyed by id (`dataRef`), with `contentRef` keeping stable string references for unchanged content.
- Exposes an imperative API via ref: `addMessage`, `updateMessage`, `getMessageData`, `getMessageCount`, `clear`, `setMessages`, `_triggerRender`.
- Renders each message as a `MessageBubble` inside a `ScrollView` (`ink-scroll-view`).

### Memo Guard: MessageBubble

`MessageBubble` is wrapped in `React.memo(MessageBubbleInner)` with **no custom `areEqual`** — it uses React's default shallow comparison of props. Streaming content updates are delivered via a pub/sub topic (`msg-{id}`) rather than prop updates, so the memo guard only needs to catch prop-level changes (role, content, time, reasoningContent, streaming, toolCallDisplay, activeToolCall, assistantName).

`MessageList` is likewise wrapped in `React.memo` around a `forwardRef` component, with a stable `contentRef` so unchanged message content keeps the same string reference across renders.

---

## Panel Navigation (Tab Cycles)

**Order:** `conversation` → `skills` → `memories` → `settings` → `sessions` → `projects` → `conversation` ...

**Note:** `OnboardingPanel` is rendered conditionally (when `showOnboarding === true`) and is NOT part of the tab cycling order. It runs its own internal state machine (INIT → ATTRACTOR → COLLECT → SAVE → TRANSCEND) before transitioning to the main app.

```
nextPanel(current):
└── order = ["conversation","skills","memories","settings","sessions","projects"]
    └── order[(order.indexOf(current) + 1) % order.length]

prevPanel(current):
└── order[(order.indexOf(current) - 1 + order.length) % order.length]
```

**Panel components:**

| Panel           | Component File          | Key Props              | State              |
|-----------------|-------------------------|------------------------|--------------------|
| Conversation    | conversationPanel.js    | `messages`, `assistantName`, `messageListRef` | messageListRef |
| Skills          | skillsPanel.js          | `skills[]`             | searchQuery, focusedSkill |
| Memory          | memoryPanel.js          | `entries[]`            | selectedEntry, focusIndex |
| Settings        | settingsPanel.js        | `configSections[]`     | focusIndex, selectedSection |
| Sessions        | sessionsPanel.js        | `sessions[]`           | selectedSession, focusIndex |
| Projects        | projectsPanel.js        | `cwd`                  | selectedProject, focusIndex |

Each panel (except Conversation) has its own internal `useInput` for arrow-key navigation. Panels are reached via the `/skills`, `/memories`, `/settings`, `/sessions`, and `/projects` commands (which return `{ action: "view" }`), or by cycling with Tab.

---

## Input Panel

`InputArea` owns all input and status state. It renders `StatusBar`, `InputPanel`, and (when the `@` trigger is active) `FilePicker`.

```
InputArea({ onSubmit, onFocus, onBlur, focus, skillCount, messageCountRef, showBanner,
            showOnboarding, initialValue, appInfo, tokenBudget, statusBar, cwd, activeProject })
├── handleSubmit(trimmed) → track in chatHistory, clear input, call onSubmit(trimmed)
├── navigateHistory("up" | "down") → walk chatHistory
├── isPickerOpen() → whether the `@` file picker is active
└── Render:
    ├── StatusBar (statusMessage, skillCount, messageCount, contextSize, tokenBudget,
    │              statusBar config, project, version, model, quote)
    ├── InputPanel (when picker closed) — ink-text-input wrapper
    └── FilePicker (when picker open) — fast-glob file autocomplete
```

`InputPanel` wraps `ink-text-input`:
```
InputPanel({ value, onChange, onSubmit, onFocus, onBlur, focus })
└── <TextInput value={value} onChange={onChange} onSubmit={onSubmit} focus={focus} />
    └── ink-text-input component:
        ├── handles keystroke accumulation
        ├── cursor navigation (arrow keys)
        ├── selection, Ctrl+W, Ctrl+U
        └── Enter → onSubmit(value)
```

Input state is owned by the component via controlled `value`/`onChange` props. App receives callbacks for submission and focus changes.

---

## Markdown Rendering

```
MarkdownText({ content }) [React.memo wrapper]
├── memo guard: prev.content === next.content → skip
└── MarkdownTextInner({ content }):
    ├── content null/undefined/"" → null
    └── <Text wrap="hard" color="white">
        └── parseMarkdown(content)
            └── marked.parse(content) [cached renderer]
                └── marked-terminal terminalRenderer
```

---

## Scroll Input

Scroll input is handled by `MessageList` (which owns the `ScrollView`), exposed via an imperative ref API on `ConversationArea`:

```
ConversationArea exposes scrollBy(delta) / scrollToBottom() via ref
└── MessageList.scrollBy(delta) → scrollRef.current.scrollBy(delta)
    ├── key.upArrow → scrollBy(-1)
    ├── key.downArrow → scrollBy(1)
    ├── key.pageUp → scrollBy(-viewportHeight)
    └── key.pageDown → scrollBy(viewportHeight)
```

---

## Auto-Scroll

Auto-scroll is driven by `ink-scroll-view`'s `onContentHeightChange` callback, not a manual content-hash tracker:

```
MessageList render cycle:
├── ScrollView onContentHeightChange:
│   ├── New content grows the viewport → scrollToBottom()
│   └── Streaming content grows → scrollToBottom()
├── Scroll-up suppression: when the user has scrolled up, new messages do NOT
│   force a scroll-to-bottom until they scroll back down.
└── Streaming content updates do NOT trigger a parent re-render — the scroll
    effect (onContentHeightChange) detects content growth and scrolls to bottom.
```

> **Note:** The former `executeAutoScroll`/`handleAutoScroll` content-hash tracker was replaced by `ink-scroll-view`'s `onContentHeightChange` callback. The imperative `scrollToBottom()` is disabled in favor of this callback-driven approach.

---

## Status Bar

```
StatusBar({ statusMessage, skillCount, messageCount, contextSize, isCompacting,
            version, model, quote, tokenCount, tokenBudget, statusBar, project }) [React.memo]
└── isStreaming = statusMessage === "Sending..." || statusMessage === "Streaming..."
└── Each element gated by the `statusBar` config toggles (model, skills, messages,
    context, tokens, quote, version, project).
└── <Box flexDirection="row" alignItems="center" justifyContent="flex-start">
    ├── <left>:
    │   ├── indicator: spinner (streaming) or "∙∙∙" (idle)
    │   ├── [model] (if statusBar.model)
    │   ├── [⚡skillCount] (if statusBar.skills)
    │   ├── [💬 messageCount] (if statusBar.messages)
    │   ├── [◣ contextSize] (if statusBar.context; red when compacting)
    │   ├── [💎 tokenCount/tokenBudget] (if statusBar.tokens && tokenBudget > 0)
    │   └── [projectName] (if statusBar.project && project set; shows subdir under projects/)
    └── <right> (marginLeft: auto): quote + version (if statusBar.version)
```

> **Note:** The status bar has no separate `statusMessage` text field in the current implementation — the streaming state is shown via the spinner/indicator, and the model/skill/message/context/token/project counts are rendered as bracketed segments. See [TUI.md](./TUI.md) §9 for the full element table.

---

## Error Handling

Error handling lives in the streaming dispatch path in `conversationArea.js`, not in a global `process.on` handler in `app.js`.

```
handleChat → dispatchProvider(...) → await dispatchPromise
└── catch (err):
    ├── err.name === "AbortError" (user interrupted):
    │   ├── sessionState.removeLastAssistantToolCallMessage()
    │   ├── sessionState.popExchange()
    │   └── onStatusChange("Interrupted.")
    └── else (stream/network error):
        ├── onSaveSession()
        ├── onStatusChange("Something went wrong")
        └── addMessage({ role: "system",
                         content: "I couldn't connect right now - {err.message}. Try sending your message again?" })
└── finally:
    ├── abortControllerRef.current = null
    └── isStreamingRef.current = false
```

Command errors are caught separately in `handleCommand`:
```
handleCommand → parser.parse(...)
└── catch (err):
    ├── addMessage({ role: "system", content: `Command error: ${err.message}` })
    └── onStatusChange("Something went wrong")
```

> **Note:** The former `process.on("uncaughtException")` / `process.on("unhandledRejection")` handlers in `app.js` were removed. Uncaught exceptions now surface through the streaming catch block or the process-level handler in `index.js`.

---

## File Dependencies

```
index.js ──┐
           ├── commandParser.js ── (pure class, no deps)
           ├── commandHelp.js ──── (help text for commands)
           ├── panels.js ──────── (pure functions, PANELS enum)
           ├── hooks.js ───────── (useWindowSize, useInput helpers)
           │
app.js ─────├── onboardingPanel.js (state machine: INIT → ATTRACTOR → COLLECT → SAVE → TRANSCEND)
           ├── banner.js (BANNER_ART, COMMAND_GROUPS)
           ├── conversationArea.js ──┐ (streaming handler, message state)
           ├── conversationPanel.js ─┤ (ScrollView + MessageBubble[]; uses ink-scroll-view)
           ├── inputArea.js ─────────┤ (owns input + status state; renders StatusBar + InputPanel + FilePicker)
           ├── inputPanel.js ────────┤ (ink-text-input wrapper)
           ├── statusBar.js ─────────┤ (status indicator, skill/message/context counts)
           ├── messageList.js ───────┤ (coalesces segments, memoized list)
           ├── messageBubble.js ─────┤ (role-colored bubble, markdown, tool display; React.memo)
           ├── markdownText.js ──────┘ (uses marked + marked-terminal)
           ├── filePicker.js ─────── (fast-glob file autocomplete, `@` trigger)
           ├── projectsPanel.js ──── (project directory selection)
           ├── sessionsPanel.js ──── (session browser)
           ├── skillsPanel.js ────── (skill list with search)
           ├── memoryPanel.js ────── (memory entries browser)
           ├── settingsPanel.js ──── (config sections editor)
           ├── contextTokens.js ──── (tiktoken token calculation)
           ├── quotes.js ─────────── (rotating quote lines)
           └── index.js ──────────── (re-exports App and panels)
```
