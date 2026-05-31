# TUI Code Flows

Call chains and component interactions for all primary code paths in the terminal UI.

## Table of Contents

- [Application Lifecycle](#application-lifecycle)
- [Banner Dismissal](#banner-dismissal)
- [Chat Message Flow (Streaming)](#chat-message-flow-streaming)
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
App({ config, registry, sessionState, dispatchProvider, appInfo })
├── useEffect: register process.on("uncaughtException", "unhandledRejection")
├── useInput: global key listener (key, input)
├── useWindowSize: { rows } for layout height
└── Render tree:
    ├── Banner (showBanner === true)
    ├── ConversationPanel (showBanner === false)
    ├── StatusBar
    ├── InputPanel
    └── Text("exit-newline")
```

Mount order: state init → effects (error handlers) → input listener → window size → render.

---

## Banner Dismissal

```
User presses key (useInput callback, app.js:282)
├── key === escape && showBanner
│   └── App.handleQuit() → process.exit(0)
├── key !== escape && showBanner
│   └── setShowBanner(false)
│       └── Render re-evaluates:
│           ├── Banner → ConversationPanel
│           ├── StatusBar (rendered)
│           ├── InputPanel (rendered)
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
User enters ":command ...", presses Enter (app.js:294)
└── handleSubmit(inputText)
    ├── parser.isCommand(trimmed) → true
    └── handleCommand(trimmed)
        ├── parser.parse(trimmed, context)
        │   ├── trimmed.startsWith(":") → yes
        │   ├── parts = trimmed.slice(1).trim().split(/\s+/)
        │   │   ├── commandName = parts[0] (e.g., "quit")
        │   │   └── args = parts.slice(1)
        │   ├── handler = #dispatch.get(commandName)
        │   └── handler(args, context)
        │       ├── action === "quit" → handleQuit() → process.exit(0)
        │       ├── action === "unknown" → setStatusMessage(message)
        │       ├── action === "provider" → setStatusMessage + optional addMessage
        │       ├── action === "config" → setConfigValue(config, dotPath, value)
        │       ├── action === "memory" → setStatusMessage or context action
        │       ├── action === "schedule" → setStatusMessage or schedule action
        │       └── action === "context" → setStatusMessage + addMessage
        └── catch → setStatusMessage("Something went wrong")
```

### Dispatch Table (CommandParser constructor)

| Command     | Subcommands              | Effect                           |
|-------------|--------------------------|----------------------------------|
| `:quit`     | —                        | `process.exit(0)`                |
| `:provider` | `set <name>`             | `sessionState.setProvider(name)` |
| `:config`   | `set <path> <value>`     | `setConfigValue(config, path, v)`|
| `:memory`   | `open`, `search <q>`     | Context list / search query      |
| `:schedule` | `list`, `pause <n>`, `resume <n>`, `run-now <n>` | Schedule actions |
| `:context`  | `add <text>`             | Add context string               |
| `:help`     | —                        | Available commands message       |

---

## Keyboard Input (useInput, app.js:282)

```
useInput((input, key))
├── showBanner === true
│   ├── key.escape
│   │   └── handleQuit() → process.exit(0)
│   └── key !== escape && input !== "\r"
│       └── setShowBanner(false) → fall through to normal input
└── showBanner === false
    ├── key.escape → handleQuit() → process.exit(0)
    ├── key.return && !key.shift
    │   └── handleSubmit(inputText) → [see Chat Message Flow / Command Parsing Flow]
    ├── key.upArrow && chatHistory.length > 0
    │   ├── historyIndex === -1 → index = length - 1
    │   ├── else → index = max(0, index - 1)
    │   └── setHistoryIndex(newIndex), setInputText(chatHistory[newIndex])
    ├── key.downArrow
    │   ├── historyIndex === -1 → no-op
    │   ├── historyIndex + 1 >= history.length → reset
    │   │   └── setHistoryIndex(-1), setInputText("")
    │   └── else → setHistoryIndex + 1), setInputText(chatHistory[nextIndex])
    ├── key.backspace && inputText.length > 0
    │   └── setInputText(prev.slice(0, -1))
    └── input && input !== "\r"
        └── setInputText(prev + input)
```

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

**Order:** `conversation` → `skills` → `memory` → `settings` → `conversation` ...

```
nextPanel(current):
└── order = ["conversation","skills","memory","settings"]
    └── order[(order.indexOf(current) + 1) % order.length]

prevPanel(current):
└── order[(order.indexOf(current) - 1 + order.length) % order.length]
```

**Panel components:**

| Panel           | Component File          | Key Props              | State              |
|-----------------|-------------------------|------------------------|--------------------|
| Conversation    | conversationPanel.js    | `messages`, `assistantName` | scrollRef, prevMessageCount |
| Skills          | skillsPanel.js          | `skills[]`             | searchQuery, focusedSkill |
| Memory          | memoryPanel.js          | `entries[]`            | selectedEntry, focusIndex |
| Settings        | settingsPanel.js        | `configSections[]`     | focusIndex, selectedSection |

Each panel (except Conversation) has its own internal `useInput` for arrow-key navigation.

---

## Input Panel

```
InputPanel({ inputText, blinkTimeout, cursorChar })
└── <Blink text={inputText} char={cursorChar} ms={blinkTimeout} />
    └── static render (no state timer):
        └── <Box flexDirection="row">
            ├── <Text flexGrow="1"> inputText || "" </Text>
            └── <Text bold> cursorChar || "\u2588" </Text>
```

No useEffect, no setInterval. Pure display component.

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
           ├── panels.js ──────── (pure functions)
           ├── hooks.js ───────── (imports from panels.js)
           │
app.js ─────├── conversationPanel.js ──┐
           ├── inputPanel.js ──────────┤  All components export
           ├── statusBar.js ───────────┤  via components.js / index.js
           ├── banner.js ──────────────┤
           ├── messages.js ────────────┤
           ├── markdownText.js ────────┘
           └── config/loader.js ──── (setConfigValue import)
```
