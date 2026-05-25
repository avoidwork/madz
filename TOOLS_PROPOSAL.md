# Tools Proposal — Toolset Parity with Hermes

## 1. Overview

Add application-level utility functions (**tools**) to the LangChain ReAct agent. Tools are LangChain-native `@tool` decorated functions defined in `src/tools/`. They are registered as an array and passed to `createReactAgent(model, tools)`. The agent's ReAct loop lets the LLM reason about and invoke tools during response generation.

**Tools are distinct from skills:**
- **Tools** are built-in, application-level compute functions registered with the agent. The LLM calls them directly via tool-calling (LangChain `tool_call` → `tool_response` cycle).
- **Skills** are externally-defined containers (metadata + scripts in `skills/`) discovered by registry and executed via sandbox. A skill may internally call tools.

---

## 2. Architecture

### 2.1 Tool Registration

```
src/tools/
├── index.js          → exports tools[] array, passed to createReactAgent
├── common.js         → shared utilities (path resolution, URL filtering, timeout fetch)
├── filesystem.js     → read_file, write_file, patch, search_files
├── terminal.js       → terminal, process
├── todo.js           → todo
├── memory.js         → memory, session_search
├── web.js            → web_search, web_extract
├── browser.js        → browser_*, browser_cdp, browser_dialog
├── vision.js         → vision_analyze
├── image.js          → image_generate
├── video.js          → video_analyze, video_generate
├── tts.js            → text_to_speech
├── code.js           → execute_code
├── clarify.js        → clarify
├── moa.js            → mixture_of_agents
├── cron.js           → cronjob
├── delegation.js     → delegate_task
├── discord.js        → discord, discord_admin
├── computer.js       → computer_use
├── kanban.js         → kanban_* (8 tools)
└── homeassistant.js  → ha_* (4 tools)
```

### 2.2 Tool Interface

Each tool is a LangChain `@tool` decorated async function:

```javascript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const read_file_tool = tool(async (input) => {
  // implementation
}, {
  name: "read_file",
  description: "Read a text file with line numbers and pagination...",
  schema: z.object({
    path: z.string().describe("Absolute or relative file path"),
    offset: z.number().optional().describe("Line offset for large files"),
    limit: z.number().optional().describe("Max lines to return"),
  }),
});
```

### 2.3 Tool Execution Flow

```
User message → ReAct agent → Tool call (tool_call)
                                    ↓
                              Tool dispatcher
                                    ↓
                  ┌─────────────────┼─────────────────┐
                  ↓                 ↓                 ↓
            Local filesystem   External API      Sandbox skill
            (safe paths)       (key-gated)       (forked child)
                  ↓                 ↓                 ↓
                  └─────────────────┼─────────────────┘
                                    ↓
                            Tool response
                                    ↓
                          ReAct continues → final text
```

### 2.4 Tool Categories and Permission Gating

| Permission Scope | Tools gated by this permission |
|---|---|
| `filesystem:read` | read_file, search_files |
| `filesystem:write` | write_file, patch |
| `filesystem:exec` | terminal, process, execute_code |
| `network:outbound` | web_search, web_extract, video_generate |
| `process:spawn` | terminal, process, execute_code, computer_use |
| `env:read` | (all tools, via DEFAULT_PERMS) |

Tools requiring a given permission are only registered when that permission is enabled in config. This is checked against `config.sandbox.env.allowlist` extended with a `permissions` subkey.

### 2.5 Required Sandbox Config Extension

Add to `config.yaml`:

```yaml
sandbox:
  paths:
    - memory/
    - skills/
    - tmp/
  timeout:
    seconds: 30
    gracePeriod: 5
  memoryLimit: 512m
  env:
    allowlist:
      - PATH
      - HOME
      - NODE_ENV
  permissions:
    - filesystem:read
    - filesystem:write
    - filesystem:exec
    - process:spawn
    - network:outbound
```

---

## 3. Tier 1 — Foundational Tools (No External APIs)

Tools requiring zero external API keys. Must be implemented and registered at startup.

### 3.1 Filesystem Tools (4)

#### `read_file`

- **Category:** filesystem
- **Permission:** `filesystem:read`
- **Description:** Read a text file with line numbers and pagination. Uses `LINE_NUM|CONTENT` format. Suggests similar filenames if not found. Handles large files via offset/limit pagination.
- **Inputs:** `{ path: string, offset?: number, limit?: number }`
- **Output:** `{ content: string, fileSize: number, filename: string }`
- **Implementation details:**
  - Resolve path via `src/sandbox/pathResolver.js` — must be in allowed sandbox paths
  - Read via `fs.promises.readFile`
  - Line-number format: `1: first line\n2: second line`
  - If offset/limit specified, slice the array of lines
  - If file not found, search similar filenames in same directory
  - Max file size: configurable via `sandbox.maxReadSize` (default 1MB)
  - **Cannot read images or binary** (document in description)
- **Error handling:** `ENOENT` → suggest similar files; `EPERM` → permission denied message

#### `write_file`

- **Category:** filesystem
- **Permission:** `filesystem:write`
- **Description:** Write content to a file, completely replacing existing content. Creates parent directories automatically. Overwrites entirely — use `patch` for targeted edits.
- **Inputs:** `{ path: string, content: string }`
- **Output:** `{ success: true, writtenBytes: number, path: string }`
- **Implementation details:**
  - Resolve path via `src/sandbox/pathResolver.js`
  - Create parent dirs via `fs.promises.mkdir(dir, { recursive: true })`
  - Write via `fs.promises.writeFile`
  - Return written byte count for user confirmation
  - Max content size limit: 500KB (enforceable via config)

#### `patch`

- **Category:** filesystem
- **Permission:** `filesystem:write`
- **Description:** Targeted find-and-replace edits in files. Uses fuzzy matching (9 strategies) so minor whitespace/indentation differences won't break it. Returns a unified diff. Auto-runs syntax checks after editing if file type is known.
- **Inputs:** `{ path: string, oldStr: string, newStr: string }`
- **Output:** `{ success: true, diff: string, numChanges: number }`
- **Implementation details:**
  - Read existing file content
  - Apply up to 9 fuzzy match strategies (exact, trim, collapse-whitespace, case-insensitive, etc.)
  - If found, replace oldStr → newStr
  - Generate unified diff via simple line comparison
  - Count number of replacements made
  - If file type matches known syntax checkers (`.js`, `.json`, `.ts`), optionally run syntax validation
  - If none of 9 strategies match, return error with suggestions

