# Code Flows

Call chains and data flows for all primary code paths in the project, excluding the TUI (see [TUI_FLOWS.md](./TUI_FLOWS.md)).

## Table of Contents

- [Application Startup](#application-startup)
- [Config Loading](#config-loading)
- [Telemetry Initialization](#telemetry-initialization)
- [Skill Registry Discovery & Validation](#skill-registry-discovery--validation)
- [Tool Configuration Building](#tool-configuration-building)
- [Agent Creation](#agent-creation)
- [Cache Lookup Flow](#cache-lookup-flow)
- [Cache Storage Flow](#cache-storage-flow)
- [Session Creation](#session-creation)
- [Chat Flow (CLI Chat Mode)](#chat-flow-cli-chat-mode)
- [Chat Model Creation](#chat-model-creation)
- [Agent ReAct Streaming](#agent-react-streaming)
- [Context Compaction](#context-compaction)
- [Tool Permission Enforcement](#tool-permission-enforcement)
- [File Tool Execution Flow](#file-tool-execution-flow)
- [Terminal Tool Execution Flow](#terminal-tool-execution-flow)
- [Web Tool Execution Flow](#web-tool-execution-flow)
- [Deep Agents Orchestration Flow](#deep-agents-orchestration-flow)
- [Sandbox Skill Execution](#sandbox-skill-execution)
- [Memory Persistence Flow](#memory-persistence-flow)
- [Context Loading](#context-loading)
- [Schedule Manager Lifecycle](#schedule-manager-lifecycle)
- [Memory Retention Cleanup](#memory-retention-cleanup)
- [Profile Management](#profile-management)
- [Shutdown Flow](#shutdown-flow)
- [Additional Tool Flows](#additional-tool-flows)
- [File Dependencies](#file-dependencies)

## Application Startup

**Entry:** `index.js`

```
index.js (main)
├── import { loadConfig } from "./src/config/loader.js"
├── config = loadConfig()
│   └── [see Config Loading]
├── if config.schedules.syncOnInit !== false:
│   ├── Cron.sync(schedulesDir) → reconciles persisted jobs with system crontab
│   └── Cron.add(reflection-daily) → ensures daily reflection job exists
├── ensureSessionsDir("memory/sessions/") → creates sessions directory
├── if !hasProfile():
│   └── createOnboarding() with autoSchedule callback → [see Onboarding]
├── if config.telemetry.enabled:
│   ├── initTelemetry(config.telemetry)
│   ├── tracer = getTracer()
│   └── shutdownFn = shutdownTelemetry
├── registry = new SkillRegistry()
├── ensureSkillsDir("skills/")
├── registry.discover("skills/")
│   └── [see Skill Registry Discovery & Validation]
├── { writeMemoryFile, readMemoryFile, loadContext }
│   └── from "./src/memory/index.js"
├── initGC({ idleTimeoutMs, maxGcPerHour, onIdle }) → GC idle manager
├── { createSession, SessionStateManager, saveSession, handleShutdown, registerShutdownHandler }
│   └── from "./src/session/index.js"
├── scheduleManager = new ScheduleManager()  // maxConcurrent param deprecated
├── scheduleManager.register(config.schedules.entries)
│   └── [see Schedule Manager Lifecycle]
├── providerName = Object.keys(config.providers)[0] || "openai"
├── { sessionId, state: initialState } = createSession({
│   │   provider: providerName,
│   │   contextWindow: config.session.context_window_size,
│   │   })
│   └── [see Session Creation]
├── sessionState = new SessionStateManager(initialState)
├── { loadSystemPrompt } = import("./src/memory/prompts.js")
├── systemPrompt = loadSystemPrompt()
│   └── reads prompts/SYSTEM_PROMPT.md, strips frontmatter
├── providerConfig = config.providers[providerName]
├── tools = await buildToolConfig({
│   │   permissions, allowedPaths, maxReadSize, registry,
│   │   sessionsDir, safety, timeout, memoryLimit,
│   │   contextDir, ephemeralTtlDays, ephemeralMaxEntries, config
│   │   })
│   └── [see Tool Configuration Building]
├── model = createChatModel(providerConfig)
│   └── [see Chat Model Creation]
├── { createCheckpointer } = import("./src/session/checkpointer.js")
├── checkpointer = createCheckpointer(config.persistence)
├── agent = createReactAgent(model, tools, checkpointer, recursionLimit)
│   └── [see Chat Flow (CLI Chat Mode)]
├── sessionConfig = { configurable: { thread_id: sessionState.getThreadId() } }
├── registerShutdownHandler(async () => {
│   ├── saveSession()
│   ├── cleanRetainedMemory()
│   ├── enforceMaxEntries()
│   └── shutdownFn()
│   })
├── isMain = process.argv[1] === fileURLToPath(import.meta.url)
├── if isMain:
│   ├── mode = --mode flag ("chat" | "interactive")
│   ├── if mode === "chat":
│   │   ├── message = first non-flag argv arg
│   │   └── handleConversation(message)
│   │       └── [see Chat Flow (CLI Chat Mode)]
│   └── else (interactive):
│       ├── { render } = import("ink")
│       ├── App = import("./src/tui/app.js").default
│       └── render(<App config registry sessionState dispatchProvider invokeSkill appInfo />)
│           └── onExit: handleShutdown() + stdout.write("\n")
└── export: config, sessionId, sessionState, registry, tracer, dispatchProvider,
            handleConversation, invokeSkill, handleShutdown, scheduleManager,
            setConfigValue, loadContext, writeMemoryFile, readMemoryFile,
            cleanRetainedMemory
```

## Config Loading

**Entry:** `src/config/loader.js` → `loadConfig()`

```
loadConfig()
├── raw = DEFAULT_CONFIG (from schemas.js)
├── if config.yaml exists:
│   ├── fileContent = readFileSync(config.yaml, "utf-8")
│   ├── parsed = yaml.load(fileContent)
│   └── raw = deepMerge({}, DEFAULT_CONFIG, parsed)
│       └── Recursively merges object properties from source → target
├── resolved = _resolveEnvRecursively(raw, [])
│   └── Walks config tree; for each leaf:
│       ├── DROPPED_KEYS = ["providers", "credentials", "process"]
│       ├── envKey = pathSegments (minus dropped) → UPPER_SNAKE_CASE → join("_")
│       ├── envValue = process.env[envKey]
│       └── if envValue exists:
│           ├── _parseValue(envValue) → boolean / number / string
│           ├── else if value matches ${VAR} legacy pattern:
│           │   └── resolve process.env[legacy]
│           └── else: keep original value
└── validateConfig(resolved) → ConfigSchema.parse(resolved)
```

### Runtime Mutation

```
setConfigValue(config, dotPath, valueStr)
├── applyDotPathMutation(config, dotPath, valueStr) -- mutates config in-place
│   ├── clone = JSON.parse(JSON.stringify(config))
│   ├── split dotPath by "/" → assignPath(clone, segments, value)
│   ├── validate against ConfigSchema
│   └── restore from validated clone (max depth 5)
├── saveConfig(config)
│   ├── writeFileSync(config.yaml, yaml.dump(config))
│   └── mkdirSync(dirname) if needed
└── return true
```

## Telemetry Initialization

**Entry:** `src/telemetry/provider.js` → `initTelemetry(), getTracer(), shutdownTelemetry()`

```
initTelemetry(teleconfig)
├── NodeSDK config:
│   ├── serviceName: "madz"
│   ├── spanProcessor: batch (OTLP exporter)
│   ├── sampler: createSampler(teleconfig.sampling.ratio)
│   ├── resource: attrs from telemetry.config.resource
│   └── dynamic span samplers: on
├── if exporter.protocol === "http":
│   └── OTLPTraceExporter(url: endpoint)
└── else: ConsoleSpanExporter
├── NodeSDK.start()
└── SDK is ready

getTracer()
└── return tracerManager.getTracer("madz-harness")

shutdownTelemetry()
└── SDK.shutdown() -- gracefully flushes pending spans
```

## Skill Registry Discovery & Validation

**Entry:** `index.js` → `registry.discover("skills/")`

```
registry.discover(skillsDir = "skills/")
├── discovered = discoverSkills(skillsDir)
│   └── discoverSkills(fullDir):
│       ├── entries = readdirSync(fullDir)
│       └── for each entry name:
│           ├── stat → skip if not directory
│           └── try SKILL.md (YAML frontmatter: name, description, license, compatibility, metadata):
│           ├── if metadata found:
│           │   ├── metadata._directory = skillPath
│           │   └── if scripts/ dir exists: metadata.scripts = scriptsDir
│           └── push { path: skillPath, name, metadata }
├── for each skill in discovered:
│   ├── { valid, errors } = validateSkillSchema(skill.metadata)
│   │   └── validateSkillSchema(metadata):
│   │       ├── errors = []
│   │       └── for each field in SkillMetadataSchema:
│   │           └── try schema.parse(metadata) → catch → { valid: false, errors }
│   └── if valid:
│       │   #skills.set(name, { ...skill, validated: true, disabled })
│       └── else:
│           └── #errors.push({ name, errors })
│
└── return results: [{ name, errors[] }] for each discovered skill
```

## Tool Configuration Building

**Entry:** `index.js` → `buildToolConfig(options)`

```
buildToolConfig({ permissions, allowedPaths, maxReadSize, registry, safety, timeout, memoryLimit })
├── enabledSet = new Set(permissions)
├── runtimeOptions = { allowedPaths, maxReadSize, registry, safety, timeout, memoryLimit }
├── for each [toolName, requiredPerms] in TOOL_PERMISSIONS:
│   ├── hasAllPerms = requiredPerms.every(perm => enabledSet.has(perm))
│   ├── switch toolName:
│   │   ├── clarify | executeCode | code → always create (no perms needed)
│   │   ├── webSearch | web_extract → if hasAllPerms && hasSearchKey()
│   │   ├── visionAnalyze → if OPENAI_API_KEY
│   │   ├── image_generate → if hasAllPerms && FAL_API_KEY
│   │   ├── cronjob → if hasAllPerms
│   │   ├── createSkill → if hasAllPerms (filesystem:write)
│   │   ├── textToSpeech | tts → if OPENAI_API_KEY
│   │   ├── mixtureOfAgents → if OPENROUTER_API_KEY
│   │   └── default: → if requiredPerms.length === 0 || hasAllPerms
│   └── tools.push(TOOL_FACTORIES[toolName](runtimeOptions))
└── return tools[]
```

### Tool Factory Pattern

Each tool file exports three things:

1. **Core impl function** (e.g., `readFileImpl(input, options)`)
2. **Tool definition** (`tool(impl, { name, description, schema })`)
3. **Factory function** (e.g., `createReadFileTool(options)`)

The factory closes over runtime options, creating a LangChain `tool()` instance where each invocation calls the impl with those options.

## Agent Creation

**Entry:** `index.js` → `createReactAgent(model, tools, checkpointer)`

```
createReactAgent(model, tools, checkpointer)
└── createReactAgentGraph({ llm: model, tools, ...(checkpointer && { checkpointer }) })
    └── Returns compiled LangGraph ReAct agent
```

## Cache Lookup Flow

**Entry:** `src/agent/react.js` → `callReactAgent()` / `callReactAgentStreaming()`

Both the non-streaming and streaming agent invocation paths check the cache before making an LLM API call.

```
callReactAgent(agent, message, config, systemPrompt, callback, options)
├── threadId = config?.configurable?.thread_id
├── cacheKey = threadId ? getCacheKey(threadId, message) : null
│   └── getCacheKey(threadId, message):
│       ├── hash = SHA-256(message) → hex string
│       └── return `${threadId}_${hash}`
├── if cacheKey:
│   ├── cached = getCache().get(cacheKey)
│   │   └── getCache() → lazily initializes with config.lru.size / config.lru.ttl (fallback: 100, 600000)
│   └── if cached → return { content: cached }  ← cache hit, skip LLM call
└── proceed to LLM call...

callReactAgentStreaming(agent, initMessages, originalMessage, config, callback, options)
├── threadId = config?.configurable?.thread_id
├── cacheKey = threadId ? getCacheKey(threadId, originalMessage) : null
├── if cacheKey:
│   ├── cached = getCache().get(cacheKey)
│   └── if cached:
│       ├── callback({ type: "text", text: cached })  ← emit as streaming events
│       └── return { content: cached }  ← cache hit, skip stream
└── proceed to stream...
```

**Cache key generation:** The key is `${threadId}_${sha256_hex_hash_of_message}`. Identical messages in the same thread always produce the same key. Different threads produce different keys even for identical messages.

## Cache Storage Flow

**Entry:** `src/agent/react.js` → `callReactAgent()` / `callReactAgentStreaming()`

Cache storage only occurs on successful LLM calls where no tools were invoked.

### Non-Streaming Path

```
callReactAgent(agent, message, config, systemPrompt, callback, options)
├── result = await agent.invoke({ messages }, invokeConfig)
├── content = extractContent(result, message)
├── hasToolCalls = result.messages?.some(m => m.tool_calls?.length > 0) ?? false
├── if cacheKey && !hasToolCalls:
│   ├── getCache().set(cacheKey, content.content)
│   │   └── Fail-open: silently ignores write errors
│   └── return content
└── else (hasToolCalls):
    └── return content  ← NOT cached
```

### Streaming Path

```
callReactAgentStreaming(agent, initMessages, originalMessage, config, callback, options)
├── for await (event of stream):
│   ├── on_chat_model_stream → callback({ type: "text", text })
│   │   └── aggregatedText += textContent  ← aggregate for caching
│   └── on_tool_start / on_tool_end → track in toolCallSet
├── if cacheKey && aggregatedText && toolCallSet.size === 0:
│   ├── getCache().set(cacheKey, aggregatedText)
│   │   └── Fail-open: silently ignores write errors
│   └── return { content: originalMessage }
└── else (hasToolCalls or empty):
    └── return { content: originalMessage }  ← NOT cached
```

**Conditional caching rules:**

| Condition | Cached? | Reason |
|-----------|---------|--------|
| No tools invoked | Yes | Pure LLM response, safe to reuse |
| Tools invoked | No | State-changing operations must not be skipped |
| Stream aborted | No | Partial response, incomplete |
| Stream failed | No | Incomplete or error response |
| No threadId | No | Cannot generate cache key |

## Session Creation

**Entry:** `index.js` → `createSession({ provider, contextWindow })`

```
createSession({ provider, contextWindow })
├── state = {
│   ├── provider
│   ├── conversation: []
│   ├── contextWindow
│   ├── skills: []
│   ├── createdAt: new Date().toISOString()
│   └── updatedAt: new Date().toISOString()
│   }
├── sessionId = uuidv4()
└── return { sessionId, state }
```

### Session State Manager

```
sessionState = new SessionStateManager(initialState)
├── getProvider() → "openai"
├── setProvider(name) → updates state.provider, updatedAt
├── getConversation() → state.conversation
├── addExchange({ role, content }) → pushes { ...exchange, timestamp }, updates updatedAt
├── getSkills() → state.skills
├── registerSkill(name) → adds if not already present
├── getContextWindow() → state.contextWindow
├── setContextWindow(size) → Math.max(1, Math.floor(size))
└── getState() → shallow copy of { ...state, conversation[], skills[] }
```

## Chat Flow (CLI Chat Mode)

**Entry:** `index.js` → `handleConversation(message)` (non-streaming)

```
handleConversation(message)
├── response = await callProvider(providerName, providerConfig, message)
│   ├── isNewThread = sessionState.getConversation().length === 0
│   ├── result = await callReactAgent(agent, message, { configurable: { thread_id, isNewThread } }, systemPrompt)
│   │   └── callReactAgent(agent, message, config, systemPrompt, callback = null):
│   │       ├── messages = [HumanMessage(message)]
│   │       ├── if isNewThread → messages = [SystemMessage(systemPrompt), ...messages]
│   │       └── result = agent.invoke({ messages, ...config })
│   │           └── extractContent(result):
│   │               └── last AI message content → trimmed, returned
│   └── return { provider: providerName, content: result.content, tokens: { input: 0, output: 0 } }
├── sessionState.addExchange({ role: "user", content: message })
├── sessionState.addExchange({ role: "assistant", content: response.content })
├── writeMemoryFile(
│   │   "memory/sessions/",
│   │   `Conversation ${new Date().toISOString()}`,
│   │   { provider: response.provider, sessionId },
│   │   JSON.stringify(sessionState.getConversation(), null, 2)
│   │   )
│   └── [see Memory Persistence Flow]
└── return response
```

## Chat Model Creation

**Entry:** `src/provider/openai.js` → `createChatModel(config)`

```
createChatModel(config)
└── ChatOpenAI({
    ├── model: config.model
    ├── temperature: config.temperature
    ├── maxTokens: config.maxTokens
    ├── apiKey: config.credentials.apiKey
    ├── streaming: config.streaming !== false
    └── configuration: { baseURL: config.base_url }
    })
```

## Agent ReAct Streaming

**Entry:** `src/agent/react.js` → `callReactAgent(..., streamingCallback)`

```
callReactAgent(agent, message, config, systemPrompt, callback)
├── messages = [HumanMessage(message)]
├── if systemPrompt && isNewThread → messages = [SystemMessage(systemPrompt), ...messages]
└── callReactAgentStreaming(agent, messages, message, config, callback)
    ├── stream = await agent.streamEvents(
    │   │   { messages },
    │   │   { version: "v2", configurable: config.configurable }
    │   │   )
    │   └── v2 event stream protocol
    ├── for await (event of stream):
    │   ├── event.event === "on_chat_model_stream":
    │   │   ├── textContent = chunk.content (string or block.text)
    │   │   └── callback({ type: "text", text: textContent })
    │   ├── chunk.reasoning:
    │   │   └── callback({ type: "reasoning", text: chunk.reasoning })
    │   ├── event.event === "on_tool_start" && name === "tool":
    │   │   └── for each tc in input.tool_calls:
    │   │       └── if not duplicate → callback({ type: "tool_start", toolName, toolCallId })
    │   ├── event.event === "on_tool_end" && name === "tool":
    │   │   └── callback({ type: "tool_end", toolName, toolCallId, data: result.slice(0,500) })
    │   └── event.event === "on_tool_error" && name === "tool":
    │       └── callback({ type: "tool_error", toolName, toolCallId, error })
    ├── for each remaining key in toolCallSet → callback({ type: "tool_end", toolName })
    └── return { content: originalMessage } -- fallback
```

**Context length error handling:** Both `callReactAgent` and `callReactAgentStreaming` are wrapped in a retry loop (max 3 iterations). When the LLM returns a 400 error matching context-length patterns (`/maximum\s+context\s+length[^0-9]*?(\d+)\s*tokens?/i` or `/limit[:\s]*(\d+)/i`), the system:

1. Extracts the max context length from the error message
2. Calculates `targetTokens = maxContextLength - maxTokens`
3. Compacts the conversation via `compactConversation()` using tiered retention
4. Rebuilds messages from compacted result and retries

If all 3 iterations fail, the user receives: "The conversation is too long. Please start a new session."

---

## Context Compaction

**Entry:** `src/tools/compactContext.js` → `compactConversation()`, `isContextLengthError()`, `extractContextLength()`

The compaction flow runs inside both `callReactAgent` (non-streaming) and `callReactAgentStreaming`. On a context-length 400 error, the system compacts and retries up to 3 times.

### Non-Streaming Path

```
callReactAgent(agent, message, config, systemPrompt, callback, options)
├── messages = [SystemMessage(systemPrompt), HumanMessage(message)] (new thread)
└── while iteration <= maxCompactionIterations:
    ├── try:
    │   ├── agent.invoke({ messages }, config)
    │   └── extractContent(result, message) → { content: string }
    ├── catch isContextLengthError(err):
    │   ├── effectiveContextLength = extractContextLength(err.message)
    │   ├── targetTokens = effectiveContextLength - effectiveMaxTokens
    │   ├── conversation = messages.filter(!SystemMessage).map({role, content})
    │   ├── compacted = compactConversation({ systemPrompt, conversation, targetTokens })
    │   │   └── tiered-retention strategy:
    │   │       ├── Tier 1: system prompt + last 3 exchanges (full)
    │   │       ├── Tier 2: previous 10 exchanges (summarized)
    │   │       └── Tier 3: oldest exchanges dropped
    │   ├── messages = compacted.compactedMessages.map({role} → SystemMessage/HumanMessage/AIMessage)
    │   ├── iteration++
    │   └── if iteration > maxCompactionIterations → { content: "The conversation is too long..." }
    ├── catch GraphRecursionError → { content: "I've reached the maximum number of reasoning steps..." }
    └── catch other error → rethrow
```

### Streaming Path

```
callReactAgentStreaming(agent, initMessages, originalMessage, config, callback, options)
├── currentMessages = initMessages
└── while iteration <= maxCompactionIterations:
    ├── try:
    │   ├── agent.streamEvents({ messages: currentMessages }, { version: "v2", ... })
    │   ├── for await (event of stream):
    │   │   ├── on_chat_model_stream → callback({ type: "text", text })
    │   │   ├── on_chat_model_stream (reasoning) → callback({ type: "reasoning", text })
    │   │   ├── on_tool_start → callback({ type: "tool_start", toolName, toolCallId })
    │   │   ├── on_tool_end → callback({ type: "tool_end", toolName, toolCallId, data })
    │   │   └── on_tool_error → callback({ type: "tool_error", toolName, toolCallId, error })
    │   ├── emit tool_end for remaining toolCallSet
    │   └── return { content: originalMessage }
    ├── catch:
    │   ├── emit tool_end for remaining toolCallSet
    │   ├── if GraphRecursionError → { content: "I've reached the maximum number of reasoning steps..." }
    │   ├── if isContextLengthError(err):
    │   │   ├── effectiveContextLength = extractContextLength(err.message)
    │   │   ├── targetTokens = effectiveContextLength - effectiveMaxTokens
    │   │   ├── conversation = currentMessages.filter(!SystemMessage).map({role, content})
    │   │   ├── compacted = compactConversation({ systemPrompt: "", conversation, targetTokens })
    │   │   └── currentMessages = compacted.compactedMessages.map({role} → messages)
    │   │       iteration++
    │   │       if iteration > maxCompactionIterations → { content: originalMessage }
    │   │       continue
    │   └── else → rethrow
```

### CompactContext Tool

The `compactContext` tool is also registered as a LangChain tool (zero permissions, always available). The agent can invoke it directly:

```
compactContext({ action: "compact", targetTokens: 50000 })
├── get conversation from checkpointer (via thread_id)
├── compactConversation({ systemPrompt, conversation, targetTokens })
│   └── tiered-retention strategy
└── return { ok: true, compactedMessages: [...], compactedTokenCount: N, strategy: "tiered-retention" }
```

### Error Detection Patterns

Two regex patterns detect context-length errors across providers:

| Pattern | Matches |
|---------|---------|
| `/maximum\s+context\s+length[^0-9]*?(\d+)\s*tokens?/i` | "maximum context length is 128000 tokens", "maximum context length of 8192 tokens exceeded" |
| `/limit[:\s]*(\d+)/i` | "(limit: 8192)", "limit: 4096" |

---

## Tool Permission Enforcement

```
Permission gates per tool:
├── code → always (no perms, no env vars)
├── clarify → always (no perms, always registered)
├── read_file, write_file, patch, search_files → "filesystem:read" or "filesystem:write"
├── terminal → "filesystem:exec", "process:spawn"
├── process → "process:spawn"
├── todo → "filesystem:read", "filesystem:write"
├── memory → "filesystem:read", "filesystem:write"
├── sessionSearch → "filesystem:read"
├── skills_list, skillView → "filesystem:read"
├── createSkill → "filesystem:write"
├── webSearch, web_extract → "network:outbound" + hasSearchKey()
├── visionAnalyze → OPENAI_API_KEY (no perms)
├── image_generate → "network:outbound" + FAL_API_KEY
├── cronjob → "network:outbound"
├── textToSpeech → OPENAI_API_KEY
├── mixtureOfAgents → OPENROUTER_API_KEY
├── sampling → always (no perms)
├── date → always (no perms)
├── compactContext → always (no perms, always registered)
└── tts → OPENAI_API_KEY
```

### Search Backend Detection

```
hasSearchKey()
└── return || (
    EXA_API_KEY || FIRECRAWL_API_KEY || TAVILY_API_KEY ||
    PARALLEL_API_KEY || SEARXNG_URL || BING_API_KEY || CUSTOM_SEARCH_URL
)
```

## File Tool Execution Flow

**Entry:** `src/tools/filesystem.js`

```
read_file:
├── validatePath(input.path, allowedPaths)
│   └── resolvePath(file, dirs) → { allowed: true/false, path }
│       └── resolves → checks if resolved.startsWith(allowed + "/")
├── checkFileLimit(resolved.path, maxReadSize)
│   └── access(file) → stat(file) → compare size vs maxReadBytes
│       └── parseSizeString("1mb") → 1048576
├── readFile(resolved.path, "utf-8")
├── if ENOENT → suggestSimilarFile(path) → Levenshtein distance ≤ 2
└── lines.map((line, i) => `${i+1}|${line}`).join("\n")

write_file:
├── validatePath(input.path, allowedPaths)
├── if input.content.length > MAX_CONTENT_SIZE (500KB) → error
├── mkdir(dirname(resolved.path), recursive)
└── writeFile(resolved.path, content, "utf-8")

patch:
├── validatePath(input.path, allowedPaths)
├── readFile(resolved.path) → content
├── fuzzyMatch(input.oldStr, content)
│   └── 9 strategies: exact, line-exact, trim-trailing/leading, collapse-whitespace,
│       case-insensitive, normalize-newlines, normalize-tabs, loose-substring
├── if no match → suggest Levenshtein line matches
└── content = content.slice(0,match.start) + input.newStr + content.slice(match.end)
    → writeFile → return with unified diff

search_files:
├── validatePath(input.path, allowedPaths)
├── execFile("rg", ["--line-number", "--no-heading", "-n", pattern, resolved.path], timeout: 10s)
└── if ENOENT (no ripgrep) → nativeSearch(pattern, resolved.path, maxResults)
    └── walk() → readdir → stat → readFile → regex test line by line
```

## Terminal Tool Execution Flow

**Entry:** `src/tools/terminal.js`

```
terminal tool:
├── if command.length > MAX_COMMAND_LENGTH (4096) → error
├── if background:
│   ├── executeBackground(command):
│   │   ├── spawn("sh", ["-c", command], { detached: true, stdio: "ignore" })
│   │   ├── trackProcess(child, command) → { pid, child, status: "running", startTime }
│   │   │   └── child.on("exit", "exited"|"exited:code")
│   │   │   └── child.on("error", "error")
│   │   └── child.unref()
│   └── "Started process in background: {command} (PID: {pid})"
└── else (foreground):
    ├── executeForeground(command):
    │   ├── spawn("sh", ["-c", command], { timeout: 30000 })
    │   ├── child.stdout.on("data") → stdout
    │   ├── child.stderr.on("data") → stderr
│   ├── child.on("exit") → { stdout, stderr, exitCode }
│   └── "exitCode: {code}\nstdout: {stdout}" or "Error: {err.message}" on failure

process tool:
└── actions on processTracker Map:
    ├── list → JSON.stringify(entries)
    ├── poll → status
    ├── log → stdout/stderr placeholder
    ├── wait → waiting placeholder
    ├── kill → entry.child.kill("SIGTERM") → setTimeout 5s → SIGKILL if still running
    ├── write → entry.child.stdin?.write(data)
    ├── pause → entry.child.kill("SIGSTOP")
    └── resume → entry.child.kill("SIGCONT")
```

## Web Tool Execution Flow

**Entry:** `src/tools/web.js`

```
webSearch / web_extract:
├── validateUrl(url, allowlist)
│   └── filterUrl(url) → blocks file://, gopher://, dict:// schemes
├── fetchWithTimeout(url, timeoutMs = 10000, allowlist)
│   └── → fetch(url, { signal: AbortController(timeout) }) → response.text()
└── returns HTML-to-text (web_extract) or multi-engine search results (webSearch)

Multi-engine search backends (webSearch):
├── EXA_API_KEY → exa search
├── FIRECRAWL_API_KEY → firecrawl scrape
├── TAVILY_API_KEY → tavily search
├── PARALLEL_API_KEY → parallel.ai search
├── SEARXNG_URL → searxng search
├── BING_API_KEY → bing search
└── CUSTOM_SEARCH_URL → custom endpoint
```


## Deep Agents Orchestration Flow
## Deep Agents Orchestration Flow

**Entry:** `src/agent/deepAgents.js` → `createDeepAgentsOrchestrator()`

```
Deep Agents orchestrator (native multi-agent architecture):
├── createDeepAgent({ model, systemPrompt, tools, middleware, subagents, checkpointer })
│   ├── middleware: filesystem, memory, skills, summarization
│   ├── subagents:
│   │   ├── coding-agent: code editing, debugging, implementation, code review
│   │   └── utility-agent: research, file search, multi-step tasks, general assistance
│   └── orchestrator routes tasks automatically based on task nature
├── agent.stream(input, { streamMode: "messages", subgraphs: true })
│   ├── for each chunk:
│   │   ├── extract text content
│   │   └── streamingCallback({ type: "text", text })
│   └── returns { provider, content, tokens }
└── orchestrator manages routing, state, and observability natively

No process spawning, no marker-based parsing, no manual fan-out coordination.
The deepagents library handles agent lifecycle, state management, and streaming internally.
```

**Entry:** `src/tools/scanAgents.js` → `createScanAgentsTool()`

```
scanAgents tool (requires filesystem:read permission):
├── validate input: path (optional, defaults to config.cwd)
├── validatePath(input.path, allowedPaths)
│   └── resolvePath(file, dirs) → { allowed: true/false, path }
│       └── resolves → checks if resolved.startsWith(allowed + "/")
├── loadAgents(resolved.path, maxReadSize)
│   ├── join(resolved.path, "AGENTS.md") → agentsPath
│   ├── access(agentsPath) → if not exists → return ""
│   ├── checkFileLimit(agentsPath, maxReadSize) → if exceeds → return error
│   └── readFile(agentsPath, "utf-8") → content
│       └── return "## Workspace Rules\n\n" + content.trim()
└── return formatted workspace rules section
```

**Key features:**
- Path validation against sandbox allowed paths
- Configurable scan path (defaults to `config.cwd`)
- File size limit enforcement via `maxReadSize`
- Returns formatted workspace rules section for system prompt injection
- Returns empty string silently if no `AGENTS.md` found

---

## Sandbox Skill Execution

**Entry:** `index.js` → `invokeSkill(skillName, input = {})`

```
invokeSkill(skillName, input)
├── skill = registry.get(skillName)
├── if !skill → throw `Unknown skill: ${skillName}`
├── if skill.disabled → throw `Skill "${skillName}" is disabled`
├── permissions = resolvePermissions(skill.metadata)
│   └── merge DEFAULT_PERMS(["filesystem:read", "env:read"]) with skill-level permissions
└── return { skill, input, output: `Skill ${skillName} executed...`, exitCode: 0 }
```

### Scheduled Skill Execution

```
runScheduledSkill(schedule, sandbox, sessionState)
├── Load context:
│   ├── if contextFile exists → readFileSync(contextFile)
│   └── else if contextFile → loadContext("memory/context/")
│       └── recent .md files → sort by timestamp → combine `[Context: title]\nbody`
├── sandbox({ skillName, input, context, permissions: sessionState.skills || [] })
│   └── runSandbox(options):
│       ├── enforceCapabilities(permissions) → rules
│       ├── filterEnv(process.env, whitelist)
│       ├── spawn(script, [], { cwd, env, execArgv: ["--max-old-space-size=512"], stdio: ["pipe","pipe","pipe"] })
│       ├── child.stdout.on("data") → result.stdout
│       ├── child.stderr.on("data") → result.stderr
│       ├── child.on("exit") → resolve code
│       └── handleTimeout(child, { seconds, gracePeriod })
│           └── timeout → SIGTERM → gracePeriod → SIGKILL → "terminated" | "killed"
└── return { stdout, stderr, exitCode }

```

## Deep Agents Log Management


### Code Execution

**Entry:** `src/tools/code.js` → `createCodeExecutionTool()`

```
code tool (executeCode):
├── validate code language: "python3" | "javascript" | "shell"
├── write code to temp file in /tmp/madz-code-*.js
├── create import hook for python3 (sys.path manipulation)
├── spawn process:
│   ├── python3 temp.py (for python3)
│   ├── node temp.js (for javascript)
│   └── sh -c "code" (for shell)
├── POSIX setrlimit(RLIMIT_AS) → hard memory limit (memoryLimit MB)
│   └── import("posix") → setrlimit (Linux only)
├── timeout: 30 seconds default
└── return { stdout, stderr, exitCode }
```

### Mixture of Agents (MoA)

**Entry:** `src/tools/moa.js` → `createMixtureOfAgentsTool()`

```
mixtureOfAgents tool:
├── validate OPENROUTER_API_KEY exists
├── for each of 4 agent roles in prompt:
│   ├── ChatOpenRouter({ model: "openrouter/auto", ... })
│   ├── agent.invoke({ systemPrompt: role, userPrompt })
│   └── collect response[response]
├── aggregateResponses(responses[])
│   └── format responses with role labels
│   └── return { combinedAnalysis, individualResponses: [{role, response}] }
└── maxTokens: 2000
```

### Text-to-Speech

**Entry:** `src/tools/tts.js` → `createTextToSpeechTool()`

```
textToSpeech tool:
├── validate OPENAI_API_KEY exists
├── ChatOpenAI.tts.create({
│   ├── model: "tts-1"
│   ├── input: text
│   ├── voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
│   └── response_format: "mp3" | "wav" | "opus" | "aac" | "flac" | "pcm"
├── write MP3 bytes to ~/voice-memos/{timestamp}-{slug}.mp3
└── return { path, status: "complete" }
```

### Image Generation

**Entry:** `src/tools/image.js` → `createImageGenerationTool()`

```
image_generate tool:
├── validate FAL_API_KEY exists
├── validateUrl(prompt) → blocks empty prompts
├── fal.queue.submit("fal-ai/klein/fast", { prompt, ...options })
│   ├── model: "fal-ai/klein/fast" | "fal-ai/air-playground"
│   ├── image_count: configurable
│   └── image_size: configurable
├── wait for queue with poll (pollInterval = 0.5s, polling = 600s)
├── download image URLs
└── return { images: [{ url }], status: "complete" | "processing" }
```

### Clarify

**Entry:** `src/tools/clarify.js` → `createClarifyTool()`

```
clarify tool (zero-permission, always registered):
├── readFileSync("memory/context/clarifications.md") → existing questions
├── append new question with timestamp
├── writeFileSync("memory/context/clarifications.md")
└── return { status: "ok", message: "Clarification noted." }
```

### Context Compaction

**Entry:** `src/tools/compactContext.js` → `createCompactContextTool()`

```
compactContext tool (zero-permission, always registered):
├── action === "compact" → proceed
├── get conversation from checkpointer (via thread_id) or options.conversation
├── compactConversation({ systemPrompt, conversation, targetTokens }):
│   ├── estimateTokens(text) → ceil(text.length / 4)
│   ├── Group conversation into exchange pairs (user + assistant)
│   ├── Tier 1: Keep last N exchanges in full (default 3)
│   ├── Tier 2: Summarize previous M exchanges (default 10) → [User/Assistant]: preview...
│   ├── Tier 3: If still over budget → reduce summarize window → keep only last exchange
│   └── Final fallback: system prompt + last user message only
└── return { ok, compactedMessages, compactedTokenCount, originalTokenCount, strategy, warning? }

isContextLengthError(err):
├── err.message matches /maximum\s+context\s+length[^0-9]*?(\d+)\s*tokens?/i → true
├── err.message matches /limit[:\s]*(\d+)/i → true
└── else → false

extractContextLength(err.message):
├── Try pattern 1 → extract digits → parseInt
├── Fall back to pattern 2 → extract digits → parseInt
└── else → null
```

## Memory Persistence Flow

**Entry:** `src/memory/writer.js` → `writeMemoryFile(directory, title, frontmatter, body)`

```
writeMemoryFile(directory, title, frontmatter, body = "")
├── mkdirSync(directory, recursive)
├── timestamp = new Date().toISOString().replace(/[:.]/g, "-")
├── slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
│   └── filename = `${timestamp}-${slug || "entry"}.md`
├── filepath = join(directory, filename)
└── writeFileSync(filepath, [
       "---",
       `title: "${title}"`,
       `timestamp: "${timestamp}"`,
       ...Object.entries(frontmatter) → `${key}: "${value}"` or `${key}: value`,
       "---",
       "",
       body,
       "",
    ].join("\n"))
└── return filepath
```

### Frontmatter Parsing

```
parseFrontmatter(content)
├── match /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
│   ├── match[1] → yaml.load() → frontmatter
│   └── match[2] → body content
└── return { frontmatter, content: body.trim() }

readMemoryFile(filepath)
├── if !existsSync(filepath) → null
├── content = readFileSync(filepath, "utf-8")
└── return { frontmatter, content, path }
```

## Context Loading

**Entry:** `src/memory/context.js` → `loadContext(contextDir, limit = 10)`

```
loadContext("memory/context/", limit)
├── files = readdirSync(fullPath).filter(f → f.endsWith(".md"))
├── for each file:
│   ├── readFileSync(filepath, "utf-8")
│   ├── parseFrontmatter(content) → { frontmatter, body }
│   └── { filepath, frontmatter, body, timestamp: frontmatter.timestamp }
├── sort by timestamp (descending, localeCompare)
├── recent = sorted.slice(0, limit)
└── recent.map(entry → `\n[Context: ${title}]\n${body.trim()}`).join("\n")
```

## Schedule Manager Lifecycle

**Entry:** `src/scheduler/scheduler.js` → `ScheduleManager`

The ScheduleManager is a simple CRUD class. Scheduling is delegated to the system crontab — there is no in-process clock tick loop.

```
scheduleManager = new ScheduleManager(maxConcurrent = 1)
├── #scheduleEntry = new Map()

scheduleManager.register(entries = [])
├── results = []
└── for each entry in entries:
    ├── if !entry.name || !entry.cron || !entry.skill:
    │   └── results.push({ name: entry.name, error: "Missing required fields" })
    └── #scheduleEntry.set(entry.name, { ...entry, paused: false, lastRun: null })
└── return results

scheduleManager.list()
└── for each entry: { ...entry }

scheduleManager.pause(name) → entry.paused = true

scheduleManager.resume(name) → entry.paused = false

scheduleManager.runNow(name, scheduler)
├── entry = #scheduleEntry.get(name)
├── if !entry → { error: "Unknown schedule: ${name}" }
├── if entry.paused → { error: "Schedule is paused" }
├── contextPrefix = loadContext(entry.contextFile) or loadContext("memory/context/")
├── sandbox({ skillName: entry.skill, input: entry.input, context: contextPrefix, permissions })
│   └── [see Sandbox Skill Execution]
├── entry.lastRun = new Date().toISOString()
└── return result
```

## Cron System

**Entry:** `src/scheduler/cron.js` → `Cron` object with static methods

The Cron module manages entries in the user's system crontab using `# --- BEGIN madz-schedules ---` / `# --- END madz-schedules ---` block delimiters.

```
Cron.isAvailable()
├── execSync("which crontab") → { available: true }
└── catch → { available: false, error }

Cron._readCrontab()
├── execSync("crontab -l 2>&1") → crontab content
└── if "no crontab" → return ""

Cron.add({ name, cron, command })
├── current = _readCrontab()
├── if entry with matching name exists → { added: false, error: "already exists" }
├── newEntry = `<cron>  <command>  # madz-schedule: <name>`
├── between BEGIN/END markers → insert newEntry
├── execSync(`crontab -`) → write updated crontab
└── return { added: true }

Cron.remove(name)
├── current = _readCrontab()
├── filter out entry with matching name
├── execSync(`crontab -`) → write updated crontab
└── return { removed: true }
```

## Auto Schedule

**Entry:** `src/scheduler/autoSchedule.js` → `setupAutoSchedule()`

Returns a callback invoked after `saveProfile()` succeeds during onboarding.

```
setupAutoSchedule()
└── returns autoScheduleCallback()
    ├── cwd = process.cwd()
    ├── job = { name: "reflection-daily", cron: "0 2 * * *", command: `cd ${cwd} && node index.js --chat "/reflection"` }
    ├── Cron.add(job) → adds to system crontab
    └── persistJobFile(job.name, job, cwd)
        └── writes `memory/schedules/reflection-daily.json`
```


## Memory Retention Cleanup

**Entry:** `src/memory/retention.js` → `cleanRetainedMemory(), enforceMaxEntries()`

```
cleanRetainedMemory("memory/", retentionDays = 90)
├── cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
├── for each .md file:
│   └── if stat.mtimeMs < cutoff → unlinkSync(filepath), removed++
└── return removed

enforceMaxEntries("memory/", maxEntries = 1000)
├── files = readdirSync(fullPath).filter(.md).map(.mtime)
├── sort by mtime ascending
├── if files.length > maxEntries:
│   └── for i in 0..excess → unlinkSync(files[i])
└── return removed
```

## Profile Management

**Entry:** `src/memory/profile.js` → `loadProfile(), saveProfile(), formatProfileContext(), processOnboardingInput(), getAttribute()`

```
loadProfile()
├── readFileSync("memory/context/profile.md", "utf-8")
├── if file exists → parseFrontmatter(content)
├── else → { ATTRIBUTES, data: {} }
└── return { data, fullContext: formatProfileContext() }

saveProfile(data)
├── sanitizeProfileData(data, ATTRIBUTES) → only known attribute keys
├── writeFileSync("memory/context/profile.md", frontmatter + body)
└── return sanitized

formatProfileContext(profile)
└── for each attribute in ATTRIBUTES:
    └── `${attribute.label}: ${profile.data[attribute.key]}`

processOnboardingInput(key, value)
└── validate attribute key against ATTRIBUTES → update profile.data

getAttribute(key)
└── loadProfile().data[key]

ATTRIBUTES (known profile fields):
├── attractor: string → user's primary interest/focus
├── expertise: string[] → user knowledge areas
├── tools: string[] → user's development tools
├── voice: string → user's preferred communication style
└── preferences: object → structured user preferences
```

## Shutdown Flow

**Entry:** `src/session/shutdown.js` → `handleShutdown()` + `registerShutdownHandler()`

```
registerShutdownHandler(cleanupFn)
├── process.on("SIGTERM", () => cleanup())
├── process.on("SIGINT", () => cleanup())
└── return () => process.off("SIGTERM", process.off("SIGINT", ...)

# At exit (onExit from ink or SIGTERM):
saveSession(sessionsDir, conversation)
├── writeMemoryFile(sessionsDir, "Session", metadata, JSON.stringify(conversation))
└── [see Memory Persistence Flow]

cleanRetainedMemory(config.memory.directory, config.memory.retention.days)
└── [see Memory Retention Cleanup]

enforceMaxEntries(config.memory.directory, config.memory.retention.maxEntries)
└── [see Memory Retention Cleanup]

shutdownTelemetry()
└── [see Telemetry Initialization]
```

## File Dependencies

```
index.js
├── config/loader.js → schemas.js, mutate.js
│     └── js-yaml
├── config/mutate.js
├── config/schemas.js → zod
├── provider/openai.js → @langchain/openai
├── agent/react.js → @langchain/langgraph, @langchain/core, cache/llm_cache.js — ReAct agent wrapper with cache-aside LLM response caching (conditional on tool usage, streaming support, fail-open)
├── cache/llm_cache.js → tiny-lru, node:crypto — cache-aside LRU response cache with SHA-256 key generation, configurable size/TTL, fail-open behavior
├── tools/index.js → (all tool files below)
│     ├── tools/filesystem.js → @langchain/core, zod, node:fs/promises, node:path, tools/common.js
│     ├── tools/terminal.js → @langchain/core, zod, node:child_process
│     ├── tools/web.js → fetch, node:fs/promises, tools/common.js (filterUrl, validateUrl)
│     ├── tools/common.js → sandbox/urlFilter.js, sandbox/pathResolver.js, node:fs/promises
│     ├── tools/memory.js → js-yaml, node:fs/promises — key-value entry storage. Each entry stored as an individual .md file in context directory with createdDate/updatedDate metadata. Actions: create, read, update, delete, list
│     ├── tools/sessionSearch.js → node:fs/promises, memory/reader.js
│     ├── tools/code.js → node:child_process, node:fs/promises, node:path, posix (setrlimit memory limit)
│     ├── tools/todo.js → node:fs/promises — CRUD task management in memory/tools/todo.json
│     ├── tools/clarify.js → node:fs/promises — zero-permission clarification questions
│     ├── tools/skills.js → registry (list discovered skills, view SKILL.md content, createSkill — programmatic skill scaffolding with spec validation)
│     ├── tools/vision.js → OPENAI_API_KEY — image analysis via ChatOpenAI vision
│     ├── tools/image.js → FAL_API_KEY — image generation via fal.ai queue
│     ├── tools/tts.js → OPENAI_API_KEY — text-to-speech via OpenAI TTS API
│     ├── tools/moa.js → OPENROUTER_API_KEY — mixture-of-agents (4 parallel OpenRouter calls + aggregation)
│     ├── tools/cron.js → node:fs/promises — cron job CRUD operations
│     ├── tools/compactContext.js → @langchain/core, zod — automatic conversation context compaction on LLM 400 errors (tiered retention, retry loop, error detection)
│     ├── tools/subAgentLog.js → node:fs/promises, node:path — subAgent log management (list, read, cleanup); zero-permission, always registered
│     └── tools/...
├── sandbox/pathResolver.js → node:path
├── sandbox/urlFilter.js → node:url
├── sandbox/runner.js → node:child_process, sandbox/timeoutHandler.js, envInjector.js, capability.js
├── registry/registry.js → discoverer.js, validator.js
├── registry/discoverer.js → js-yaml, node:fs, node:path
├── registry/validator.js → types.js (zod schemas)
├── registry/types.js → zod
├── scheduler/scheduler.js → node:fs/promises — ScheduleManager CRUD class (register, list, pause, resume, runNow)
├── scheduler/cron.js → node:child_process, node:fs/promises, node:path — Cron object (isAvailable, add, remove)
├── scheduler/autoSchedule.js → node:fs — setupAutoSchedule() callback for reflection-daily cron
├── scheduler/index.js → re-exports ScheduleManager and Cron
├── memory/writer.js → node:fs, node:path
├── memory/reader.js → js-yaml, node:fs
├── memory/context.js → node:fs, node:path, memory/reader.js
├── memory/retention.js → node:fs, node:path
├── memory/prompts.js → node:fs
├── memory/profile.js → node:fs — user profile management: ATTRIBUTES, loadProfile, saveProfile, formatProfileContext, processOnboardingInput
├── session/factory.js → node:crypto (randomUUID)
├── session/stateManager.js
├── session/checkpointer.js → @langchain/langgraph, @langchain/langgraph-checkpoint-sqlite — createCheckpointer() returns MemorySaver (in-memory) or SQLiteCheckpointer (persistent)
├── session/loader.js → fs, path, memory/reader.js
├── session/saver.js → fs, path, memory/writer.js
├── session/onboarding.js → session/stateManager.js — onboarding state machine (INIT → ATTRACTOR → COLLECT → SAVE → TRANSCEND)
└── telemetry/provider.js → @opentelemetry/sdk-node
```
