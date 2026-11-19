# TUI Code Flows

Call chains and component interactions for all primary code paths in the terminal UI.

## Table of Contents

- [Application Lifecycle](#application-lifecycle)
- [Banner Dismissal](#banner-dismissal)
- [Chat Message Flow (Streaming)](#chat-message-flow-streaming)
  - [Context Window Counting (`updateContextSize`)](#context-window-counting-updatecontextsize)
- [Command Parsing Flow](#command-parsing-flow)
- [Keyboard Input (useInput, app.js)](#keyboard-input-useinput-appjs)
- [Conversation Panel Render](#conversation-panel-render)
- [Panel Navigation (Tab Cycles)](#panel-navigation-tab-cycles)
- [Input Panel](#input-panel)
- [Markdown Rendering](#markdown-rendering)
- [Scroll Input](#scroll-input)
- [Auto-Scroll](#auto-scroll)
- [Status Bar](#status-bar)
- [Mouse & Selection Layer](#mouse--selection-layer)
- [Error Handling](#error-handling)
- [File Dependencies](#file-dependencies)

## Application Lifecycle

**Entry:** `src/tui/index.js` → `export { default as App } from "./app.js"`

```
App({ config, registry, sessionState, dispatchProvider, resumeProvider, scheduleManager,
      appInfo, authPrompt, onboarding, onSaveSession, gcManager, gcTrigger, compactContext,
      getContextMessages, model, systemPrompt, contextLength })
├── useState: showBanner, showOnboarding, onboardingResponse, selectMode, currentView,
│   pendingInput, inputHistory, activeProject, reasoningCollapsed, toolCallCollapsed,
│   selection, searchMode, searchQuery, subagentStore, isStreaming (15 useState calls)
├── useInput: global key listener (key, input)
├── useWindowSize: { rows, columns } for layout height
├── useMouseScroll: mouse-wheel scrolling, drag selection, link clicks
└── Render tree (view-routed):
    ├── OnboardingPanel (showOnboarding === true)
    ├── Banner (showBanner === true AND NOT showOnboarding)
    ├── ConversationArea (currentView === conversation AND NOT showOnboarding)
    │   ├── ConversationPanel (VirtualScrollView + MessageBubble[])
    │   └── InputArea (StatusBar + InputPanel + FilePicker + CommandPicker)
    ├── SkillsPanel | MemoryPanel | SettingsPanel | SessionsPanel | ProjectsPanel | SubagentsPanel
    │   (currentView === skills | memories | settings | sessions | projects | subagents)
    └── InputArea (currentView === conversation OR showOnboarding)
```

**Note:** `resumeProvider`, `authPrompt`, `compactContext`, `getContextMessages`, `model`, `systemPrompt`, and `contextLength` are additional props passed from `index.js` but not documented in the original flow diagram.

Mount order: state init → effects (Copilot auth, staged messages) → input listener → window size → render.

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
User presses key (useInput callback, app.js)
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
        │       │   └── increment completedToolCalls[name], clear activeToolCall
        │       ├── event.type === "tool"
        │       │   └── append tool result segment (collapsible block)
        │       ├── event.type === "on_tool_error"
        │       │   └── set activeToolCall error state
        │       ├── event.type === "clarify"
        │       │   └── surface question, arm pending-clarify state
        │       └── event.type === "subagent_message" | "subagent_reasoning" |
        │           "subagent_tool" | "subagent_tool_start" | "subagent_tool_end"
        │           └── onSubagentUpdate(event) → fold into subagent store
        ├── await dispatchPromise
        ├── messageList.updateMessage(id, { streaming: false, content: committedContent })
        ├── sessionState.addExchange({ role: "assistant", content: responseContent })
        └── updateContextSize(sessionState, config)   // end-of-turn resync
```

### Context Window Counting (`updateContextSize`)

The status bar's context counter is maintained by `updateContextSize` in `src/tui/conversationArea.js`. It is called at three points: immediately on the user's send (with the just-sent message), during streaming (debounced, approximate), and once at end-of-turn (accurate resync). The system prompt is not part of graph state, so it is sourced separately and prepended to the counted messages.

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

**System prompt exposure:** `createDeepAgentsOrchestrator` (src/agent/deepAgents.js) now returns `{ agent, model, systemPrompt }`. `index.js` destructures it and passes `systemPrompt` (plus `getContextMessages` and `model`) into `App`, which threads them into `ConversationArea`. `getContextMessages` reads the live LangChain message array from the checkpointer via `agent.getState(thread).values.messages`, degrading to `null` so the counter falls back to `sessionState.getConversation()` when the checkpointer is unavailable.

**Streaming approximation:** during streaming, `createStreamingHandler` debounces a token count of the committed content (via `model.getNumTokensFromMessages([new AIMessage(text)])`) every ~33ms and reports `preStreamContextSize + cached.tokens`. This keeps the status bar responsive; the end-of-turn `updateContextSize` call replaces it with an accurate recount.

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
            ├── "compact" → compact the context window
            ├── "skill" + "invoke" → synthesize "Run the <skill> skill" prompt, silent handleChat
            └── else → addMessage({ role: "user", content: trimmed })
```

### Dispatch Table (CommandParser constructor)

| Command     | Subcommands                                      | Effect                                     |
| ----------- | ------------------------------------------------ | ------------------------------------------ |
| `/quit`     | —                                                | `process.exit(0)`                          |
| `/exit`     | —                                                | `process.exit(0)` (alias)                  |
| `/provider` | `set <name>`                                     | `sessionState.setProvider(name)`           |
| `/config`   | `set <path> <value>`                             | `setConfigValue(config, path, v)`          |
| `/schedule` | `list`, `pause <n>`, `resume <n>`, `run-now <n>` | Schedule actions                           |
| `/projects` | `clear`                                          | Open projects panel / clear active project |
| `/clear`    | —                                                | Clear conversation messages                |
| `/new`      | —                                                | Start a fresh session                      |
| `/gc`       | `status`                                         | Trigger V8 GC or show status               |
| `/compact`  | —                                                | Compact the context window                 |
| `/help`     | —                                                | Available commands message                 |

**Note:** `/sessions`, `/memories`, `/skills`, `/settings`, `/subagents`, and `/projects` are view-switching commands registered in the constructor that return `{ action: "view" }`. The actual registered commands are: quit, exit, provider, config, schedule, projects, clear, new, sessions, memories, skills, settings, subagents, help, gc, compact (16 total).

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
├── key.ctrl && input === "r" → toggle reasoningCollapsed, scroll active view to bottom
├── key.ctrl && input === "t" → toggle toolCallCollapsed, scroll active view to bottom
├── currentView !== conversation → defer to active panel's own useInput({ isActive })
├── input === "\t" || key.tab → toggle selectMode
├── file picker open (inputAreaRef.isPickerOpen()) → bail (picker owns keystrokes)
├── key.ctrl && input === "f" → toggle searchMode
├── searchMode && key.escape → exit search mode
├── key.escape → conversationAreaRef.interrupt() (500ms debounce)
├── searchMode && key.return → searchNext / searchPrev
├── selectMode && printable input → exit select mode, inputAreaRef.appendInput(input)
└── mode-aware routing:
    ├── key.pageUp / key.pageDown → conversationAreaRef.scrollBy(∓viewportHeight) (both modes)
    ├── default mode:
    │   ├── key.upArrow → inputAreaRef.navigateHistory("up")
    │   └── key.downArrow → inputAreaRef.navigateHistory("down")
    └── selectMode:
        ├── key.upArrow → conversationAreaRef.scrollBy(-1)
        └── key.downArrow → conversationAreaRef.scrollBy(1)
```

> **Note:** The `useInput` handler is a single global listener in `App`. It routes based on phase (onboarding, banner, panel view) and focus state. When the file picker is open, it owns all keystrokes and the app-level handler bails. Escape interrupts a running stream (via `conversationAreaRef.interrupt()`) rather than quitting the app — quitting is only via `/quit`, `/exit`, or Escape while the banner is showing.

---

## Conversation Panel Render

```
ConversationPanel({ messages, assistantName, messageListRef, showToolResults, overscan,
                    scrollRef, selection, reasoningCollapsed, toolCallCollapsed })
└── Thin wrapper delegating to MessageList (component-based store).
    ├── useEffect (mount only): if messages provided (session restore),
    │   └── panelRef.setMessages(messages)
    └── <Box flexDirection="column" flexGrow="1">
        └── <MessageList ref={panelRef} assistantName showToolResults overscan scrollRef />
```

`MessageList` is the message store. It is a `React.memo`-wrapped `forwardRef` component that:

- Holds messages in a `Map` keyed by id (`dataRef`), with `contentRef` keeping stable string references for unchanged content.
- Exposes an imperative API via ref: `addMessage`, `updateMessage`, `getMessageData`, `getMessageCount`, `clear`, `setMessages`, `_triggerRender`.
- Renders each message as a `MessageBubble` inside a `VirtualScrollView` (`src/tui/scrollView.js`).

### Memo Guard: MessageBubble

`MessageBubble` is wrapped in `React.memo(MessageBubbleInner)` with **no custom `areEqual`** — it uses React's default shallow comparison of props. Streaming content updates are delivered via a pub/sub topic (`msg-{id}`) rather than prop updates, so the memo guard only needs to catch prop-level changes (role, content, time, reasoningContent, streaming, toolCallDisplay, activeToolCall, assistantName).

`MessageList` is likewise wrapped in `React.memo` around a `forwardRef` component, with a stable `contentRef` so unchanged message content keeps the same string reference across renders.

---

## Panel Navigation (Tab Cycles)

**Order:** `conversation` → `skills` → `memories` → `settings` → `sessions` → `projects` → `subagents` → `conversation` ...

**Note:** `OnboardingPanel` is rendered conditionally (when `showOnboarding === true`) and is NOT part of the tab cycling order. It runs its own internal state machine (INIT → ATTRACTOR → COLLECT → SAVE → TRANSCEND) before transitioning to the main app.

```
nextPanel(current):
└── order = ["conversation","skills","memories","settings","sessions","projects","subagents"]
    └── order[(order.indexOf(current) + 1) % order.length]

prevPanel(current):
└── order[(order.indexOf(current) - 1 + order.length) % order.length]
```

**Panel components:**

| Panel        | Component File       | Key Props                                     | State                       |
| ------------ | -------------------- | --------------------------------------------- | --------------------------- |
| Conversation | conversationPanel.js | `messages`, `assistantName`, `messageListRef` | messageListRef              |
| Skills       | skillsPanel.js       | `skills[]`                                    | searchQuery, focusedSkill   |
| Memory       | memoryPanel.js       | `entries[]`                                   | selectedEntry, focusIndex   |
| Settings     | settingsPanel.js     | `configSections[]`                            | focusIndex, selectedSection |
| Sessions     | sessionsPanel.js     | `sessions[]`                                  | selectedSession, focusIndex |
| Projects     | projectsPanel.js     | `cwd`                                         | selectedProject, focusIndex |
| Subagents    | subagentsPanel.js    | `subagentStore`                               | selectedSubagent, focusIndex |

Each panel (except Conversation) has its own internal `useInput` for arrow-key navigation. Panels are reached via the `/skills`, `/memories`, `/settings`, `/sessions`, `/projects`, and `/subagents` commands (which return `{ action: "view" }`), or by cycling with Tab.

---

## Input Panel

`InputArea` owns all input and status state. It renders `StatusBar`, `InputPanel`, and (when the `@` trigger is active) `FilePicker`, and (when the `/` trigger is active) `CommandPicker`.

```
InputArea({ onSubmit, onFocus, onBlur, focus, skillCount, messageCountRef, showBanner,
            showOnboarding, initialValue, appInfo, tokenBudget, statusBar, cwd, activeProject,
            searchMode, searchQuery, commandList, isStreaming })
├── handleSubmit(trimmed) → track in chatHistory, clear input, call onSubmit(trimmed)
├── navigateHistory("up" | "down") → walk chatHistory
├── isPickerOpen() → whether the `@` file picker is active
└── Render:
    ├── StatusBar (statusMessage, skillCount, messageCount, contextSize, tokenBudget,
    │              statusBar config, project, version, model, quote)
    ├── InputPanel (when picker closed) — ink-text-input wrapper
    ├── FilePicker (when picker open) — fast-glob file autocomplete
    └── CommandPicker (when `/` trigger active) — command autocomplete
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
```

> **Note:** Markdown is rendered via `marked` directly. There is no `marked-terminal` dependency. `markdownText.js` also exposes `parseMarkdownWithLinks` for link hit-testing.

---

## Scroll Input

Scroll input is handled by `MessageList` (which owns the `VirtualScrollView`), exposed via an imperative ref API on `ConversationArea`:

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

Auto-scroll is driven by `VirtualScrollView`'s `onContentHeightChange` callback, not a manual content-hash tracker:

```
MessageList render cycle:
├── VirtualScrollView onContentHeightChange:
│   ├── New content grows the viewport → scrollToBottom()
│   └── Streaming content grows → scrollToBottom()
├── Scroll-up suppression: when the user has scrolled up, new messages do NOT
│   force a scroll-to-bottom until they scroll back down.
└── Streaming content updates do NOT trigger a parent re-render — the scroll
    effect (onContentHeightChange) detects content growth and scrolls to bottom.
```

> **Note:** The former `executeAutoScroll`/`handleAutoScroll` content-hash tracker was replaced by `VirtualScrollView`'s `onContentHeightChange` callback. The imperative `scrollToBottom()` is disabled in favor of this callback-driven approach.

---

## Status Bar

```
StatusBar({ isStreaming, skillCount, messageCount, contextSize, isCompacting,
            version, model, quote, tokenCount, tokenBudget, contextWindow,
            compactFraction, statusBar, project }) [React.memo]
├── isStreaming is a direct prop (not derived from a status message string)
├── Each element gated by the `statusBar` config toggles (model, skills, messages,
│   context, tokens, quote, version, project).
├── <Box flexDirection="row" alignItems="center" justifyContent="flex-start">
    ├── <left>:
    │   ├── indicator: spinner (streaming) or "∙∙∙" (idle)
    │   ├── model (if statusBar.model)
    │   ├── ∙ ⚡skillCount (if statusBar.skills)
    │   ├── ∙ 💬 messageCount (if statusBar.messages)
    │   ├── ∙ context meter (if statusBar.context; red when compacting)
    │   │   └── renderContextMeter → "▋▋▋░░░░░░░ 30%" when contextWindow > 0,
    │   │       else formatSize(contextSize) → "1.2k"
    │   ├── ∙ 💎 tokenCount/tokenBudget (if statusBar.tokens && tokenBudget > 0)
    │   └── ∙ projectName (if statusBar.project && project set; shows subdir under projects/)
    └── <right> (marginLeft: auto): quote + version (if statusBar.version)
```

> **Note:** The status bar has no separate `statusMessage` text field in the current implementation — the streaming state is shown via the spinner/indicator, and the model/skill/message/context/token/project counts are rendered as `∙`-separated segments. The context element renders a block-character utilization meter (`▋▋▋░░░░░░░ 30%`) when a context window is configured, or a human-readable size (`1.2k`) when it is not. See [TUI.md](./TUI.md) §9 for the full element table.

---

## Mouse & Selection Layer

The TUI has a full mouse/selection/link layer that is not documented in the original flow diagram:

```
useMouseScroll (src/tui/useMouseScroll.js)
├── Enables terminal mouse reporting (\x1b[?1000h / \x1b[?1006h / \x1b[?1002h)
├── Parses SGR mouse sequences (\x1b[<b;x;yM / \x1b[<b;x;ym) from stdin
├── Wheel events (button codes 64/65) → onScroll(delta)
├── Left-button drag (button code 0) → onSelect / onSelectionChange
└── Click (press+release on same cell) → onClick({ x, y })

App (src/tui/app.js)
├── MouseProvider (autoEnable: false) + MouseGate (mouse reporting on/off)
├── onScroll → conversationAreaRef.scrollBy(scaleScrollDelta(delta, mouseScrollLines))
├── onSelect → buildLayout + extractSelection → clipboardy.write(text)
├── onSelectionChange → buildLayout + mapCoordToChar → setSelection({ start, end })
└── onClick → findLinkAt(click) → openUrl(href)

MessageBubble (src/tui/messageBubble.js)
├── HeaderClickRegistrar → findHeader(event, headers, scroll) → toggle collapse state
└── linkRef → setLinkTarget(id, { node, content, getScrollInfo })

headerClick.js: findHeader, hitHeader, HeaderClickRegistrar, MouseGate
linkHit.js: hitLink, findLinkAt, setLinkTarget
selectionLayout.js: buildLayout, extractSelection, mapCoordToChar, stripAnsi
openUrl.js: parseSafeUrl, buildOpenCommand, openUrl
selectMode.js: isPrintableKey, routeNavKey, isMouseEnabled, shouldHandleClick
```

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

> **Note:** The `process.on("uncaughtException")` / `process.on("unhandledRejection")` handlers are registered in `conversationArea.js` (lines 274-275), **not** in `app.js`, and they are **not** removed. Uncaught exceptions surface through these handlers in addition to the streaming catch block and the process-level handler in `index.js`.

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
           ├── conversationArea.js ──┐ (streaming handler, message state, process.on handlers)
           ├── conversationPanel.js ─┤ (VirtualScrollView + MessageBubble[])
           ├── inputArea.js ─────────┤ (owns input + status state; renders StatusBar + InputPanel + FilePicker + CommandPicker)
           ├── inputPanel.js ────────┤ (ink-text-input wrapper)
           ├── statusBar.js ─────────┤ (status indicator, skill/message/context counts)
           ├── messageList.js ───────┤ (coalesces segments, memoized list)
           ├── messageBubble.js ─────┤ (role-colored bubble, markdown, tool display; React.memo)
           ├── markdownText.js ──────┘ (uses marked)
           ├── filePicker.js ─────── (fast-glob file autocomplete, `@` trigger)
           ├── commandPicker.js ──── (command autocomplete, `/` trigger)
           ├── scrollView.js ─────── (homegrown VirtualScrollView, useBoxMetrics)
           ├── useMouseScroll.js ─── (SGR mouse sequence parsing, wheel/drag/click)
           ├── headerClick.js ────── (HeaderClickRegistrar, MouseGate, findHeader)
           ├── linkHit.js ────────── (hitLink, findLinkAt, setLinkTarget)
           ├── selectionLayout.js ── (buildLayout, extractSelection, mapCoordToChar)
           ├── openUrl.js ────────── (parseSafeUrl, buildOpenCommand, openUrl)
           ├── selectMode.js ─────── (isPrintableKey, routeNavKey, isMouseEnabled)
           ├── subagentStore.js ──── (updateSubagentStore, subagent event folding)
           ├── subagentsPanel.js ─── (subagent activity panel)
           ├── projectsPanel.js ──── (project directory selection)
           ├── sessionsPanel.js ──── (session browser)
           ├── skillsPanel.js ────── (skill list with search)
           ├── memoryPanel.js ────── (memory entries browser)
           ├── settingsPanel.js ──── (config sections editor)
           ├── sanitize.js ───────── (input sanitization)
           ├── quotes.js ─────────── (rotating quote lines)
           └── index.js ──────────── (re-exports App and panels)
```