#### `search_files`

- **Category:** filesystem
- **Permission:** `filesystem:read`
- **Description:** Search file contents or find files by name. Ripgrep-backed by default, falls back to native `fs` + `find` on ripgrep absence. Content search supports regex. Output modes: full matches with line numbers, filenames only, or line-matched content.
- **Inputs:** `{ target: "content" | "name", pattern: string, directory?: string, maxResults?: number, outputMode?: "files" | "content" }`
- **Output:** `{ matches: string[], matchCount: number }`
- **Implementation details:**
  - Try `rg` (ripgrep) binary first via child_process
  - If ripgrep unavailable, fallback to native `globby`/`find` + `fs.readFileSync` line-by-line regex
  - Support regex patterns
  - Default: search `process.cwd()` recursively
  - Respect sandbox path allowlist
  - Limit results to `maxResults` (default 50)

---

### 3.2 Terminal Tools (2)

#### `terminal`

- **Category:** terminal
- **Permission:** `filesystem:exec`, `process:spawn`
- **Description:** Execute shell commands on a Linux environment. Filesystem persists between calls. Set `background=true` for long-running servers. Set `notifyOnComplete=true` (with background=true) to get an automatic notification when the process finishes. Do NOT use `cat`/`head`/`tail` — use `read_file` instead. Do NOT use `grep`/`rg`/`find` — use `search_files` instead.
- **Inputs:** `{ command: string, background?: boolean, notifyOnComplete?: boolean }`
- **Output:** `{ stdout: string, stderr: string, exitCode: number, processId?: number, running: boolean }`
- **Implementation details:**
  - Use `child_process.spawn` (not `exec` for safety with argument handling)
  - Shell mode via `sh -c` with `maxBuffer` limit (default 1MB)
  - Background mode: spawn with detached, return immediately with PID
  - Output captured from stdout/stderr streams
  - Timeout enforced via `handleTimeout` from `src/sandbox/timeoutHandler.js`
  - **Shell allowlist:** only allow `sh`, `bash`, `zsh` — reject raw command execution bypass
  - Max command length: 4096 characters
- **Security notes:**
  - No pipe to `sudo` or privilege escalation commands
  - Reject commands containing `/etc/shadow`, `/etc/passwd` reads (or allow only in read-only context)

#### `process`

- **Category:** terminal
- **Permission:** `process:spawn`
- **Description:** Manage background processes started with `terminal(background=true)`. Actions: `list` (show all), `poll` (check status + new output), `log` (full output with pagination), `wait` (block until done or timeout), `kill` (terminate), `write` (send data to process stdin), `pause` (SIGSTOP), `resume` (SIGCONT).
- **Inputs:** `{ action: "list" | "poll" | "log" | "wait" | "kill" | "write" | "pause" | "resume", processId?: number, data?: string, timeout?: number, page?: number }`
- **Output varies by action:** `{ type: string, data: string[], exitCode?: number, status?: string }`
- **Implementation details:**
  - Maintain a `Map<number, ProcessEntry>` tracking spawned processes
  - `ProcessEntry = { pid, child, stdoutBuffer, stderrBuffer, stdin, status, lastOutput }`
  - `list`: returns array of `{ pid, command, status, uptime }`
  - `poll`: returns new stdout/stderr output since last poll
  - `log`: returns paginated full output
  - `wait`: blocks until `child.on('exit')` or timeout
  - `kill`: `child.kill(SIGTERM)` then `SIGKILL` after grace period
  - `write`: `child.stdin.write(data)`
  - `pause`/`resume`: `SIGSTOP`/`SIGCONT` signals

---

### 3.3 Task Management

#### `todo`

- **Category:** todo
- **Permission:** `filesystem:read`, `filesystem:write` (for persistence)
- **Description:** Manage a task list for the current session. Use for complex tasks with 3+ steps or when the user provides multiple tasks. Call with no parameters to read the current list. Use `merge=true` to combine with existing list. Use `action` to control behavior.
- **Inputs:** `{ action: "read" | "create" | "update" | "complete" | "clear", todos?: TodoItem[], merge?: boolean }`
- **`TodoItem` schema:** `{ id: string, content: string, status: "pending" | "in_progress" | "completed" | "cancelled", priority: "high" | "medium" | "low" }`
- **Output:** `{ todos: TodoItem[], nextId?: number }`
- **Implementation details:**
  - List state persisted to `memory/tools/todo.json`
  - Auto-generate incrementing integer IDs
  - `read` returns full current list
  - `create` adds items; generates IDs if not provided
  - `update` replaces existing item by ID
  - `complete` updates `status: "completed"` and records timestamp
  - `clear` writes empty list
  - `merge=true` appends to existing list (avoids clobbering)
  - On tool call return, include current list in response (agent can display it)

---

### 3.4 Memory & Sessions

#### `memory`

- **Category:** memory
- **Permission:** `filesystem:write`, `filesystem:read`
- **Description:** Save important information to persistent memory that survives across sessions. Memory content is read at session start and included in the system prompt. Use when you need to remember information about the user, their workspace, preferences, or procedural knowledge for recurring tasks.
- **Inputs:** `{ entries: Entry[] }`
- **`Entry` schema:** `{ key: string, value: string }` — key is a short identifier, value is the saved text
- **Output:** `{ saved: number, keys: string[] }`
- **Implementation details:**
  - Write entries to `memory/context/session_memory.md` as markdown frontmatter blocks
  - Each entry written once per session — deduplicate by key
  - On session start, `loadContext()` merges contextDir files + session_memory.md into system prompt
  - Max entries: configurable via `memory.maxEntries` (default 100)
  - Overwrite existing entries with same key; new keys appended
  - Format: YAML frontmatter with key-value pairs

#### `session_search`

- **Category:** sessions
- **Permission:** `filesystem:read`
- **Description:** Search past sessions stored in the memory system, or retrieve a conversation. FTS5-backed retrieval if available; falls back to text match. Three shapes: discovery (pass `query`), scroll (pass `conversationId` + `aroundMessageId`), browse (no args returns available conversations).
- **Inputs:** `{ query?: string, conversationId?: string, aroundMessageId?: string, limit?: number }`
- **Output:** `{ results: SearchResult[], total: number }`
- **`SearchResult` schema:** `{ conversationId: string, date: string, snippet: string }`
- **Implementation details:**
  - Scan `memory/conversations/` for `.json` conversation files
  - Index content by date, sender role, content text
  - If `query` provided: search conversation messages for match, return matching snippets (±2 message context)
  - If `conversationId` provided: return the full conversation text
  - If neither: list available conversations with date and first message preview
  - Limit: 20 results by default

