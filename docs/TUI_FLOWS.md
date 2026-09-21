# TUI Code Flows

Call chains and component interactions for all primary code paths in the terminal UI.

## Table of Contents

- [Application Lifecycle](#application-lifecycle)
- [Banner Dismissal](#banner-dismissal)
- [Chat Message Flow (Streaming)](#chat-message-flow-streaming)
- [Command Parsing Flow](#command-parsing-flow)
- [Skill Slash-Command Invocation](#skill-slash-command-invocation)
- [File Picker (@ Autocomplete)](#file-picker--autocomplete)
- [Keyboard Input (useInput, app.js:184)](#keyboard-input-useinput-appjs184)
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
App({ config, registry, sessionState, dispatchProvider, scheduleManager, appInfo, onboarding, onSaveSession, gcManager, gcTrigger })
├── useEffect: register process.on("uncaughtException", "unhandledRejection")
├── useInput: global key listener (key, input)
├── useWindowSize: { rows } for layout height
└── Render tree (single-column vertical layout):
    ├── OnboardingPanel (showOnboarding === true)
    ├── Banner (showBanner === true AND NOT showOnboarding)
    ├── ConversationPanel (showBanner === false AND NOT showOnboarding)
    ├── StatusBar (when NOT showBanner AND NOT showOnboarding)
    ├── InputPanel (when showOnboarding OR NOT showBanner)
    └── Text("exit-newline")
```

**Note:** `scheduleManager`, `onboarding`, `onSaveSession`, `gcManager`, and `gcTrigger` are additional props passed from `index.js` but not documented in the original flow diagram.

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
User presses Enter (useInput, app.js:294)
└── handleSubmit(inputText)
    ├── setChatHistory([...prev, trimmed])
    ├── setHistoryIndex(-1)
    ├── setInputText("")
    ├── parser.isCommand(trimmed)
    │   └── false → handleChat(trimmed)
    │       ├── setStatusMessage("Streaming...")
    │       ├── addMessage({ role: "user", content: text })
    │       ├── setMessages([...prev, { role: "assistant", content: "", streaming: true }])
    │       ├── dispatchProvider(text, provider, streamingCallback)
    │       │   ├── event.type === "text"
    │       │   │   └── committedContent += event.text
    │       │   │   └── setMessages(last.content = committedContent + "\u2588")
    │       │   ├── event.type === "reasoning"
    │       │   │   └── committedReasoning += event.text
    │       │   │   └── setMessages(last.reasoningContent = committedReasoning + "\u2588")
    │       │   ├── event.type === "tool_start"
    │       │   │   └── setMessages(last.activeToolCall = { name })
    │       │   ├── event.type === "tool_end"
    │       │   │   └── lastToolCallDisplay += displayLine
    │       │   │   └── setMessages(last.activeToolCall = null, ...toolCallDisplay)
    │       │   └── event.type === "tool_error"
    │       │       └── lastToolCallDisplay += errorLine
    │       │       └── setMessages(last.activeToolCall = null, ...toolCallDisplay)
    │       ├── setMessages(last.content = committedContent, streaming = false, ...)
    │       └── sessionState.addExchange({ role: "assistant", content: responseContent })
```

Streaming re-renders: each `setMessages` call triggers a `ConversationPanel` re-render where `MessageBubble`'s React.memo `areEqual` determines if the bubble re-renders. Only the active streaming message updates.

---

## Command Parsing Flow

```
User enters "/command ...", presses Enter (app.js:92 handleSubmit)
└── handleSubmit(inputText)
    ├── parser.isCommand(trimmed) → true
    └── area.handleCommand(trimmed)   (ConversationArea)
        ├── parser.parse(trimmed, context)
        │   ├── trimmed.startsWith("/") → yes
        │   ├── parts = trimmed.slice(1).trim().split(/\s+/)
        │   │   ├── commandName = parts[0] (e.g., "quit")
        │   │   └── args = parts.slice(1)
        │   ├── handler = #dispatch.get(commandName)
        │   │   └── if found → handler(args, context)
        │   └── else if context._skillList.includes(commandName)
        │       └── returns { action: "skill", subAction: "invoke", name, args }
        │           └── [see Skill Slash-Command Invocation]
        ├── switch result.action:
        │   ├── "quit" → onQuit() → process.exit(0)
        │   ├── "new" → onNewSession() → reset ConversationArea + InputArea
        │   ├── "clear" → messageListRef.clear() + status
        │   ├── "unknown" → onStatusChange(message)
        │   ├── "view" → onViewChange(value) → switch to panel view
        │   │   └── [see Panel Navigation (Tab Cycles)]
        │   ├── "skill" → [see Skill Slash-Command Invocation]
        │   └── default → addMessage({ role: "user" }) + optional system message
        └── catch → addMessage({ role: "system", content: "Command error: ..." })
```

### Dispatch Table (CommandParser constructor)

| Command     | Subcommands                                      | Effect                            |
| ----------- | ------------------------------------------------ | --------------------------------- |
| `/quit`     | —                                                | `process.exit(0)`                 |
| `/exit`     | —                                                | `process.exit(0)`                 |
| `/provider` | `set <name>`                                     | `sessionState.setProvider(name)`  |
| `/config`   | `set <path> <value>`                             | `setConfigValue(config, path, v)` |
| `/schedule` | `list`, `pause <n>`, `resume <n>`, `run-now <n>` | Schedule actions                  |
| `/clear`    | —                                                | Clear conversation messages       |
| `/new`      | —                                                | Start a fresh session             |
| `/gc`       | `status`                                         | Trigger V8 GC or show status      |
| `/help`     | —                                                | Available commands message        |
| `/sessions` | —                                                | View switch → `sessions` panel    |
| `/memory`   | —                                                | View switch → `memory` panel      |
| `/skills`   | —                                                | View switch → `skills` panel      |
| `/settings` | —                                                | View switch → `settings` panel    |
| `/<skill>`  | `[args]`                                         | Skill invocation (fallback)       |

**Note:** `/sessions`, `/memory`, `/skills`, and `/settings` are registered as view-switching commands in the CommandParser constructor (loop over `[["sessions","sessions"],["memory","memory"],["skills","skills"],["settings","settings"]]`), each returning `{ action: "view", value }`. Skill names are NOT in the dispatch table — they fall through to the skill-registry check in `parse()`, which returns `{ action: "skill", subAction: "invoke", name, args }`.

---

## Skill Slash-Command Invocation

**Entry:** `src/tui/conversationArea.js` → `handleCommand()` → `parser.parse()` fallback

```
User enters "/<skill-name> [args]", presses Enter
└── parser.parse(trimmed, context)
    ├── commandName not in #dispatch
    ├── context._skillList.includes(commandName) → true
    │   └── _skillList = registry.list() (array of registered skill names)
    └── returns { action: "skill", subAction: "invoke", name: commandName, args }
└── handleCommand() switch on result.action === "skill"
    ├── skillPrompt = `Run the ${result.name} skill${args?.length ? " " + args.join(" ") : ""}`
    │   └── Synthesizes the deepagents "Run the <skill> skill [args]" prompt
    ├── await handleChat(skillPrompt, { silentUser: true })
    │   ├── silentUser: the synthesized prompt is NOT rendered as a user message
    │   └── dispatchProvider → deepagents skill system → streaming response renders normally
    └── No user/system message added for the command itself
```

**Key behavior:**

- Skill commands are routed through the **deepagents skill system** (not the sandbox `invokeSkill` path).
- The synthesized prompt is silent — it stays out of the TUI message list, but the assistant's streaming response renders normally.
- `/help` appends `Skills: /<name>, /<name>... (execute with /skillName [args])` when `_skillList` is non-empty.

---

## File Picker (@ Autocomplete)

**Entry:** `src/tui/filePicker.js` → `FilePicker` component, wired in `src/tui/inputArea.js`

```
User types "@" followed by a path fragment in the input
├── inputArea.js useEffect on [inputText]:
│   ├── lastAt = inputText.lastIndexOf("@")
│   ├── if lastAt === -1 → setPickerOpen(false)
│   ├── if pickerOpenRef.current → keep open while "@" remains
│   └── else → scan token (bounded by whitespace unquoted / quotes quoted)
│       └── setPickerOpen(token.length > 1)  ← require "@" + content
├── pickerOpen === true:
│   ├── InputPanel unmounts (hidden) — FilePicker owns the keystrokes
│   │   └── avoids focus conflict between ink-text-input and ink-select-input
│   └── FilePicker renders below the input
└── FilePicker:
    ├── deriveFilter(value, cursor) → { filter, tokenStart, tokenEnd, active }
    │   ├── active only when cursor is inside an "@" token
    │   └── quoted "@" with empty filter → inactive (no path to match)
    ├── useEffect: fast-glob("**/*", { cwd, ignore: [node_modules, .git, dist], onlyFiles, deep: 6 })
    │   └── caches file list in filesRef, filters in JS on debounce (250ms)
    ├── sorted = files.sort(by path length asc, then localeCompare)
    ├── useInput (isActive: true):
    │   ├── escape → onClose()
    │   ├── return → handleSelect()
    │   │   └── onChange(replaceToken(value, tokenStart, tokenEnd, selected))
    │   │       └── wraps path in quotes if it contains whitespace
    │   ├── up/down → focusIndex navigation (wraps)
    │   ├── left/right → cursor movement
    │   ├── backspace/delete → edit at cursor
    │   └── printable → insert at cursor
    └── Render: input text with cursor indicator + up to MAX_VISIBLE (3) matches
        └── rotating window around the selection
```

**Key behavior:**

- The picker opens when the input contains an `@` token with content after it, and stays open while the `@` remains.
- While open, the FilePicker **owns the input** — `app.js` bails on all key handling when `inputAreaRef.current?.isPickerOpen?.()` is true (app.js:214).
- On close, the InputPanel remounts fresh, re-initializing ink-text-input's cursor to the end of the current value.
- Results are sorted by path length ascending (shortest first), then alphabetically.

---

## Keyboard Input (useInput, app.js:184)

```
useInput((input, key))
├── showOnboarding === true
│   ├── key.return && !key.shift → processOnboardingInput(inputText)
│   └── key.escape → handleQuit()
├── showBanner === true
│   ├── key.escape → handleQuit() → process.exit(0)
│   └── else → setShowBanner(false) → fall through to normal input
├── currentView !== PANELS.CONVERSATION
│   └── return  ← defer all input to the active panel's own useInput({ isActive })
└── currentView === PANELS.CONVERSATION
    ├── inputAreaRef.current?.isPickerOpen?.() === true
    │   └── return  ← file picker owns the input, don't steal keys
    ├── key.tab / input === "\t" → setInputFocused(!prev)
    ├── key.escape → interrupt() (debounced 500ms)
    ├── inputFocused === true:
    │   ├── key.upArrow → navigateHistory("up")
    │   └── key.downArrow → navigateHistory("down")
    └── inputFocused === false:
        ├── key.upArrow → scrollBy(-1)
        ├── key.downArrow → scrollBy(1)
        ├── key.pageUp → scrollBy(-viewportHeight)
        └── key.pageDown → scrollBy(viewportHeight)
```

**Note:** Enter/Return is handled by the focused `InputPanel`/`FilePicker` component's own `useInput`, not at the app level. The app-level `useInput` only handles navigation, focus toggling, and interrupt.

---

## Conversation Panel Render

```
ConversationPanel({ messages, assistantName })
└── Render cycle:
    ├── useInput: handle scroll on up/down/pageUp/pageDown
    ├── useEffect: stdout.on("resize") → remeasure ScrollView
    ├── Content hash tracking:
    │   ├── hash = messages.length + streamingOverflowCheck
    │   ├── prevHash !== newHash → executeAutoScroll(scrollRef, messages, countRef)
    │   └── streaming overflow → scrollToBottom()
    ├── React.useMemo(() => renderMessages(messages, assistantName))
    │   └── For each message i:
    │       └── React.createElement(MessageBubble, { key: "msg-i", msg: {...msg, _index: i}, assistantName })
    │           └── React.memo areEqual: role, content, time, reasoningContent, streaming, toolCallDisplay, activeToolCall, assistantName
    │               ├── areEqual === true (no changes) → skip render
    │               └── areEqual === false → render:
    │                   ├── formatTime(new Date())
    │                   ├── getRoleColors(msg.role) — cached
    │                   ├── getBubbleStyle(msg.role) — cached
    │                   ├── getRoleLabel(msg.role, assistantName)
    │                   ├── <MessageBubble> (Box)
    │                   │   ├── <header> Box: [time] Role:
    │                   │   └── <content> Box:
    │                   │       ├── <MarkdownText content={...} /> — React.memo
    │                   │       ├── reasoningEl (if role=assistant && reasoningContent)
    │                   │       ├── toolCallEl (if activeToolCall)
    │                   │       └── toolDisplayEl (if toolCallDisplay)
    │                   │           └── For each line: <Text> "  line"
    │                   └── justifyContent: bubble.alignment (flex-start/flex-end)
    └── <Box flexDirection="column" flexGrow="1">
        └── <ScrollView ref={scrollRef}> ...children ... </ScrollView>
```

### Memo Guard: MessageBubble.areEqual

```
areEqual(prevProps, nextProps):
  prev.msg.role === next.msg.role
  && prev.msg.content === next.msg.content
  && prev.msg.time === next.msg.time
  && prev.msg.reasoningContent === next.msg.reasoningContent
  && prev.msg.streaming === next.msg.streaming
  && prev.msg.toolCallDisplay === next.msg.toolCallDisplay
  && prev.msg.activeToolCall === next.msg.activeToolCall
  && prev.msg._index === next.msg._index
  && prev.assistantName === next.assistantName
  → true  (skip re-render)
```

---

## Panel Navigation (Tab Cycles)

**Order:** `conversation` → `skills` → `memory` → `settings` → `sessions` → `conversation` ...

**Note:** `OnboardingPanel` is rendered conditionally (when `showOnboarding === true`) and is NOT part of the tab cycling order. It runs its own internal state machine (INIT → ATTRACTOR → COLLECT → SAVE → TRANSCEND) before transitioning to the main app.

```
nextPanel(current):
└── order = ["conversation","skills","memory","settings","sessions"]
    └── order[(order.indexOf(current) + 1) % order.length]

prevPanel(current):
└── order[(order.indexOf(current) - 1 + order.length) % order.length]
```

**Panel components:**

| Panel        | Component File       | Key Props                   | State                       |
| ------------ | -------------------- | --------------------------- | --------------------------- |
| Conversation | conversationPanel.js | `messages`, `assistantName` | scrollRef, prevMessageCount |
| Skills       | skillsPanel.js       | `skills[]` (catalog)        | searchQuery, focusedSkill   |
| Memory       | memoryPanel.js       | `entries[]`                 | selectedEntry, focusIndex   |
| Settings     | settingsPanel.js     | `configSections[]`          | focusIndex, selectedSection |
| Sessions     | sessionsPanel.js     | `sessionState`, `config`    | sessions[], selectedEntry   |

Each panel (except Conversation) has its own internal `useInput` for arrow-key navigation.

**View switching:** `/sessions`, `/memory`, `/skills`, and `/settings` commands return `{ action: "view", value }`, which `handleCommand` routes to `onViewChange(value)` → `setCurrentView(view)`. Returning to `conversation` reloads messages from session state via `loadConversation()`.

**Skill selection:** Selecting a skill in the SkillsPanel calls `onSelectSkill(name)` → `handleSelectSkill()` which switches to the conversation view and pre-loads `/<skill>` into the input (via `pendingInput`), so the user can press Enter to run it or append to it.

---

## Input Panel

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

```
ConversationPanel useInput((input, key))
└── handleScrollInput(scrollRef.current, key):
    ├── key.upArrow → scrollRef.scrollBy(-1)
    ├── key.downArrow → scrollRef.scrollBy(1)
    ├── key.pageUp → scrollRef.scrollBy(-scrollRef.getViewportHeight())
    └── key.pageDown → scrollRef.scrollBy(scrollRef.getViewportHeight())
```

---

## Auto-Scroll

```
ConversationPanel render cycle:
├── contentHash = messages.length + streamingContentLength
├── contentHash !== prevHash (and prevHash > 0):
│   └── executeAutoScroll(scrollRef, messages, countRef.current, countRef)
│       └── handleAutoScroll(scrollRef, messages, prevCount):
│           ├── scrollRef null || messages empty → { newCount: prevCount, scrolled: false }
│           ├── messages.length > prevCount:
│           │   └── scrollRef.scrollToBottom() → { newCount: messages.length, scrolled: true }
│           └── lastItem.streaming === true:
│               ├── contentHeight > viewportHeight → scrollToBottom()
│               └── else → { newCount: prevCount, scrolled: false }
└── streaming overflow fallback (if hash not tracked):
    └── getContentHeight() > getViewportHeight() → scrollToBottom()
```

---

## Status Bar

```
StatusBar({ statusMessage, skillCount, messageCount, appInfo }) [React.memo]
└── getStatusIndicator(statusMessage):
    ├── "Error..." → "\u2716" (red)
    ├── "Sending..." || "Streaming..." → "\u25B6" (yellow)
    └── else → "\u25CF" (green)
└── <Box flexDirection="row" justifyContent="space-between">
    ├── <left>: { indicator } { statusMessage } | skills:{skillCount} msg:{messageCount}
    └── {appInfo}: appInfo.name + appInfo.version
```

---

## Error Handling

```
app.js mount:
├── process.on("uncaughtException", onUncaught)
│   └── addMessage({ role: "system", content: "Uncaught error: " + err.message })
├── process.on("unhandledRejection", onUnhandled)
│   └── addMessage({ role: "system", content: "Unhandled rejection: " + reason })
└── unmount: process.off(...)

Streaming error:
├── catch (err):
│   ├── setMessages(prev.filter(m => !isStreamingMessage(m)))
│   ├── setStatusMessage("Something went wrong")
│   └── addMessage({ role: "system", content: "I couldn't connect..." })
```

---

## File Dependencies

```
index.js ──┐
           ├── commandParser.js ── (pure class, no deps)
           ├── panels.js ──────── (pure functions: PANELS, getPanelOrder, nextPanel, prevPanel)
           ├── hooks.js ───────── (imports from panels.js)
           │
app.js ─────├── onboardingPanel.js (state machine: INIT → ATTRACTOR → COLLECT → SAVE → TRANSCEND)
           ├── banner.js (BANNER_ART, COMMAND_GROUPS)
           ├── conversationArea.js ──┐ (owns conversation + streaming state)
           │   ├── conversationPanel.js ──┐ (uses ink-scroll-view: ScrollView)
           │   ├── commandParser.js ──────┤
           │   └── contextTokens.js ──────┤
           ├── inputArea.js ──────────────┤ (owns input + status state)
           │   ├── inputPanel.js ─────────┤  All components export
           │   ├── statusBar.js ──────────┤  via components.js / index.js
           │   ├── filePicker.js ─────────┘ (uses fast-glob; @ autocomplete)
           ├── messages.js ───────────────
           ├── markdownText.js ─────────── (uses marked + marked-terminal)
           ├── components.js ──────────── (exports: ConversationPanel, SkillsPanel, MemoryPanel, SettingsPanel)
           ├── skillsPanel.js ─────────── (skill list with search + select)
           ├── memoryPanel.js ─────────── (memory entries browser)
           ├── settingsPanel.js ───────── (config sections editor)
           ├── sessionsPanel.js ───────── (session browser + resume; uses ink-select-input)
           └── hooks.js ───────────────── (useWindowSize, useInput helpers)
```
