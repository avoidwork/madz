# Code Flows

Call chains and data flows for all primary code paths in the project, excluding the TUI (see [TUI_FLOWS.md](./TUI_FLOWS.md)).

## Table of Contents

- [Application Startup](#application-startup)
- [Config Loading](#config-loading)
- [Telemetry Initialization](#telemetry-initialization)
- [Skill Registry Discovery & Validation](#skill-registry-discovery--validation)
- [Tool Configuration Building](#tool-configuration-building)
- [Deep Agents Orchestration Flow](#deep-agents-orchestration-flow)
- [Backend Routing Flow](#backend-routing-flow)
- [Session Creation](#session-creation)
- [Chat Flow (CLI Chat Mode)](#chat-flow-cli-chat-mode)
- [Chat Model Creation](#chat-model-creation)
- [Tool Permission Enforcement](#tool-permission-enforcement)
- [Web Tool Execution Flow](#web-tool-execution-flow)
- [Process Tool Execution Flow](#process-tool-execution-flow)
- [Text-to-Speech](#text-to-speech)
- [Image Generation](#image-generation)
- [Clarify](#clarify)
- [Cron Job Execution Flow](#cron-job-execution-flow)
- [Sandbox Skill Execution](#sandbox-skill-execution)
- [Memory Persistence Flow](#memory-persistence-flow)
- [Context Loading](#context-loading)
- [Schedule Manager Lifecycle](#schedule-manager-lifecycle)
- [Cron System](#cron-system)
- [Memory Retention Cleanup](#memory-retention-cleanup)
- [Profile Management](#profile-management)
- [Shutdown Flow](#shutdown-flow)
- [File Dependencies](#file-dependencies)

## Application Startup

**Entry:** `index.js`

```
index.js (main)
├── yargs parse → { mode, session, indexCode, message }
├── config = loadConfig()
│   └── [see Config Loading]
├── writeEnvCron(process.cwd()) → dumps process.env to .env.cron (for cron-fired processes)
├── if config.schedules.syncOnInit !== false:
│   └── Cron.sync(schedulesDir) → reconciles memory/schedules/*.json with system crontab
│       └── _ensureReflectionJob() seeds reflection-daily.json if missing
├── ensureSessionsDir(config.cwd + "/memory/sessions/")
├── ensureToolsDir(config.cwd + "/memory/tools/")
├── if !(await hasProfile()):
│   └── onboardingInstance = createOnboarding(ATTRIBUTES, { onSave })
├── if config.telemetry.enabled:
│   ├── initTelemetry(config.telemetry)
│   ├── tracer = getTracer()
│   └── shutdownFn = shutdownTelemetry
├── registry = new SkillRegistry(); ensureSkillsDir(); registry.discover()
│   └── [see Skill Registry Discovery & Validation]
├── { readMemoryFile, loadContext, expireEphemeralMemories } from "./src/memory/index.js"
├── initGC({ idleTimeoutMs, maxGcPerHour, onIdle }) → V8 GC idle manager (if enabled)
├── { createSession, SessionStateManager, saveSession, handleShutdown, registerShutdownHandler }
│   └── from "./src/session/index.js"
├── scheduleManager = ScheduleManager.loadFromDisk(config.cwd + "/" + schedulesDir)
│   └── [see Schedule Manager Lifecycle]
├── providerName = Object.keys(config.providers)[0] || "openai"
├── { state: initialState } = createSession({ provider: providerName })
│   └── [see Session Creation]
├── sessionState = new SessionStateManager(initialState)
├── queueMicrotask → expireEphemeralMemories(cwd + "/" + contextDir)  (non-blocking)
├── ensureCheckpointsDir(checkpointsDir)
├── checkpointer = createCheckpointer(config) → SqliteSaver | MemorySaver
├── agent = createDeepAgentsOrchestrator(checkpointer)
│   └── [see Deep Agents Orchestration Flow]
├── sessionConfig = { configurable: { thread_id: sessionState.getSessionId() } }
├── runShutdown = () => { gcManager.stop(); shutdownFn() }
├── registerShutdownHandler(runShutdown)
├── isMain = process.argv[1] === fileURLToPath(import.meta.url)
├── if isMain:
│   ├── if --index-code: vector reindex all config.vector.projects → process.exit(0)
│   ├── mode = --mode flag ("chat" default | "interactive")
│   ├── if mode === "chat":
│   │   ├── message = first non-flag argv arg (default "Hello")
│   │   ├── handleConversation(message, chatSessionId) → [see Chat Flow (CLI Chat Mode)]
│   │   └── runShutdown() + flushLogger() + process.exit(0)
│   └── else (interactive):
│       ├── { render } = import("ink")
│       ├── App = import("./src/tui/app.js").default
│       └── render(<App config registry sessionState dispatchProvider scheduleManager
│   │                    invokeSkill appInfo onboarding onSaveSession gcManager gcTrigger
│   │                    checkpointer />)
│           └── onExit: handleShutdown({ onShutdown }) + flushLogger() + exit
└── export: config, sessionState, registry, tracer, dispatchProvider,
            handleConversation, invokeSkill, handleShutdown, scheduleManager,
            setConfigValue, loadContext, readMemoryFile
```

## Config Loading

**Entry:** `src/config/loader.js` → `loadConfig()`

```
loadConfig()
├── if cachedConfig → return cachedConfig
├── raw = ConfigSchema.parse({})  (defaults from src/config/config.js, composed from schemas/)
├── if config.yaml exists:
│   ├── fileContent = readFileSync(config.yaml, "utf-8")
│   ├── parsed = yaml.load(fileContent)
│   └── raw = deepMerge({}, { ...ConfigSchema.parse({}), ...parsed })
│       └── Recursively merges object properties from source → target
├── syncEnv(raw, KNOWN_SECTIONS)
│   └── Materializes config structure from env vars for paths absent from config.yaml
├── resolved = _resolveEnvRecursively(raw, [])
│   └── Walks config tree; for each leaf:
│       ├── DROPPED_KEYS = ["providers", "credentials", "ratelimit", "timeout",
│       │                   "search", "process", "calendar", "subAgentsTemperature"]
│       ├── envKey = pathSegments (minus dropped) → UPPER_SNAKE_CASE → join("_")
│       ├── envValue = process.env[envKey]
│       └── if envValue exists:
│           ├── parse to boolean / number / string
│           ├── else if value matches ${VAR} legacy pattern:
│           │   └── resolve process.env[legacy]
│           └── else: keep original value
├── config = validateConfig(resolved) → ConfigSchema.parse(resolved)
├── config.cwd = process.cwd()
└── cachedConfig = config; _setResolvedConfig(config); return config
```

### Runtime Mutation

```
setConfigValue(config, dotPath, valueStr)
├── applyDotPathMutation(config, dotPath, valueStr)  (src/config/patch.js)
│   ├── clone = JSON.parse(JSON.stringify(config))
│   ├── split dotPath by "/" → assignPath(clone, segments, value)
│   ├── validate against ConfigSchema
│   └── restore from validated clone
├── saveConfig(config)
│   ├── writeFileSync(config.yaml, yaml.dump(config))
│   └── mkdirSync(dirname) if needed
└── return true
```

## Telemetry Initialization

**Entry:** `src/telemetry/provider.js` → `initTelemetry(), getTracer(), shutdownTelemetry()`

```
initTelemetry(teleconfig)
├── if !teleconfig.enabled → return null
├── if exporter.protocol === "http" || "grpc":
│   └── traceExporter = OTLPTraceExporter({ url: endpoint || "http://localhost:4318/v1/traces" })
├── else: ConsoleSpanExporter
├── ratio = teleconfig.sampling.ratio || 0.1
├── NodeSDK config:
│   ├── traceExporter
│   ├── sampling: { strategy: "probability", probability: ratio }
│   └── instrumentations: [getNodeAutoInstrumentations()]
└── await sdk.start()

getTracer()
└── return api.trace.getTracer("madz-harness")

shutdownTelemetry()
└── SDK.shutdown() -- gracefully flushes pending spans
```

## Skill Registry Discovery & Validation

**Entry:** `index.js` → `registry.discover()`

```
registry.discover(scope = defaultScope, options = {})
├── defaultScope = config.sandbox.skillScanPaths  (default: [".skills/", "skills/"])
├── discovered = discoverSkills(scope, options)
│   └── for each directory entry in scope:
│       ├── stat → skip if not directory
│       └── read SKILL.md → extractFrontmatter (YAML: name, description, license,
│           compatibility, metadata, disabled)
│           └── system skills (.skills/) are scanned first and shadow user skills
├── for each skill in discovered:
│   ├── { warnings } = validateSkillSchema(skill.metadata, dirName)
│   │   └── validateSkillName (1-64 chars, lowercase alphanumeric + hyphens),
│   │       validateSkillDescription (1-1024), validateOptionalFields
│   └── #skills.set(name, { path, name, metadata, validated: true, errors, warnings, disabled })
└── return results: [{ name, errors[], warnings[] }] for each discovered skill
```

## Tool Configuration Building

**Entry:** `src/agent/deepAgents.js` → `buildToolConfig(options)` (defined in `src/tools/index.js`)

```
buildToolConfig({ permissions, allowedPaths, maxReadSize, registry, sessionsDir,
                  safety, timeout, memoryLimit, contextDir, ephemeralTtlDays,
                  ephemeralMaxEntries, config })
├── enabledSet = new Set(permissions)
├── runtimeOptions = { allowedPaths, maxReadSize, registry, safety, timeout, memoryLimit,
│   │   searchExaApiKey, searchFirecrawlApiKey, searchTavilyApiKey, searchParallelApiKey,
│   │   searchSearxngUrl, searchBingApiKey, searchCustomConfig, falApiKey, openaiApiKey, ... }
├── for each [toolName, requiredPerms] in TOOL_PERMISSIONS:
│   ├── hasAllPerms = requiredPerms.every(perm => enabledSet.has(perm))
│   ├── switch toolName:
│   │   ├── clarify | sampling | process → always create (no perms gate)
│   │   ├── searchWeb | extractWeb → if hasAllPerms && any search backend configured
│   │   ├── generateImage → if hasAllPerms && falApiKey
│   │   ├── textToSpeech → if openaiApiKey
│   │   ├── api | graphql | json | yaml | data | webhook → if hasAllPerms, via factory call
│   │   └── default: → if requiredPerms.length === 0 || hasAllPerms
│   └── tools.push(TOOLS[toolName]) (or TOOL_FACTORIES[toolName]() for factory tools)
└── return tools[]
```

### Tool Factory Pattern

Tools are exported as ready LangChain `tool()` instances from `src/tools/index.js`, or built by per-domain factories (e.g. `createEmailProvider()`). Each tool file exports:

1. **Core impl function** (e.g., `scanAgentsImpl(input, options)`)
2. **Tool definition** (`tool(impl, { name, description, schema })`)
3. **Factory function** where runtime options are needed (e.g., `createEmailProvider(config)`)

### Orchestrator vs Subagent Tool Sets

```
allTools = buildToolConfig(...)
├── orchestratorTools = allTools.filter(t => ORCHESTRATOR_TOOLS.includes(t.name))
│   └── ORCHESTRATOR_TOOLS: clarify, cronJob, date, memory, process, reflectionSessions,
│       searchSession, searchWeb, extractWeb, scanAgents, sampling, createSkill,
│       searchCode, indexCode, getConfig, readImage
└── per subagent: getToolsForAgentTypes([agentName], TOOLS)
    └── TOOL_CLASSIFICATIONS[toolName] is an array of agent names;
        a tool is included when the agent's name appears in that array
```

Filesystem tools (`ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute`) and the `task` delegation tool are supplied by the `deepagents` library middleware, not by `buildToolConfig()`.

## Deep Agents Orchestration Flow

**Entry:** `src/agent/deepAgents.js` → `createDeepAgentsOrchestrator(checkpointer)`

```
createDeepAgentsOrchestrator(checkpointer)
├── config = loadConfig(); systemPrompt = await loadSystemPrompt()
├── append AGENTS.md (config.cwd + "/AGENTS.md") to systemPrompt
│   └── avoids deepagents MemoryMiddleware injecting its own memory guidelines
├── skillRegistry = new SkillRegistry(); await discover(); skillPaths = getSkillPaths()
├── model = createChatModel(providerConfig)
├── email provider config validation (non-blocking, if config.email.provider.type)
├── registerHarnessProfile(`${providerName}:${model}`, excludedTools: execute, grep, ls)
├── allTools = buildToolConfig(buildOptions)
├── orchestratorTools = allTools filtered to ORCHESTRATOR_TOOLS
├── coreBackend = createCoreBackend()      // LocalShellBackend, cwd, virtualMode: false
├── contextBackend = createContextBackend() // FilesystemBackend, memory/context/
├── contextRoute = "/" + config.memory.contextDir  → "/memory/context/"
├── subagentDefinitions = createSubagentDefinitions(allTools, model, skillRegistry, config)
│   └── for each of the 12 agent definitions (agentDefinitions.js):
│       ├── tools = getToolsForAgentTypes([agentName], TOOLS) → mapped to instances
│       ├── skills = skillRegistry.getSkillPathsForAgent(name) (metadata.agent / skillAgentMap)
│       └── model = per-agent temperature clone when config.subAgentsTemperature[name] set
├── tokenBudgetMiddleware = createTokenBudgetMiddleware({ maxTokensMinute, model, maxTokens,
│   │   encoding })  → null when maxTokensMinute unset; registered LAST (innermost)
└── createDeepAgent({
    ├── model, tools: orchestratorTools, systemPrompt
    ├── store: new InMemoryStore()
    ├── backend: CompositeBackend(coreBackend, { [contextRoute]: contextBackend })
    ├── subagents: subagentDefinitions
    ├── skills: skillPaths (if any)
    ├── checkpointer (if provided)
    ├── middleware: [createCodeInterpreterMiddleware(), ...(tokenBudgetMiddleware ? [...] : [])]
    │   └── deepagents adds its own stack: filesystem, subagents, skills,
    │       summarization, patch-tool-calls
    └── streamTransformers: [() => createTurnTransformer()]
    })

Invocation (index.js callProvider):
├── agent.stream({ messages }, { thread_id, isNewThread, maxTokens, recursionLimit,
│   │   streamMode: ["messages", "tools"], subgraphs: true })
├── for each [namespace, mode, payload]:
│   ├── mode "messages" → text chunks → streamingCallback({ type: "message" })
│   │   ├── reasoning_content / reasoning additional_kwargs → { type: "reasoning" }
│   │   └── content blocks of type "reasoning" → { type: "reasoning" }
│   └── mode "tools" → on_tool_start / on_tool_end → streamingCallback
└── returns { provider, content, reasoning }
```

## Backend Routing Flow

**Entry:** `src/agent/coreBackend.js`, `src/agent/contextBackend.js` → `CompositeBackend`

The `CompositeBackend` routes file operations to different backends based on path prefix matching.

```
CompositeBackend routing:
├── Constructor:
│   ├── defaultBackend: coreBackend (LocalShellBackend, process.cwd(), virtualMode: false,
│   │   │   inheritEnv: true)
│   └── routes: {
│       │   "/memory/context/": contextBackend (FilesystemBackend, memory/context/,
│       │       virtualMode: false)
│       }
├── sortedRoutes = Object.entries(routes).sort(longest prefix first)
├── for an operation on path P:
│   ├── find first route prefix matching P
│   ├── strip matching prefix → delegate to that backend (prefix re-added on results)
│   └── no match → defaultBackend
└── FilesystemBackend security: O_NOFOLLOW on file I/O where supported
```

## Session Creation

**Entry:** `index.js` → `createSession({ provider })`

```
createSession(config = {})
├── sessionId = randomUUID()
└── return {
    sessionId,
    state: {
    │   provider: config.provider || "openai",
    │   conversation: [],
    │   contextWindow: config.contextWindow || 20,
    │   skills: config.skills || [],
    │   sessionId,
    │   },
    createdAt: ISODate,
    updatedAt: ISODate,
    }

sessionState = new SessionStateManager(initialState)
├── addExchange({ role, content, reasoningContent? })
├── getConversation() / getSessionId() / getState()
└── setContextWindow(n)
```

## Chat Flow (CLI Chat Mode)

**Entry:** `index.js` → `handleConversation(message, sessionId)`

```
handleConversation(message, sessionId = "")
├── if sessionId:
│   └── { conversation } = loadSession(cwd + "/memory/sessions/", 20)
│       └── conversation.forEach(msg → sessionState.addExchange(msg))
├── response = await callProvider(null, null, message, chunk → stdout.write(chunk.text))
│   ├── config = { thread_id: sessionId, isNewThread: conversation.length === 0 }
│   ├── agent.stream(input, config)   ← [see Deep Agents Orchestration Flow]
│   ├── collect content + reasoning from message chunks
│   └── return { provider: providerName, content, reasoning, tokens: { input: 0, output: 0 } }
├── sessionState.addExchange({ role: "user", content: message })
├── sessionState.addExchange({ role: "assistant", content, reasoningContent })
├── saveSession("memory/sessions/", conversation, sessionId)
│   └── [see Memory Persistence Flow]
└── return response
```

## Chat Model Creation

**Entry:** `src/provider/openai.js` → `createChatModel(config)`

```
createChatModel(config)
└── new ChatOpenAI({
    ├── model: config.model
    ├── temperature: config.temperature
    ├── maxTokens: config.maxTokens
    ├── apiKey: config.credentials.apiKey
    ├── streaming: config.streaming !== false
    ├── configuration: { baseURL: config.base_url }
    ├── maxRetries / maxConcurrency (from config.rateLimit, when set)
    └── reasoning: { effort } (when config.reasoning set)
    })
```

`createChatModel()` deliberately does not patch `invoke`/`stream` on the instance — `ChatOpenAI.bindTools()` constructs a new object and would orphan such patches. `rateLimit.maxTokensMinute` enforcement lives in `createTokenBudgetMiddleware()` (`src/provider/tokenBudgetMiddleware.js`), registered on `createDeepAgent`.

## Tool Permission Enforcement

```
TOOL_PERMISSIONS (src/tools/index.js) — tool registers only when ALL required perms enabled:
├── clarify → ["filesystem:read", "filesystem:write"] (but always registered — switch exempt)
├── sampling → ["filesystem:write"] (always registered — switch exempt)
├── process → ["filesystem:exec", "process:spawn"] (always registered — switch exempt)
├── cronJob → "network:outbound"
├── createSkill → "filesystem:write"
├── date → [] (always)
├── generateImage → "network:outbound" + falApiKey
├── readImage | scanAgents | reflectionSessions | searchCode | json | yaml | getConfig
│   → "filesystem:read"
├── memory | spreadsheet | generatePdf | webhook → "filesystem:read" + "filesystem:write"
│   (generatePdf also "network:outbound")
├── searchSession → "filesystem:read"
├── searchWeb | extractWeb → "network:outbound" + search backend configured
├── textToSpeech → [] + openaiApiKey
├── docx | pptx | xlsx | pdf → "filesystem:read"
├── email | calendar | api | graphql | namecom → "network:outbound"
├── indexCode → "filesystem:read" + "filesystem:write"
└── generatePptx → "filesystem:write"
```

### Search Backend Detection

```
searchWeb/extractWeb register when any of runtimeOptions is set:
└── searchExaApiKey || searchFirecrawlApiKey || searchTavilyApiKey ||
    searchParallelApiKey || searchSearxngUrl || searchBingApiKey ||
    (searchCustomConfig.url && searchCustomConfig.apiKey !== undefined)
```

## Web Tool Execution Flow

**Entry:** `src/tools/web/index.js`

```
searchWeb / extractWeb:
├── extractWeb: filterUrl(url, []) → blocks file://, gopher://, dict:// schemes
├── fetch with AbortController timeout → response text → HTML-to-text
└── searchWeb engine selection (priority order):
    ├── CUSTOM_SEARCH_URL (+apiKey) → custom endpoint
    ├── BING_API_KEY → bing search
    ├── SEARXNG_URL → searxng instance
    ├── Google (HTML scrape, no key)
    └── DuckDuckGo (default, no key)
```

## Process Tool Execution Flow

**Entry:** `src/tools/process/index.js`

```
process tool (actions on a tracked-process Map):
├── start → spawn(command), background mode; trackProcess → { pid, child, status, startTime }
├── list → entries with status + uptime
├── log → collected stdout/stderr for pid
├── wait → await child exit for pid
├── kill → SIGTERM → 5s grace → SIGKILL
├── write → child.stdin.write(data)
├── pause → SIGSTOP
└── resume → SIGCONT
```

## Text-to-Speech

**Entry:** `src/tools/tts/index.js`

```
textToSpeech tool:
├── validate OPENAI_API_KEY exists
├── validate voice ∈ {alloy, echo, fable, onyx, nova, shimmer}
├── POST https://api.openai.com/v1/audio/speech (15s AbortController timeout)
│   ├── model: "tts-1" | "tts-1-hd"
│   ├── input: text
│   ├── voice
│   └── speed: clamped 0.25–4.0
├── write MP3 bytes to ~/voice-memos/{timestamp}_{voice}.mp3
└── return { path, status: "complete" }
```

## Image Generation

**Entry:** `src/tools/image/index.js`

```
generateImage tool:
├── validate FAL_API_KEY exists
├── POST https://queue.fal.run/fal-ai/flux/klein (prompt + options)
├── poll queue for completion
├── download image URLs
└── return { images: [{ url }], status }
```

## Clarify

**Entry:** `src/tools/clarify/index.js`

```
clarify tool (always registered):
├── build entry: question + timestamp + numbered choices (if provided)
├── append to memory/context/clarifications.md (read + concat + write)
└── return { status: "ok", message: "Clarification noted." }
```

## Cron Job Execution Flow

**Entry:** `src/tools/cron/index.js` → `cronJobImpl(input, options)`

```
cronJob tool (actions: create, list, update, pause, resume, run, remove):
├── create → validate name + cron + (skill | command)
│   ├── isValidCron() → 5-6 fields
│   ├── derivedCommand = command || `cd <cwd> && node index.js --message "Run the <skill> skill..."`
│   ├── saveJob() → memory/schedules/<name>.json
│   └── Cron.add({ name, cron, command }) → system crontab
├── run → runJob(job, schedulesDir)
│   ├── if !job.enabled → "Job is paused"
│   ├── scriptPath = findSkillScript(job.skill)
│   │   └── search .skills/ then skills/ for scripts/run.{sh,py,js,bash} or run.{sh,py,js,bash}
│   ├── if !scriptPath → error "no discoverable script"
│   └── runScript(scriptPath, [], { timeout: 30000 })
│       └── spawn + collect stdout/stderr + SIGTERM on timeout
│       └── update job.lastRun / updatedAt, saveJob()
├── pause / resume → toggle job.enabled, saveJob()
├── update → patch cron/skill/command/input, saveJob(), Cron.add replacement
└── remove → unlink job file + Cron.remove(name)
```

## Sandbox Skill Execution

**Entry:** `src/sandbox/runner.js` → `runSandbox(options)`

The sandbox module (`runner.js`, `pathResolver.js`, `urlFilter.js`, `envInjector.js`, `capability.js`, `timeoutHandler.js`) is fully implemented and unit-tested, but currently has **no production call path**: `index.js` `invokeSkill()` is a placeholder that resolves permissions and returns a stub result, and `ScheduleManager.runNow()` only invokes a sandbox injected by the caller (nothing injects one). Scheduled skills execute via the system crontab instead — see [Cron System](#cron-system).

```
runSandbox(options):
├── enforceCapabilities(permissions) → {resources, rules}[]
├── resolvePath() / assertPathAllowed() → sandbox scope enforcement
├── filterEnv(process.env, whitelist)
├── spawn(interp.command, [...args, script], { cwd, env, execArgv: ["--max-old-space-size=..."] })
├── collect stdout/stderr
└── handleTimeout(child, { seconds, gracePeriod })
    └── timeout → SIGTERM → gracePeriod → SIGKILL → "terminated" | "killed"
```

## Memory Persistence Flow

**Entry:** `src/memory/writer.js` → `writeMemoryFile(subdirectory, title, frontmatter, body)`

```
writeMemoryFile(subdirectory, title, frontmatter, body = "")
├── directory = join(config.cwd, subdirectory)
├── await mkdir(directory, recursive)
├── timestamp = new Date().toISOString().replace(/[:.]/g, "-")
├── slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
│   └── filename = `${timestamp}-${slug || "entry"}.md`
├── filepath = join(directory, filename)
└── await writeFile(filepath, [
       "---",
       `title: "${escapeYamlString(title)}"`,
       `timestamp: "${escapeYamlString(timestamp)}"`,
       ...Object.entries(frontmatter) → typed lines (null → `key:`, string → quoted,
           boolean/number → raw, other → JSON.stringify),
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
│   ├── match[1] → yaml.load() → frontmatter (parse failure → {})
│   └── match[2] → body content
└── return { frontmatter, content: body.trim() }

readMemoryFile(filepath)
├── if !exists → null
├── content = await readFile(filepath, "utf-8")
└── return { frontmatter, content, path }
```

## Context Loading

**Entry:** `src/memory/context.js` → `loadContext(contextDir = "memory/context/", limit = 10)`

```
loadContext(contextDir, limit)
├── files = readdir(fullPath).filter(.md)
├── persistent files: read + parseFrontmatter → { frontmatter, body, timestamp }
├── ephemeral files: same, with ephemeral metadata handling
├── profile: loadAndFormatProfile() → profile context block
├── sort by timestamp (descending)
├── recent = sorted.slice(0, limit)
└── recent.map(entry → `\n[Context: ${title}]\n${body.trim()}`).join("\n")
```

## Schedule Manager Lifecycle

**Entry:** `src/scheduler/scheduler.js` → `ScheduleManager`

The ScheduleManager is a CRUD class. Scheduling is delegated to the system crontab — there is no in-process clock tick loop.

```
ScheduleManager.loadFromDisk(schedulesDir, deps = {})
├── readdir(schedulesDir) → *.json files
├── skip jobs with enabled === false
├── skip jobs missing name/cron or both skill and command
└── new ScheduleManager() + register(entries)

scheduleManager.register(entries = [])
├── results = []
└── for each entry in entries:
    ├── if !entry.name || !entry.cron || (!entry.skill && !entry.command):
    │   └── results.push({ name, error: "Missing required fields" })
    └── #scheduleEntry.set(entry.name,
            { ...entry, paused: false, lastRun: null, input: {}, contextFile: "" })
└── return results

scheduleManager.list() → [{ ...entry }]
scheduleManager.pause(name) → entry.paused = true
scheduleManager.resume(name) → entry.paused = false

scheduleManager.runNow(name, scheduler)
├── entry = #scheduleEntry.get(name)
├── if !entry → { error: "Unknown schedule" }
├── if entry.paused → { error: "Schedule is paused" }
├── command-only entry → spawn("/bin/sh", ["-c", command]) with timeout
│   └── collect stdout/stderr → { stdout, stderr, exitCode }
└── skill entry → contextPrefix from entry.contextFile or loadContext(contextDir)
    └── scheduler.sandbox({ skillName, input, context, permissions })
        └── injected by caller; no production wiring exists (see Sandbox Skill Execution)
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

Cron.sync(schedulesDir)
├── isAvailable() → bail with error if crontab missing
├── _ensureReflectionJob(schedulesDir) → seed reflection-daily.json if absent
├── _readJobsFromDisk() → desired jobs (enabled only)
├── _splitBlock(_readCrontab()) → current entries
├── diff desired vs current → added / removed / updated / skipped
└── replace the madz-schedules block atomically via `crontab -`

prepareCrontabCommand(command)
└── `. <cwd>/.env.cron 2>/dev/null || true && <sanitized command>`
    └── cron-fired processes source .env.cron (written at boot by writeEnvCron())
```

### Reflection Job

```
reflection-daily (seeded by Cron._ensureReflectionJob at startup sync)
├── cron: "0 2 * * *"
├── command: `cd <cwd> && node index.js --message "Run the reflection skill"`
├── persisted: memory/schedules/reflection-daily.json
└── installed into system crontab by Cron.sync()
```

## Memory Retention Cleanup

**Entry:** `src/memory/retention.js` → `cleanRetainedMemory(), enforceMaxEntries()`

Both functions are exported and tested but are **not wired into the shutdown path** — `index.js` `runShutdown()` stops the GC manager and flushes telemetry only.

```
cleanRetainedMemory(directory, retentionDays = 90)
├── cutoff = Date.now() - retentionDays * 86400000
├── for each .md file:
│   └── if stat.mtimeMs < cutoff → unlink(filepath), removed++
└── return removed

enforceMaxEntries(directory, maxEntries = 1000)
├── files = readdir(fullPath).filter(.md) → { name, mtime }
├── sort by mtime ascending
├── if files.length > maxEntries:
│   └── for i in 0..excess → unlink(files[i])
└── return removed
```

## Profile Management

**Entry:** `src/memory/profile.js` → `loadProfile(), saveProfile(), hasProfile(), formatProfileContext(), processOnboardingInput(), getAttribute(), sanitizeProfileData()`

```
loadProfile(profilePath)          (async)
├── read profile.md → parseFrontmatter → body "key: value" lines → data
├── if no known attribute keys present → null
└── return { data, fullContext: formatProfileContext(data) }

saveProfile(profileData, profilePath)   (async)
├── sanitizeProfileData(data) → only known attribute keys
└── writeFileSync(profilePath, frontmatter + body)

hasProfile(profilePath)          (async) → boolean
formatProfileContext(profileData) → "key: value" lines for each ATTRIBUTES entry
processOnboardingInput(input) → validate against control patterns (skip/cancel/exit) + attributes
getAttribute(index) → ATTRIBUTES[index]

ATTRIBUTES (12 known profile fields):
├── name, dob, relationship, pets, hobbies, expertise,
├── favorite bands, favorite books, favorite tv, favorite movies,
└── location, notes (free-form)
```

## Shutdown Flow

**Entry:** `src/session/shutdown.js` → `handleShutdown()` + `registerShutdownHandler()`

```
registerShutdownHandler(cleanupFn)
├── process.on("SIGTERM", () => cleanup())
├── process.on("SIGINT", () => cleanup())
└── return () => process.off(...)

# index.js runShutdown (registered above, also called in CLI mode):
runShutdown()
├── gcManager.stop() (if initialized)
└── shutdownFn() → shutdownTelemetry()

# CLI chat mode exit:
runShutdown() → flushLogger() → process.exit(0)

# TUI exit (ink onExit):
handleShutdown({ onShutdown: () => { gcManager.stop(); shutdownFn() } })
└── flushLogger() → stdout.write("\n") → process.exit(0)
```

## File Dependencies

```
index.js
├── config/loader.js → config.js (ConfigSchema, DEFAULT_CONFIG), patch.js, schemas/*
│     └── js-yaml, zod
├── config/patch.js → zod
├── provider/openai.js → @langchain/openai
├── provider/tokenBudgetMiddleware.js → provider/tokenBudget.js, tiktoken encoding
├── agent/deepAgents.js → deepagents, @langchain/quickjs, @langchain/langgraph-checkpoint,
│     config/loader.js, memory/prompts.js, skills/registry.js, provider/openai.js,
│     provider/tokenBudgetMiddleware.js, tools/index.js, tools/email/index.js,
│     agent/coreBackend.js, agent/contextBackend.js, agent/agentDefinitions.js,
│     shared/logger.js, stream/transformers/index.js
├── agent/coreBackend.js → deepagents (LocalShellBackend)
├── agent/contextBackend.js → deepagents (FilesystemBackend), config/loader.js
├── tools/index.js → (all tool modules below)
│     ├── tools/clarify/ → node:fs/promises — clarification questions → clarifications.md
│     ├── tools/cron/ → scheduler/cron.js, node:child_process — cron job CRUD + run
│     ├── tools/skills/ → skills/registry.js — list/view/createSkill
│     ├── tools/memory/ → memory/tools.js — key-value entry storage in memory/context/entries/
│     ├── tools/session/ → memory/reader.js — searchSession
│     ├── tools/code/ → vector/store.js, vector/embedder.js, vector/indexer.js —
│     │     searchCode (hybrid vector+keyword), indexCode (worker-thread reindex)
│     ├── tools/date/ → date tool
│     ├── tools/process/ → node:child_process — background process management
│     ├── tools/sampling/ → ephemeral memory capture
│     ├── tools/scanAgents/ → workspace/loadAgents.js — AGENTS.md discovery
│     ├── tools/reflection/ → reflectionSessions
│     ├── tools/web/ → sandbox/urlFilter.js, fetch — searchWeb/extractWeb
│     ├── tools/image/ → FAL_API_KEY — generateImage via queue.fal.run
│     ├── tools/tts/ → OPENAI_API_KEY — textToSpeech via OpenAI audio endpoint
│     ├── tools/fileExtract/ → docx/pptx/xlsx/pdf extraction (docx, pptx, xlsx, pdf tools)
│     ├── tools/pdf/ → generatePdf
│     ├── tools/pptx/ → generatePptx
│     ├── tools/email/ → email provider factory (validateProviderConfig, createEmailProvider)
│     ├── tools/calendar/ → calendar provider
│     ├── tools/spreadsheet/ → spreadsheet computation
│     ├── tools/api/ → api tool (factory)
│     ├── tools/graphql/ → graphql tool (factory)
│     ├── tools/json/ → json tool (factory)
│     ├── tools/yaml/ → yaml tool (factory)
│     ├── tools/data/ → data tool (factory)
│     ├── tools/webhook/ → webhook tool (factory)
│     ├── tools/dns/ → namecom tool (name.com API; NAMECOM_USERNAME/NAMECOM_TOKEN)
│     ├── tools/config/ → getConfig
│     └── tools/image readImage → filesystem:read
├── sandbox/runner.js → node:child_process, sandbox/timeoutHandler.js, envInjector.js,
│     capability.js  (unit-tested; no production call path — see Sandbox Skill Execution)
├── sandbox/pathResolver.js → node:path
├── sandbox/urlFilter.js → node:url
├── skills/registry.js → discoverer.js, validator.js, agentMapper.js
├── skills/discoverer.js → js-yaml, node:fs/promises, node:path
├── skills/validator.js → types.js (zod schemas)
├── skills/types.js → zod
├── scheduler/scheduler.js → node:fs/promises — ScheduleManager CRUD class
├── scheduler/cron.js → node:child_process, node:fs/promises, node:path — Cron + writeEnvCron
├── scheduler/index.js → re-exports ScheduleManager, Cron, writeEnvCron
├── memory/writer.js → node:fs/promises, node:path, config/loader.js
├── memory/reader.js → js-yaml, node:fs/promises
├── memory/context.js → node:fs/promises, memory/reader.js, memory/profile.js
├── memory/retention.js → node:fs/promises
├── memory/expireEphemeralMemories.js → node:fs/promises, js-yaml
├── memory/gc.js → node:v8 — initGC/gc/isAvailable
├── memory/prompts.js → node:fs — loadSystemPrompt()
├── memory/profile.js → node:fs — ATTRIBUTES, loadProfile, saveProfile, hasProfile,
│     formatProfileContext, processOnboardingInput, sanitizeProfileData
├── session/factory.js → node:crypto (randomUUID)
├── session/stateManager.js
├── session/window.js → enforceContextWindow, trimConversation (exported; unused in prod paths)
├── session/checkpointer.js → @langchain/langgraph (MemorySaver),
│     @langchain/langgraph-checkpoint-sqlite (SqliteSaver)
├── session/loader.js → node:fs/promises, memory/reader.js
├── session/saver.js → node:fs/promises, memory/writer.js
├── session/onboarding.js → memory/profile.js — INIT → ATTRACTOR → COLLECT → SAVE → TRANSCEND
├── stream/transformers/index.js → createTurnTransformer()
├── vector/store.js → sqlite-vec — createVectorStore
├── vector/embedder.js → createEmbedder
├── vector/indexer.js → vector/chunker.js, indexerWorker.js — reindex()
└── telemetry/provider.js → @opentelemetry/sdk-node
```