---

### 3.5 Interaction

#### `clarify`

- **Category:** clarify
- **Permission:** none (no sandbox permission needed)
- **Description:** Ask the user a question when you need clarification, feedback, or a decision before proceeding. Supports two modes: 1) Multiple choice — provide up to 4 choices. The user picks one or types their own answer via an 'Other' option. 2) Open-ended — for questions where no good discrete set of choices exists. The user answers in free text.
- **Inputs:** `{ question: string, choices?: string[], openEnded?: boolean }`
- **Output:** `{ answered: true, answer: string, source: "choice" | "open_ended" }`
- **Implementation details:**
  - **Open-ended only** (no choice mechanism since this is CLI/terminal)
  - Returns a prompt-like message that the TUI displays to the user
  - The agent will receive the answer on the next interaction
  - Store the question in `memory/context/clarifications.md` for session context
  - If `choices` provided, format them as numbered list for display

---

### 3.6 Skills Management

#### `skills_list`

- **Category:** skills
- **Permission:** `filesystem:read`
- **Description:** List all available discovered skills with name, version, and description.
- **Inputs:** `{}`
- **Output:** `{ skills: SkillSummary[], count: number }`
- **`SkillSummary` schema:** `{ name: string, version: string, description: string, permissions: string[] }`
- **Implementation details:**
  - Reuse `SkillRegistry.list()` — iterate the in-memory registry
  - For each skill, return name, version, description, permission array
  - If registry empty, inform user and suggest running discovery

#### `skill_view`

- **Category:** skills
- **Permission:** `filesystem:read`
- **Description:** View the full details and metadata of a specific discovered skill. Returns the complete SKILL.md content and any linked files.
- **Inputs:** `{ name: string }`
- **Output:** `{ name: string, version: string, description: string, inputSchema: object, outputSchema: object, permissions: string[], scripts: string[], content: string }`
- **Implementation details:**
  - Look up in `SkillRegistry.get(name)`
  - Read the `SKILL.md` file from the skill's directory
  - List any files under the skill's `scripts/` directory

---

## 4. Tier 2 — Network / API-Required Tools

Tools that need external API keys or services, gated by config.

### 4.1 Web Tools (2)

#### `web_search`

- **Category:** web
- **Permission:** `network:outbound`
- **Requires env var:** `EXA_API_KEY` OR `PARALLEL_API_KEY` OR `FIRECRAWL_API_KEY` OR `TAVILY_API_KEY`
- **Description:** Search the web for information. Returns up to 5 results by default with titles, URLs, and descriptions. Accepts optional `limit` (1–100, default 5). Supports operators like `site:domain`, `filetype:pdf`, `intitle:term`, `-term`, `"exact phrase"`.
- **Inputs:** `{ query: string, limit?: number (1-100) }`
- **Output:** `{ results: SearchResult[], total: number }`
- **`SearchResult` schema:** `{ title: string, url: string, description: string, engine: string }`
- **Implementation details:**
  - Detect which API key is configured → select backend
  - Exa API: `https://api.exa.ai/search` (POST)
  - Firecrawl: `https://api.firecrawl.dev/v1/search` (POST)
  - Tavily: `https://api.tavily.com/search` (POST)
  - All return JSON with title/description/URL structure
  - If no API key found, return error message with instructions
  - Timeout: 10 seconds
  - Max retries: 2

#### `web_extract`

- **Category:** web
- **Permission:** `network:outbound`
- **Requires env var:** `EXA_API_KEY` OR `PARALLEL_API_KEY` OR `FIRECRAWL_API_KEY` OR `TAVILY_API_KEY`
- **Description:** Extract content from web page URLs. Returns page content in markdown format. Also works with PDF URLs — pass the PDF link directly and it converts to markdown text. Pages under 5000 chars return full markdown; larger pages are LLM-summarized.
- **Inputs:** `{ url: string, useReadAPI?: boolean }`
- **Output:** `{ content: string, title: string, url: string, isPDF: boolean }`
- **Implementation details:**
  - Detect configured API key → select backend
  - Exa Read API: `https://api.exa.ai/read` provides direct content extraction
  - Firecrawl Scrape: `https://api.firecrawl.dev/v1/scrape` supports markdown output
  - Validate URL via `src/sandbox/urlFilter.js` — block `file://`, `gopher://`, `dict://`
  - PDF: if URL ends in `.pdf`, use Exa Read API or Firecrawl Scrape with PDF mode
  - Page content limit: 10000 chars (larger pages returned as summary)
  - Timeout: 15 seconds

---

### 4.2 Vision & Image (2)

#### `vision_analyze`

- **Category:** vision
- **Permission:** none (multimodal via LLM)
- **Description:** Analyze images using AI vision. Accept a URL or a base64-encoded data URI. If the model is multimodal-capable (e.g., GPT-4o), the image pixels are sent directly and the model sees them natively.
- **Inputs:** `{ url: string, dataUri?: string }` — one required
- **Output:** `{ description: string }`
- **Implementation details:**
  - This tool calls the LLM with image context rather than an external API
  - Fetch image at URL via HTTP GET (respect sandbox URL filter)
  - If image is too large (>4MB), compress or return error
  - If `dataUri` provided, decode base64 → buffer
  - Return the analyzed description from the model's response
  - Alternative: use a dedicated vision API if configured (`VISION_MODEL_URL` + `VISION_API_KEY`)
  - **Important:** The tool description tells the agent to use this for CAPTCHAs, visual layouts, diagrams, screenshots

#### `image_generate`

- **Category:** image_gen
- **Permission:** `network:outbound`
- **Requires env var:** `FAL_KEY`
- **Description:** Generate high-quality images from text prompts using FAL.ai. Default model: FLUX 2 Klein 9B, sub-1s generation. Returns a single image URL.
- **Inputs:** `{ prompt: string, width?: number, height?: number }`
- **Output:** `{ imageUrl: string, width: number, height: number, model: string }`
- **Implementation details:**
  - Call FAL.ai inference API: `https://queue.fal.run/fal-ai/flux/klein`
  - POST `{ prompt, sync_mode: true, width, height }`
  - `sync_mode: true` for blocking wait (default 30s timeout)
  - Response contains `images[0].url` — HTTP URL to generated image
  - Validate input prompt length (max 1000 chars)
  - Image size: default 1024x1024

---

