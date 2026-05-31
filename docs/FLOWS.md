# Code Flows

Call chains and data flows for all primary code paths in the project, excluding the TUI (see [TUI_FLOWS.md](./TUI_FLOWS.md)).

## Table of Contents

| # | Section | # | Section |
|---|---------|---|---------|
| 1 | [Application Startup](#1-application-startup) | 12 | [File Tool Execution Flow](#12-file-tool-execution-flow) |
| 2 | [Config Loading](#2-config-loading) | 13 | [Terminal Tool Execution Flow](#13-terminal-tool-execution-flow) |
| 3 | [Telemetry Initialization](#3-telemetry-initialization) | 14 | [Web Tool Execution Flow](#14-web-tool-execution-flow) |
| 4 | [Skill Registry Discovery & Validation](#4-skill-registry-discovery--validation) | 15 | [Sandbox Skill Execution](#15-sandbox-skill-execution) |
| 5 | [Tool Configuration Building](#5-tool-configuration-building) | 16 | [Memory Persistence Flow](#16-memory-persistence-flow) |
| 6 | [Agent Creation](#6-agent-creation) | 17 | [Context Loading](#17-context-loading) |
| 7 | [Session Creation](#7-session-creation) | 18 | [Schedule Manager Lifecycle](#18-schedule-manager-lifecycle) |
| 8 | [Chat Flow (CLI Chat Mode)](#8-chat-flow-cli-chat-mode) | 19 | [Memory Retention Cleanup](#19-memory-retention-cleanup) |
| 9 | [Chat Model Creation](#9-chat-model-creation) | 20 | [Shutdown Flow](#20-shutdown-flow) |
| 10 | [Agent ReAct Streaming](#10-agent-react-streaming) | 21 | [File Dependencies](#21-file-dependencies) |
| 11 | [Tool Permission Enforcement](#11-tool-permission-enforcement) | | |

## 1. Application Startup

**Entry:** `index.js`

```
index.js (main)
├── import { loadConfig } from "./src/config/loader.js"
├── config = loadConfig()
│   └── [see Flow 2]
├── if config.telemetry.enabled:
│   ├── initTelemetry(config.telemetry)
│   ├── tracer = getTracer()
│   └── shutdownFn = shutdownTelemetry
├── registry = new SkillRegistry()
├── registry.discover("skills/")
│   └── [see Flow 4]
├── { writeMemoryFile, readMemoryFile, loadContext, cleanRetainedMemory, enforceMaxEntries }
│   └── from "./src/memory/index.js"
├── { createSession, SessionStateManager, saveSession, handleShutdown, registerShutdownHandler }
│   └── from "./src/session/index.js"
├── scheduleManager = new ScheduleManager(config.schedules.maxConcurrent)
├── scheduleManager.register(config.schedules.entries)
│   └── [see Flow 18]
├── providerName = Object.keys(config.providers)[0] || "openai"
├── { sessionId, state: initialState } = createSession({
│   │   provider: providerName,
│   │   contextWindow: config.session.context_window_size,
│   │   })
│   └── [see Flow 7]
├── sessionState = new SessionStateManager(initialState)
├── { loadSystemPrompt } = import("./src/memory/prompts.js")
├── systemPrompt = loadSystemPrompt()
│   └── reads prompts/SYSTEM_PROMPT.md, strips frontmatter
├── providerConfig = config.providers[providerName]
├── tools = await buildToolConfig({
│   │   permissions, allowedPaths, maxReadSize, registry,
│   │   conversationsDir, safety, timeout, memoryLimit,
│   │   })
│   └── [see Flow 5]
├── model = createChatModel(providerConfig)
│   └── [see Flow 9]
├── { createCheckpointer } = import("./src/session/checkpointer.js")
├── checkpointer = createCheckpointer(config.persistence)
├── agent = createReactAgent(model, tools, checkpointer)
│   └── [see Flow 8]
├── sessionConfig = { configurable: { thread_id: sessionId } }
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
│   │       └── [see Flow 8]
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

## 2. Config Loading

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
│       ├── DROPPED_KEYS = ["providers", "credentials"]
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

## 3. Telemetry Initialization

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

## 4. Skill Registry Discovery & Validation

**Entry:** `index.js` → `registry.discover("skills/")`

```
registry.discover(skillsDir = "skills/")
├── discovered = discoverSkills(skillsDir)
│   └── discoverSkills(fullDir):
│       ├── entries = readdirSync(fullDir)
│       └── for each entry name:
│           ├── stat → skip if not directory
│           ├── try skill.yaml → yaml.load()
│           ├── try skill.json → JSON.parse()
│           ├── try SKILL.md (fallback → { name, _path })
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

## 5. Tool Configuration Building

**Entry:** `index.js` → `buildToolConfig(options)`

```
buildToolConfig({ permissions, allowedPaths, maxReadSize, registry, safety, timeout, memoryLimit })
├── enabledSet = new Set(permissions)
├── runtimeOptions = { allowedPaths, maxReadSize, registry, safety, timeout, memoryLimit }
├── for each [toolName, requiredPerms] in TOOL_PERMISSIONS:
│   ├── hasAllPerms = requiredPerms.every(perm => enabledSet.has(perm))
│   ├── switch toolName:
│   │   ├── clarify | execute_code: → always create (no perms needed)
│   │   ├── web_search | web_extract: → if hasAllPerms && hasSearchKey()
│   │   ├── vision_analyze: → if OPENAI_API_KEY
│   │   ├── image_generate: → if hasAllPerms && FAL_API_KEY
│   │   ├── cronjob: → if hasAllPerms
│   │   ├── text_to_speech: → if OPENAI_API_KEY
│   │   ├── mixture_of_agents: → if OPENROUTER_API_KEY
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

## 6. Agent Creation

**Entry:** `index.js` → `createReactAgent(model, tools, checkpointer)`

```
createReactAgent(model, tools, checkpointer)
└── createReactAgentGraph({ llm: model, tools, ...(checkpointer && { checkpointer }) })
    └── Returns compiled LangGraph ReAct agent
```

## 7. Session Creation

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

## 8. Chat Flow (CLI Chat Mode)

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
│   │   "memory/conversations/",
│   │   `Conversation ${new Date().toISOString()}`,
│   │   { provider: response.provider, sessionId },
│   │   JSON.stringify(sessionState.getConversation(), null, 2)
│   │   )
│   └── [see Flow 16]
└── return response
```

## 9. Chat Model Creation

**Entry:** `src/provider/openai.js` → `createChatModel(config)`

```
createChatModel(config)
└── ChatOpenAI({
    ├── model: config.model
    ├── temperature: config.temperature
    ├── maxTokens: config.maxTokens
    ├── apiKey: config.credentials.apiKey
    ├── streaming: config.streaming
    └── baseURL: config.base_url
    })
```

## 10. Agent ReAct Streaming

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

## 11. Tool Permission Enforcement

**Entry:** `src/tools/index.js` → `buildToolConfig()`

```
Permission gates per tool:
├── clarify, execute_code → always (no perms, no env vars)
├── read_file, write_file, patch, search_files → "filesystem:read" or "filesystem:write"
├── terminal → "filesystem:exec", "process:spawn"
├── process → "process:spawn"
├── todo → "filesystem:read", "filesystem:write"
├── memory → "filesystem:read", "filesystem:write"
├── session_search → "filesystem:read"
├── skills_list, skill_view → "filesystem:read"
├── web_search, web_extract → "network:outbound" + hasSearchKey()
├── vision_analyze → OPENAI_API_KEY (no perms)
├── image_generate → "network:outbound" + FAL_API_KEY
├── cronjob → "network:outbound"
├── text_to_speech → OPENAI_API_KEY
├── mixture_of_agents → OPENROUTER_API_KEY
└── hello_world → always (debug)
```

### Search Backend Detection

```
hasSearchKey()
└── return || (
    EXA_API_KEY || FIRECRAWL_API_KEY || TAVILY_API_KEY ||
    PARALLEL_API_KEY || SEARXNG_URL || BING_API_KEY || CUSTOM_SEARCH_URL
)
```

## 12. File Tool Execution Flow

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

## 13. Terminal Tool Execution Flow

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
    │   └── "exitCode: {code}\nstdout: {stdout}" or stderr variant

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

## 14. Web Tool Execution Flow

**Entry:** `src/tools/web.js`

```
web_search / web_extract:
├── validateUrl(url, allowlist)
│   └── filterUrl(url) → blocks file://, gopher://, dict:// schemes
├── fetchWithTimeout(url, timeoutMs = 10000, allowlist)
│   └── → fetch(url, { signal: AbortController(timeout) }) → response.text()
└── returns HTML-to-text (web_extract) or multi-engine search results (web_search)

Multi-engine search backends (web_search):
├── EXA_API_KEY → exa search
├── FIRECRAWL_API_KEY → firecrawl scrape
├── TAVILY_API_KEY → tavily search
├── PARALLEL_API_KEY → parallel.ai search
├── SEARXNG_URL → searxng search
├── BING_API_KEY → bing search
└── CUSTOM_SEARCH_URL → custom endpoint
```

## 15. Sandbox Skill Execution

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
│       ├── fork(script, [], { cwd, env, execArgv: ["--max-old-space-size=512"], stdio: ["pipe","pipe","pipe","ipc"] })
│       ├── child.stdout.on("data") → result.stdout
│       ├── child.stderr.on("data") → result.stderr
│       ├── child.on("exit") → resolve code
│       └── handleTimeout(child, { seconds, gracePeriod })
│           └── timeout → SIGTERM → gracePeriod → SIGKILL → "terminated" | "killed"
└── return { stdout, stderr, exitCode }
```

## 16. Memory Persistence Flow

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

## 17. Context Loading

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
└── recent.map(entry → `\\n[Context: ${title}]\\n${body.trim()}`).join("\\n")
```

## 18. Schedule Manager Lifecycle

**Entry:** `src/scheduler/scheduler.js` → `ScheduleManager`

```
scheduleManager = new ScheduleManager(maxConcurrent = 1)
├── #queue = ScheduleQueue(maxConcurrent)

scheduleManager.register(entries = [])
├── results = []
└── for each entry in entries:
    ├── parsed = parseScheduleEntry(entry)
    │   ├── validate name and cron
    │   ├── validateCron(expression) → 5-6 fields, regex patterns
    │   └── return { valid, error, parsed: { name, cron, skill, input, contextFile, enabled, paused, lastRun } }
    ├── if parsed.valid: #scheduleEntry.set(name, parsed)
    └── else: results.push({ name, error })
└── return results

scheduleManager.list()
└── for each entry: { ...entry, queued: #queue.getLength() }

scheduleManager.pause(name) → entry.paused = true

scheduleManager.resume(name) → entry.paused = entry.enabled !== false

scheduleManager.runNow(name, scheduler)
├── entry = #scheduleEntry.get(name)
├── if !entry → { error: "Unknown" }
├── if entry.paused → { error: "paused" }
├── result = await runScheduledSkill(entry, scheduler.sandbox, scheduler.state)
│   └── [see Flow 15]
├── logScheduleResult({ scheduleName, cron, startTime, endTime, exitCode, stdout, stderr })
│   └── writes markdown file to memory/schedules/
└── entry.lastRun = endTime; return result

scheduleManager.start(scheduler, intervalMs = 60000)
├── #running = true
├── #tickId = setInterval(() => #clockTick(scheduler), intervalMs)
└── #clockTick(scheduler) -- run once immediately

scheduleManager.stop()
├── #clockId.clearInterval()
└── #queue.clear()
```

### Clock Tick & Cron Matching

```
#clockTick(scheduler)
├── if !#running → return
├── for each entry in #scheduleEntry:
│   ├── if entry.paused → skip
│   └── if shouldRun(entry.cron, now):
│       │   shouldRun(cron, now):
│       │   └── minutes/hours from cron fields → matchesField(value, field):
│       │       ├── "*" → true
│       │       ├── */N → start + (value - start) % step === 0
│       │       ├── range (1-5) → value >= from && value <= to
│       │       └── single value → value === parseInt(field)
│       └── #queue.enqueue({ ...entry, triggeredAt: now.toISOString() })
│
└── #queue.dequeue() → auto-executes tasks up to maxConcurrent
```

## 19. Memory Retention Cleanup

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

## 20. Shutdown Flow

**Entry:** `src/session/shutdown.js` → `handleShutdown()` + `registerShutdownHandler()`

```
registerShutdownHandler(cleanupFn)
├── process.on("SIGTERM", () => cleanup())
├── process.on("SIGINT", () => cleanup())
└── return () => process.off("SIGTERM", process.off("SIGINT", ...)

# At exit (onExit from ink or SIGTERM):
saveSession(conversationsDir, conversation)
├── writeMemoryFile(conversationsDir, "Session", metadata, JSON.stringify(conversation))
└── [see Flow 16]

cleanRetainedMemory(config.memory.directory, config.memory.retention.days)
└── [see Flow 19]

enforceMaxEntries(config.memory.directory, config.memory.retention.maxEntries)
└── [see Flow 19]

shutdownTelemetry()
└── [see Flow 3]
```

## 21. File Dependencies

```
index.js
├── config/loader.js → schemas.js, mutate.js
│     └── js-yaml
├── config/mutate.js
├── config/schemas.js → zod
├── provider/openai.js → @langchain/openai
├── agent/react.js → @langchain/langgraph, @langchain/core
├── tools/index.js → (all tool files below)
│     ├── tools/filesystem.js → @langchain/core, zod, node:fs/promises, node:path, tools/common.js
│     ├── tools/terminal.js → @langchain/core, zod, node:child_process
│     ├── tools/web.js → fetch, node:fs/promises, tools/common.js (filterUrl, validateUrl)
│     ├── tools/common.js → sandbox/urlFilter.js, sandbox/pathResolver.js, node:fs/promises
│     ├── tools/memory.js → js-yaml, node:fs/promises
│     ├── tools/sessionSearch.js → node:fs/promises, memory/reader.js
│     ├── tools/code.js → node:child_process, node:fs/promises, node:path
│     ├── tools/filesystem.js → tool decorators + factory funcs
│     └── tools/... (vision, image, tts, moa, etc.)
├── sandbox/pathResolver.js → node:path
├── sandbox/urlFilter.js → node:url
├── sandbox/runner.js → node:child_process, sandbox/timeoutHandler.js, envInjector.js, capability.js
├── registry/registry.js → discoverer.js, validator.js
├── registry/discoverer.js → js-yaml, node:fs, node:path
├── registry/validator.js → types.js (zod schemas)
├── registry/types.js → zod
├── scheduler/scheduler.js → parser.js, queue.js, runner.js, logger.js
├── scheduler/parser.js → node:fs, memory/context.js
├── scheduler/queue.js
├── scheduler/runner.js → memory/context.js, node:fs
├── scheduler/logger.js → node:fs, node:path
├── memory/writer.js → node:fs, node:path
├── memory/reader.js → js-yaml, node:fs
├── memory/context.js → node:fs, node:path, memory/reader.js
├── memory/retention.js → node:fs, node:path
├── memory/prompts.js → node:fs
├── session/factory.js → node:crypto (randomUUID)
├── session/stateManager.js
├── session/checkpointer.js → @langchain/langgraph
├── session/loader.js → fs, path, memory/reader.js
├── session/saver.js → fs, path, memory/writer.js
└── telemetry/provider.js → @opentelemetry/sdk-node
```