### 4.3 Text-to-Speech (1)

#### `text_to_speech`

- **Category:** tts
- **Permission:** `filesystem:write` (for output file)
- **Description:** Convert text to speech audio. Returns a `MEDIA:` path that the platform delivers as a voice message. In terminal mode, saves to `~/voice-memos/`. Voice and provider are configurable via settings.
- **Inputs:** `{ text: string, voice?: string, speed?: number }`
- **Output:** `{ path: string, duration: number, mediaType: string }`
- **Implementation details:**
  - If `OPENAI_API_KEY` set → use OpenAI TTS (`tts-1` or `tts-1-hd`)
  - Endpoint: `https://api.openai.com/v1/audio/speech`
  - POST with `model: "tts-1"`, `input`, `voice: "alloy"|"echo"|"fable"|"onyx"|"nova"|"shimmer"`
  - Save audio to `~/voice-memos/[timestamp]_[voice].mp3`
  - Return `MEDIA:` path string (the `path` field starts with `MEDIA:`)
  - If no key configured, return descriptive error

---

### 4.4 Code Execution (1)

#### `execute_code`

- **Category:** code_execution
- **Permission:** `filesystem:exec`, `process:spawn`
- **Description:** Run a Python script programmatically. Use when you need 3+ tool calls with processing logic between them, need to filter/reduce large outputs, or need conditional branching. Executes in a sandboxed subprocess with memory and timeout limits.
- **Inputs:** `{ code: string, pythonVersion?: "3.10" | "3.11" | "3.12" }`
- **Output:** `{ stdout: string, stderr: string, exitCode: number, executionTime: number }`
- **Implementation details:**
  - Write code to temp file `tmp/_exec_code_[uuid].py`
  - Execute via `python3` child process (verify binary on PATH)
  - Timeout: 30 seconds (configurable)
  - Memory limit: 512MB
  - No network access (no `network:outbound` permission)
  - Clean up temp file on completion
  - If `python3` not found, return error suggesting install

---

### 4.5 Session & Scheduling (2)

#### `session_search` — already defined in Tier 1 (filesystem variant)

#### `cronjob`

- **Category:** schedule
- **Permission:** `filesystem:write`, `filesystem:read`
- **Description:** Unified scheduled-task manager. Use `action="create"`, `"list"`, `"update"`, `"pause"`, `"resume"`, `"run"`, or `"remove"` to manage jobs. Supports skill-backed jobs with attached skills and cron schedule. Cron runs happen in new sessions with no current-chat context.
- **Inputs:** `{ action: "create" | "list" | "update" | "pause" | "resume" | "run" | "remove", name?: string, cron?: string, skill?: string, input?: object, scheduleIndex?: number }`
- **Output varies by action:** `{ jobs?: ScheduleEntry[], name?: string, success: boolean }`
- **Implementation details:**
  - `create`: new entry → `{ name, cron, skill, input }` → persisted to `memory/schedules/`
  - `list`: load all from `memory/schedules/`, return with status
  - `update`: modify existing entry by index
  - `pause`/`resume`: toggle enabled flag
  - `run`: immediately invoke via schedule manager
  - `remove`: delete entry by index
  - Cron validation via `node-cron` library (already a dependency via `src/scheduler/`)
  - Persists to `config.yaml` schedules section

---

### 4.6 Multi-Agent (1)

#### `mixture_of_agents`

- **Category:** moa
- **Permission:** `network:outbound`
- **Requires env var:** `OPENROUTER_API_KEY`
- **Description:** Route a hard problem through multiple frontier LLMs collaboratively. Makes multiple API calls with maximum reasoning effort. Best for: complex math, advanced algorithms, hard creative writing. Use sparingly for genuinely difficult problems.
- **Inputs:** `{ prompt: string, model?: string (default: gpt-4o) }`
- **Output:** `{ consensus: string, references: string[], models: string[] }`
- **Implementation details:**
  - Use OpenRouter API: `https://openrouter.ai/api/v1/chat/completions`
  - Spawn 4 reference calls to different models: `gpt-4o`, `claude-3.5-sonnet`, `gemini-1.5-pro`, `llama-3.1-405b`
  - Wait for all 4 responses in parallel via `Promise.all`
  - 5th call to aggregator model (same as first, `gpt-4o`) with all 4 responses + original prompt → consensus request
  - Return aggregated answer + individual references
  - Timeout per call: 60 seconds
  - Total estimated time: 2-4 minutes
  - Cost warning: document in description that this makes 5 API calls

---

## 5. Browser Toolset (12)

All browser tools share a stateful browser session. They operate on a shared Playwright browser context. The browser session is lazily initialized on first call to `browser_navigate`.

### 5.1 Core Browser Tools (10)

#### `browser_navigate`

- **Category:** browser
- **Permission:** `network:outbound`
- **Description:** Navigate to a URL in the browser. Initializes the session and loads the page. Must be called before other browser tools.
- **Inputs:** `{ url: string }`
- **Output:** `{ url: string, title: string, status: number }`
- **Implementation details:**
  - Lazy init Playwright `chromium` or `firefox` via `puppeteer`
  - Wait for `networkidle` or `domcontentloaded`
  - Max wait: 30 seconds
  - Validate URL via sandbox URL filter

#### `browser_snapshot`

- **Category:** browser
- **Permission:** none (session state)
- **Description:** Get a text-based snapshot of the current page's accessibility tree. Returns interactive elements with ref IDs (`@e1`, `@e2`) for `browser_click` and `browser_type`.
- **Inputs:** `{ full?: boolean }`
- **Output:** `{ snapshot: string, elements: ElementRef[] }`
- **`ElementRef` schema:** `{ ref: string, role: string, name: string, tag: string, children?: ElementRef[] }`
- **Implementation details:**
  - Use Playwright's accessibility snapshot API
  - Compact mode (default): interactive elements only with ref IDs
  - Full mode: complete tree
  - Store snapshot in browser session state

#### `browser_click`

- **Category:** browser
- **Permission:** none (session state)
- **Description:** Click on an element identified by its ref ID from the snapshot (e.g., `@e5`). The ref IDs are shown in square brackets in the snapshot output.
- **Inputs:** `{ ref: string }`
- **Output:** `{ success: true, newUrl?: string }`
- **Implementation details:**
  - Map ref ID `@e5` to Playwright element locator
  - Click with `force: true` (bypasses overlay checks)
  - Wait for navigation if URL changes

#### `browser_type`

- **Category:** browser
- **Permission:** none (session state)
- **Description:** Type text into an input field identified by its ref ID. Clears the field first, then types the new text.
- **Inputs:** `{ ref: string, text: string }`
- **Output:** `{ success: true }`
- **Implementation details:**
  - Focus element → fill (clear + type)
  - Max text length: 2000 characters

#### `browser_scroll`

- **Category:** browser
- **Permission:** none (session state)
- **Description:** Scroll the page in a direction. Use to reveal more content below or above the current viewport.
- **Inputs:** `{ direction: "up" | "down" | "top" | "bottom", amount?: number }`
- **Output:** `{ success: true, scrolledTo: string }`
- **Implementation details:**
  - `page.evaluate(() => window.scrollBy(0, amount))`
  - Default amount: 600px
  - For `top`/`bottom`: evaluate `scrollTo(0, 0)` or `scrollTo(0, document.body.scrollHeight)`

#### `browser_back`

- **Category:** browser
- **Permission:** none (session state)
- **Description:** Navigate back to the previous page in browser history.
- **Inputs:** `{}`
- **Output:** `{ success: true, url: string, title: string }`

#### `browser_press`

- **Category:** browser
- **Permission:** none (session state)
- **Description:** Press a keyboard key. Useful for submitting forms (Enter), navigating (Tab), or keyboard shortcuts.
- **Inputs:** `{ key: string }`
- **Output:** `{ success: true }`
- **Implementation details:**
  - `page.keyboard.press(key)` via Playwright
  - Keys: `Enter`, `Tab`, `Escape`, `Backspace`, `ArrowUp`, `ArrowDown`, `Control+A`, `Control+C`, etc.

#### `browser_console`

- **Category:** browser
- **Permission:** none (session state)
- **Description:** Get browser console output and JavaScript errors from the current page. Returns `console.log`/warn/error/info messages and uncaught JS exceptions.
- **Inputs:** `{ limit?: number }`
- **Output:** `{ messages: ConsoleMessage[], errorCount: number, warningCount: number }`
- **`ConsoleMessage` schema:** `{ type: string, text: string, timestamp: string }`

#### `browser_get_images`

- **Category:** browser
- **Permission:** none (session state)
- **Description:** Get a list of all images on the current page with their URLs and alt text.
- **Inputs:** `{}`
- **Output:** `{ images: ImageInfo[], count: number }`
- **`ImageInfo` schema:** `{ src: string, alt: string | null, width: number, height: number }`
- **Implementation details:**
  - `page.$$eval("img", imgs => imgs.map(img => ({ src: img.src, alt: img.alt, width: img.naturalWidth, height: img.naturalHeight })))`

#### `browser_vision`

- **Category:** browser
- **Permission:** none (session state)
- **Description:** Take a screenshot of the current page and analyze it with vision AI. Use for CAPTCHAs, visual verification, complex layouts, or when text snapshot is insufficient.
- **Inputs:** `{ prompt?: string }`
- **Output:** `{ analysis: string, screenshotPath: string }`
- **Implementation details:**
  - `page.screenshot({ fullPage: true, type: "png" })`
  - Send screenshot to vision model (same backend as `vision_analyze`)
  - Use `prompt` to guide the analysis

---

### 5.2 CDP-Gated Browser Tools (2)

These only register when `browser.cdp_url` is configured in `config.yaml`:

```yaml
browser:
  cdp_url: ws://localhost:9222
  headless: true
```

#### `browser_cdp`

- **Category:** browser
- **Requires:** `browser.cdp_url` config
- **Description:** Send a raw Chrome DevTools Protocol command. Escape hatch for operations not covered by higher-level browser tools.
- **Inputs:** `{ method: string, params?: object }`
- **Output:** `{ result: object }`
- **Implementation details:**
  - Use `playwright` CDP session: `page.context().newCDPSession(page)`
  - Forward method + params to CDP
  - Examples: `Emulation.setDeviceMetricsOverride`, `Network.setRequestInterception`, `Runtime.evaluate`

#### `browser_dialog`

- **Category:** browser
- **Requires:** `browser.cdp_url` config
- **Description:** Respond to a native JavaScript dialog (alert/confirm/prompt/beforeunload). Call `browser_snapshot` first — pending dialogs appear in its `pending_dialogs` field. Then call with `action='accept'` or `'dismiss'`.
- **Inputs:** `{ action: "accept" | "dismiss", text?: string }`
- **Output:** `{ handled: true }`

---

## 6. Tier 3 — Platform-Integrated Tools (Conditionally Useful)

### 6.1 Discord Tools (2)

#### `discord`

- **Permission:** `network:outbound`
- **Requires env var:** `DISCORD_BOT_TOKEN`
- **Actions:** `search_members`, `fetch_messages`, `send_message`, `react`, `fetch_channel`, `list_channels`
- **Inputs vary by action** (see below per sub-action)
- **Output:** Action-specific JSON
- **Implementation details:**
  - Use Discord REST API (not WebSocket library — stateless HTTP calls)
  - Base URL: `https://discord.com/api/v10`
  - Auth via `Authorization: Bot ${token}` header
  - **`send_message`**: `{ channel_id: string, content: string, embed?: object }` → message ID
  - **`list_channels`**: `{ guild_id: string }` → array of channels
  - **`fetch_messages`**: `{ channel_id: string, limit?: number }` → messages array
  - **`search_members`**: `{ guild_id: string, query: string }` → matching members
  - **`react`**: `{ channel_id: string, message_id: string, emoji: string }` → 204
  - Each tool registered under prefix `discord_` so: `discord_send_message`, `discord_list_channels`

#### `discord_admin`

- **Permission:** `network:outbound`
- **Requires env var:** `DISCORD_BOT_TOKEN`
- **Actions:** `list_guilds`, `list_roles`, `create_channel`, `edit_channel`, `delete_channel`, `ban`, `kick`, `timeout`, `create_role`, `edit_role`
- **Output:** Action-specific JSON
- **Implementation details:**
  - Same Discord REST API, different endpoints
  - Requires bot to have matching Discord permissions
  - `create_channel`: `{ guild_id: string, name: string, type: "text" | "voice", topic?: string }` → channel object
  - `edit_channel`: `{ channel_id: string, updates: PartialChannelUpdate }` → updated channel
  - `delete_channel`: `{ channel_id: string }` → 204
  - `ban`: `{ guild_id: string, user_id: string, deleteMessageDays?: number }` → 204
  - `kick`: `{ guild_id: string, user_id: string }` → 204
  - `timeout`: `{ guild_id: string, user_id: string, durationMinutes: number }` → 204

---

### 6.2 Home Assistant Tools (4)

All gated by `HA_URL` + `HA_ACCESS_TOKEN` env vars.

#### `ha_list_entities`

- **Description:** List Home Assistant entities. Optionally filter by domain (`light`, `switch`, `climate`, `sensor`, `binary_sensor`, `cover`, `fan`) or by area name.
- **Inputs:** `{ domain?: string, area?: string }`
- **Output:** `{ entities: Entity[], count: number }`
- **API:** `GET {HA_URL}/api/states`

#### `ha_get_state`

- **Description:** Get detailed state of a single entity including all attributes.
- **Inputs:** `{ entity_id: string }`
- **Output:** `{ entity_id: string, state: string, attributes: object }`
- **API:** `GET {HA_URL}/api/states/{entity_id}`

#### `ha_call_service`

- **Description:** Call a Home Assistant service to control a device.
- **Inputs:** `{ domain: string, service: string, service_data: object, target?: object }`
- **Output:** `{ success: boolean }`
- **API:** `POST {HA_URL}/api/services/{domain}/{service}`

#### `ha_list_services`

- **Description:** List available Home Assistant services for device control.
- **Inputs:** `{ domain?: string }`
- **Output:** `{ services: Service[], count: number }`
- **API:** Parse from `GET {HA_URL}/api/services` (or iterate domains)

---

### 6.3 Computer Use (1)

#### `computer_use`

- **Permission:** `process:spawn`
- **Platform:** macOS only
- **Description:** Background macOS desktop control via cua-driver — screenshots (SOM / vision / AX), click, drag, scroll, type, key, wait, list_apps, focus_app. Does NOT steal the user's cursor or keyboard focus.
- **Actions:** `screen`, `click`, `drag`, `scroll`, `type`, `key`, `wait`, `list_apps`, `focus_app`
- **Inputs:** `{ action: string, x?: number, y?: number, text?: string, button?: "left" | "right" | "middle", modifiers?: string[], appName?: string }`
- **Output:** Action-specific (usually `{ success: true }` or `{ screenshots: string[] }` for `screen`)
- **Implementation details:**
  - macOS-only: check `os.platform() === "darwin"` at registration
  - Invoke `cua-driver` CLI binary via child process
  - Binary must be on `$PATH` — if not found, tool still registers but returns error
  - `screen`: runs `cua-screenshot`, returns base64 encoded image
  - `click`: runs `cua-click X Y BUTTON [MODIFIERS...]`
  - `type`: runs `cua-type TEXT`
  - All actions wrapped in sandbox timeout (default 15s)

---

### 6.4 Kanban Tools (8)

All gated by `HERMES_KANBAN_TASK` env var OR kanban toolset enabled in config. Each manages tasks on a simple text-based or JSON storage backend in `memory/kanban/`.

#### `kanban_show`
- **Description:** Show the active kanban task assigned to this worker (title, description, comments, dependencies).
- **Inputs:** `{}`
- **Output:** `{ task: Task, thread: Comment[] }`

#### `kanban_list`
- **Description:** List board tasks with filters (status: ready/in_progress/done).
- **Inputs:** `{ status?: string }`
- **Output:** `{ tasks: Task[], count: number }`

#### `kanban_complete`
- **Description:** Mark the current task done with a structured handoff payload (results, artifacts, follow-ups).
- **Inputs:** `{ results: string, artifacts: string[], followUps: string[] }`
- **Output:** `{ success: true, movedAt: string }`

#### `kanban_block`
- **Description:** Block the current task on a question for the user.
- **Inputs:** `{ question: string, context: string }`
- **Output:** `{ blocked: true, blockerId: string }`

#### `kanban_unblock`
- **Description:** Return a blocked task to ready.
- **Inputs:** `{ blockerId: string }`
- **Output:** `{ unblocked: true }`

#### `kanban_heartbeat`
- **Description:** Send a progress heartbeat during a long-running operation.
- **Inputs:** `{ message: string }`
- **Output:** `{ logged: true, timestamp: string }`

#### `kanban_comment`
- **Description:** Add a comment to the task thread without changing its state.
- **Inputs:** `{ comment: string }`
- **Output:** `{ added: true, commentId: string }`

#### `kanban_create`
- **Description:** Create child tasks from the current task.
- **Inputs:** `{ title: string, description?: string, deadline?: string }`
- **Output:** `{ created: Task[] }`

#### `kanban_link`
- **Description:** Link tasks with a parent → child dependency edge.
- **Inputs:** `{ parentTaskId: string, childTaskId: string }`
- **Output:** `{ linked: true }`

- **Implementation details:**
  - All data persisted to `memory/kanban/board.json`
  - Task schema: `{ id, title, description, status, createdAt, updatedAt, comments: Comment[], dependencies: string[], childIds: string[] }`
  - Comment schema: `{ id, text, author, timestamp }`
  - No external API — purely local storage (like todos but board-scoped)

---

### 6.5 Video Tools (2)

#### `video_analyze`

- **Category:** video
- **Permission:** `network:outbound`
- **Description:** Analyze video content from a URL or file path — captions, scene breakdowns, key timestamps, and visual descriptions.
- **Inputs:** `{ url: string, path?: string, maxDuration?: number }`
- **Output:** `{ summary: string, scenes: Scene[], captions: Caption[], duration: number }`
- **Implementation details:**
  - URL or local file path
  - Use a video analysis service or FFmpeg for extraction
  - If video too large, sample frames at intervals
  - Pass frames to vision model for scene description

#### `video_generate`

- **Category:** video_gen
- **Permission:** `network:outbound`
- **Requires env var:** `FAL_KEY` (FAL.ai) or `XAI_API_KEY` (xAI Grok-Imagine)
- **Description:** Generate a video from a text prompt (text-to-video) or animate a still image (image-to-video).
- **Inputs:** `{ prompt: string, image_url?: string, duration?: number }`
- **Output:** `{ videoUrl: string, duration: number, backend: string }`
- **Implementation details:**
  - FAL.ai: `https://queue.fal.run/fal-ai/veo-3.1` (POST)
  - xAI: `https://api.x.ai/v1/images/generations` with model param `grok-2-video`
  - If `image_url` provided → image-to-video modality
  - If no `image_url` → text-to-video modality
  - Timeout: 120 seconds (video gen is slow)

---

## 7. Tool Registration Architecture

### 7.1 The Tool Registry Module

File: `src/tools/index.js`

```javascript
// src/tools/index.js

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolvePermissions } from "../registry/permissions.js";

import * as fsTools from "./filesystem.js";
// ... other imports ...

/**
 * Build the tools array from enabled permissions.
 * Every tool is gated by at least one permission scope.
 * @param {Object} config - The loaded project config
 * @returns {Promise<import("@langchain/core/tools").Tool[]>}
 */
export async function buildToolConfig(config) {
  const toolsets = [];

  // Determine which permission scopes are enabled
  const perms = resolvePermissions({
    permissions: config.sandbox?.permissions || []
  });

  // Core filesystem tools — always available if permissions exist
  if (perms.includes("filesystem:read")) {
    toolsets.push(
      fsTools.read_file,
      fsTools.search_files,
      // ... more read tools
    );
  }

  if (perms.includes("filesystem:write")) {
    toolsets.push(
      fsTools.write_file,
      fsTools.patch,
      // ... more write tools
    );
  }

  // Terminal tools — gated by process:spawn + filesystem:exec
  if (perms.includes("process:spawn") && perms.includes("filesystem:exec")) {
    toolsets.push(terminal.terminal, terminal.process, terminal.execute_code);
  }

  // Web tools — gated by network:outbound + required API key
  if (perms.includes("network:outbound")) {
    const key = process.env.EXA_API_KEY || process.env.TAVILY_API_KEY ||
                process.env.FIRECRAWL_API_KEY || process.env.PARALLEL_API_KEY;
    if (key) {
      toolsets.push(web.web_search, web.web_extract);
    }
  }

  // Discord — gated by env var
  if (process.env.DISCORD_BOT_TOKEN) {
    toolsets.push(discord.discord_send_message, discord.discord_list_channels, /* ... */);
  }

  // Computer use — macOS only
  if (process.platform === "darwin") {
    toolsets.push(computer.computer_use);
  }

  return toolsets;
}
```

### 7.2 Integrating with the Agent

File: `src/tools/index.js` and modification to `index.js`:

```javascript
// In index.js, replace:
// const agent = createReactAgent(model, []);

// With:
const tools = await buildToolConfig(config);
const agent = createReactAgent(model, tools);
```

### 7.3 Common Tool Utilities

File: `src/tools/common.js` — shared helpers for all tools:

```javascript
// src/tools/common.js

import path from "node:path";
import { filterUrl } from "../sandbox/urlFilter.js";
import { enforceCapabilities } from "../sandbox/capability.js";

/**
 * Validate a file path against sandbox allowlist.
 * @param {string} requestedPath
 * @param {string[]} allowedPaths
 * @returns {string}
 */
export function validatePath(requestedPath, allowedPaths) { ... }

/**
 * Validate URL against sandbox URL filter.
 * @param {string} url
 * @returns {{ allowed: boolean, reason: string }}
 */
export function validateUrl(url) { ... }

/**
 * Fetch with timeout and URL validation.
 * @param {string} url
 * @param {number} [timeoutMs=10000]
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, timeoutMs = 10000) { ... }
```

---

## 8. Config Extension

The `config.yaml` needs these extensions:

```yaml
sandbox:
  paths:
    - memory/
    - skills/
    - tmp/
  timeout:
    seconds: 30
    gracePeriod: 5
  memoryLimit: 512m
  env:
    allowlist:
      - PATH
      - HOME
      - NODE_ENV
  permissions:
    - filesystem:read
    - filesystem:write
    - filesystem:exec
    - network:outbound
    - process:spawn
  maxReadSize: "1mb"

browser:
  engine: "chromium"  # chromium | firefox
  cdp_url: ""         # empty = no CDP tools
  headless: true

video_gen:
  backend: "fal"      # fal | xai

providers:
  # Already exist. New tool-related keys:
  # OPENAI_API_KEY (for OpenAI TTS, mixture_of_agents)
  # FAL_KEY (for image_generate, video_generate)
  # EXA_API_KEY (for web_search, web_extract)
  # FIRECRAWL_API_KEY (alt for web)
  # TAVILY_API_KEY (alt for web)
  # OPENROUTER_API_KEY (for mixture_of_agents)
  # DISCORD_BOT_TOKEN (for discord tools)
  # HA_URL (for Home Assistant)
  # HA_ACCESS_TOKEN (for Home Assistant)
  # XAI_API_KEY (for xAI video generation)
```

Schema update in `src/config/schemas.js`:

```javascript
export const BrowserSchema = z.object({
  engine: z.enum(["chromium", "firefox"]).default("chromium"),
  cdp_url: z.string().default(""),
  headless: z.boolean().default(true),
});

export const VideoGenSchema = z.object({
  backend: z.enum(["fal", "xai"]).default("fal"),
});

// Extended sandbox
export const SandboxSchema = SandboxScopeSchema.extend({
  permissions: z.array(z.string()).default([]),
  maxReadSize: z.string().default("1mb"),
});

// Root config
export const ConfigSchema = z.object({
  providers: ProvidersSchema,
  sandbox: SandboxSchema,
  browser: BrowserSchema.default({ engine: "chromium", cdp_url: "", headless: true }),
  video_gen: VideoGenSchema.default({ backend: "fal" }),
  memory: MemorySchema,
  telemetry: TelemetrySchema,
  schedules: SchedulesSchema,
  session: SessionSchema,
  tui: TuiSchema,
});
```

---

## 9. Testing Strategy

Each tool file gets a unit test file matching the pattern:

```
tests/unit/tools/
├── filesystem.test.js
├── terminal.test.js
├── todo.test.js
├── memory.test.js
├── web.test.js
├── clarify.test.js
├── schedule.test.js
└── tools_index.test.js
```

Test approach:
- **Native filesystem tools** (`read_file`, `write_file`, `patch`, `search_files`): create temp dir fixtures via `fs.mkdtempSync()`, test read/write/patch/seek operations
- **Terminal/tools** (`terminal`, `process`): mock `child_process.spawn` to avoid real execution
- **Tools requiring API keys**: mock `fetch` or use test doubles that return expected JSON
- **Tool registration** (`buildToolConfig`): test with different permission configs, verify correct subset of tools returned
- **100% coverage**: every function must be tested per AGENTS.md

---

## 9. Implementation Order (Recommended)

| Phase | Tools | Scope | Est. Effort |
|---|---|---|---|
| **P1** | `read_file`, `write_file`, `patch`, `search_files`, `terminal`, `process` | Filesystem + terminal basics | 2-3 days |
| **P2** | `todo`, `memory`, `session_search`, `clarify` | Session management + interaction | 1-2 days |
| **P3** | `skills_list`, `skill_view` | Skills introspection | < 1 day |
| **P4** | `web_search`, `web_extract`, `image_generate` | External APIs | 2-3 days |
| **P5** | `vision_analyze`, `text_to_speech`, `execute_code` | Multimodal + code | 1-2 days |
| **P6** | `cronjob`, `mixture_of_agents` | Scheduling + MOA | 1-2 days |
| **P7** | Browser toolset (10 tools) | Browser automation | 3-4 days |
| **P8** | CDP tools + Discord + Computer Use | Platform integrations | 2-3 days |
| **P9** | Kanban suite + Home Assistant + Video | Niche platforms | 2-3 days |

**Total estimate: ~15-22 days** (one developer, all tiers)

---

## 10. Tool List Summary (Complete Inventory)

| # | Tool Name | Tier | Permission Required | API Key Required |
|---|---|---|---|---|
| 1 | `read_file` | 1 | `filesystem:read` | — |
| 2 | `write_file` | 1 | `filesystem:write` | — |
| 3 | `patch` | 1 | `filesystem:write` | — |
| 4 | `search_files` | 1 | `filesystem:read` | — |
| 5 | `terminal` | 1 | `filesystem:exec`, `process:spawn` | — |
| 6 | `process` | 1 | `process:spawn` | — |
| 7 | `todo` | 1 | `filesystem:read`, `filesystem:write` | — |
| 8 | `memory` | 1 | `filesystem:read`, `filesystem:write` | — |
| 9 | `session_search` | 1 | `filesystem:read` | — |
| 10 | `clarify` | 1 | none | — |
| 11 | `skills_list` | 1 | `filesystem:read` | — |
| 12 | `skill_view` | 1 | `filesystem:read` | — |
| 13 | `web_search` | 2 | `network:outbound` | EXA/FIRECRAWL/TAVILY/PARALLEL |
| 14 | `web_extract` | 2 | `network:outbound` | Same API key as web_search |
| 15 | `image_generate` | 2 | `network:outbound` | FAL_KEY |
| 16 | `vision_analyze` | 2 | none | Multimodal model (GPT-4o) |
| 17 | `text_to_speech` | 2 | `filesystem:write` | OPENAI_API_KEY (TTS) |
| 18 | `execute_code` | 2 | `filesystem:exec`, `process:spawn` | — (python3 on PATH) |
| 19 | `cronjob` | 2 | `filesystem:read`, `filesystem:write` | — |
| 20 | `mixture_of_agents` | 2 | `network:outbound` | OPENROUTER_API_KEY |
| 21 | `browser_navigate` | 2/3 | `network:outbound` | — |
| 22 | `browser_snapshot` | 2/3 | session state | — |
| 23 | `browser_click` | 2/3 | session state | — |
| 24 | `browser_type` | 2/3 | session state | — |
| 25 | `browser_scroll` | 2/3 | session state | — |
| 26 | `browser_back` | 2/3 | session state | — |
| 27 | `browser_press` | 2/3 | session state | — |
| 28 | `browser_console` | 2/3 | session state | — |
| 29 | `browser_get_images` | 2/3 | session state | — |
| 30 | `browser_vision` | 2/3 | session state | Vision-capable LLM |
| 31 | `browser_cdp` | 3 | session state | CDP endpoint |
| 32 | `browser_dialog` | 3 | session state | CDP endpoint |
| 33 | `computer_use` | 3 | `process:spawn` | cua-driver (macOS) |
| 34 | `todo` *(duplicate, already #7)* | — | — | — |
| 35 | `kanban_show` | 3 | `filesystem:read`, `filesystem:write` | — |
| 36 | `kanban_list` | 3 | `filesystem:read` | — |
| 37 | `kanban_complete` | 3 | `filesystem:write` | — |
| 38 | `kanban_block` | 3 | `filesystem:write` | — |
| 39 | `kanban_unblock` | 3 | `filesystem:write` | — |
| 40 | `kanban_heartbeat` | 3 | `filesystem:write` | — |
| 41 | `kanban_comment` | 3 | `filesystem:write` | — |
| 42 | `kanban_create` | 3 | `filesystem:write` | — |
| 43 | `kanban_link` | 3 | `filesystem:write` | — |
| 44 | `discord` (send_message) | 3 | `network:outbound` | DISCORD_BOT_TOKEN |
| 45 | `discord` (list_channels) | 3 | `network:outbound` | DISCORD_BOT_TOKEN |
| 46 | `discord` (fetch_messages) | 3 | `network:outbound` | DISCORD_BOT_TOKEN |
| 47 | `discord_admin` (create_channel) | 3 | `network:outbound` | DISCORD_BOT_TOKEN |
| 48 | `discord_admin` (edit_channel) | 3 | `network:outbound` | DISCORD_BOT_TOKEN |
| 49 | `discord_admin` (delete_channel) | 3 | `network:outbound` | DISCORD_BOT_TOKEN |
| 50 | `discord_admin` (ban) | 3 | `network:outbound` | DISCORD_BOT_TOKEN |
| 51 | `discord_admin` (kick) | 3 | `network:outbound` | DISCORD_BOT_TOKEN |
| 52 | `discord_admin` (timeout) | 3 | `network:outbound` | DISCORD_BOT_TOKEN |
| 53 | `ha_list_entities` | 3 | `network:outbound` | HA_URL, HA_ACCESS_TOKEN |
| 54 | `ha_get_state` | 3 | `network:outbound` | HA_URL, HA_ACCESS_TOKEN |
| 55 | `ha_call_service` | 3 | `network:outbound` | HA_URL, HA_ACCESS_TOKEN |
| 56 | `ha_list_services` | 3 | `network:outbound` | HA_URL, HA_ACCESS_TOKEN |
| 57 | `video_analyze` | 3 | `network:outbound` | — |
| 58 | `video_generate` | 3 | `network:outbound` | FAL_KEY or XAI_API_KEY |

**Note:** Discord and Home Assistant tools are listed as individual actions for counting. In implementation they are grouped as single modules with multiple actions dispatched by parameter. Actual distinct tool definitions: ~48 files/modules (grouped by file as described in Section 2.1).

**Excluded per request:** Spotify (7 tools), X/Twitter search (`x_search`), Feishu (5 tools), Yuanbao (5 tools), Honcho (4 tools) — ~26 tools total excluded.
