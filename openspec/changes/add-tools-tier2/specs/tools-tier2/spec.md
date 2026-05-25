## ADDED Requirements

### Requirement: Web Search Selects Backend From Available API Key
The `web_search` tool SHALL detect which search API key is configured (`EXA_API_KEY`, `FIRECRAWL_API_KEY`, `TAVILY_API_KEY`, or `PARALLEL_API_KEY`), select the corresponding backend, and query it. If no key is set, the tool is not registered.

#### Scenario: Web search uses Exa when EXA_API_KEY is set
- **WHEN** `EXA_API_KEY` is set in environment and `web_search` is called with `query: "machine learning"`
- **THEN** the tool POSTs to `https://api.exa.ai/search` and returns up to 5 results with title, URL, and description

#### Scenario: Web search falls back to Tavily when Exa is not set
- **WHEN** `EXA_API_KEY` is not set but `TAVILY_API_KEY` is set and `web_search` is called
- **THEN** the tool POSTs to `https://api.tavily.com/search` instead

#### Scenario: Web search returns descriptive error when no API key is configured
- **WHEN** `network:outbound` is enabled but no search API key is set
- **THEN** the tool returns an error listing the available API keys to configure

### Requirement: Web Search Supports Custom Limit
The `web_search` tool SHALL accept a `limit` parameter between 1 and 100, defaulting to 5.

#### Scenario: Web search respects custom limit
- **WHEN** `web_search` is called with `limit: 20`
- **THEN** the response contains up to 20 results

#### Scenario: Web search rejects out-of-range limit
- **WHEN** `web_search` is called with `limit: 0` or `limit: 200`
- **THEN** the tool returns a validation error

### Requirement: Web Extract Fetches Page Content
The `web_extract` tool SHALL extract content from a URL, returning markdown format. Pages under 5000 chars return full markdown; larger pages are summarized. URLs must pass sandbox URL validation.

#### Scenario: Extract returns full markdown for small pages
- **WHEN** `web_extract` is called with a URL returning under 5000 characters
- **THEN** the full markdown content is returned

#### Scenario: Extract returns summary for large pages
- **WHEN** `web_extract` is called with a URL returning over 10000 characters
- **THEN** an LLM-generated summary is returned instead of full content

#### Scenario: Extract rejects blocked URL scheme
- **WHEN** `web_extract` is called with `url: "file:///etc/passwd"`
- **THEN** the tool returns an error without making any HTTP request

### Requirement: Vision Analyze Sends Image to Multimodal LLM
The `vision_analyze` tool SHALL fetch an image from a URL or decode a base64 data URI, then send it to the configured multimodal LLM for analysis. The tool must not require any additional API key beyond the agent's primary model provider.

#### Scenario: Vision analyzes image from URL
- **WHEN** `vision_analyze` is called with `url: "https://example.com/chart.png"`
- **THEN** the tool fetches the image (respecting max 4MB size) and returns the LLM's description

#### Scenario: Vision analyzes image from data URI
- **WHEN** `vision_analyze` is called with `dataUri: "data:image/png;base64,..."` (valid base64)
- **THEN** the tool decodes the base64 and returns the LLM's description

#### Scenario: Vision rejects oversized image
- **WHEN** `vision_analyze` is called with a URL that fetches an image over 4MB
- **THEN** the tool returns an error without sending it to the model

### Requirement: Text to Speech Saves Audio File
The `text_to_speech` tool SHALL call OpenAI's TTS API (`tts-1` or `tts-1-hd`), save the audio to `~/voice-memos/[timestamp]_[voice].mp3`, and return a `MEDIA:` path.

#### Scenario: TTS generates speech and saves file
- **WHEN** `text_to_speech` is called with `text: "Hello world"` and `voice: "alloy"`
- **THEN** the tool saves a file to `~/voice-memos/[timestamp]_alloy.mp3` and returns `{ path: "MEDIA:~/voice-memos/..." }`

#### Scenario: TTS requires OPENAI_API_KEY
- **WHEN** `OPENAI_API_KEY` is not set
- **THEN** the tool is not registered in the tools array

### Requirement: Execute Code Runs Python in Sandboxed Subprocess
The `execute_code` tool SHALL write Python code to a temp file under `tmp/`, execute it via `python3` with a 30-second timeout and no network access, and return stdout, stderr, and exit code.

#### Scenario: Code executes and returns output
- **WHEN** `execute_code` is called with `code: "print(2 + 2)"`
- **THEN** the tool returns `{ stdout: "4\n", stderr: "", exitCode: 0, executionTime: <number> }`

#### Scenario: Code execution times out
- **WHEN** `execute_code` is called with `code: "import time; time.sleep(60)"`
- **THEN** the subprocess is killed after 30 seconds and the tool returns a timeout error

#### Scenario: Code execution rejects missing python3
- **WHEN** `python3` is not found on PATH
- **THEN** the tool returns an error suggesting to install Python 3

#### Scenario: Code execution cleans up temp file
- **WHEN** `execute_code` completes (success or failure)
- **THEN** the temporary `.py` file under `tmp/` is deleted

### Requirement: Cron Job Manager Persists To Disk
The `cronjob` tool SHALL manage scheduled jobs persisted as JSON files under `memory/schedules/`. Actions include `create`, `list`, `update`, `pause`, `resume`, `run`, and `remove`.

#### Scenario: Create adds a new job
- **WHEN** `cronjob` is called with `action: "create"`, `name: "daily-report"`, `cron: "0 9 * * *"`, `skill: "report-gen"`, `input: { recipient: "admin" }`
- **THEN** a JSON file is written to `memory/schedules/` and the response confirms creation

#### Scenario: List returns all jobs with status
- **WHEN** `cronjob` is called with `action: "list"`
- **THEN** it returns `{ jobs: [ { name, cron, skill, input, enabled, createdAt, updatedAt }, ... ] }`

#### Scenario: Pause and resume toggle enabled flag
- **WHEN** `cronjob` is called with `action: "pause"` and `name: "daily-report"`
- **THEN** the job's `enabled` field is set to `false`; subsequent `resume` toggles it back

#### Scenario: Run triggers immediate execution
- **WHEN** `cronjob` is called with `action: "run"` and `name: "daily-report"`
- **THEN** the job is invoked immediately via the scheduler manager

### Requirement: Tier 2 Tools Require network:outbound Permission
All Tier 2 tools (except `vision_analyze`) SHALL only be registered when `config.sandbox.permissions` includes `network:outbound`. `vision_analyze` registers when no permission is required (like `clarify`).

#### Scenario: Web tools register when network:outbound is enabled
- **WHEN** `sandbox.permissions` includes `network:outbound` and `EXA_API_KEY` is set
- **THEN** `web_search` and `web_extract` are registered

#### Scenario: Vision tool registers without network:outbound permission
- **WHEN** `sandbox.permissions` is empty
- **THEN** `vision_analyze` is still registered because it has no permission requirement

### Requirement: Safety Limits Are Configurable with Hardware-Aware Caps
The system SHALL expose all safety parameters (timeout, memory, URL filtering, Python import restrictions) as configurable settings in `config.yaml`. A value of `0` disables the guard entirely. Hard caps are enforced: memory limits cannot exceed system total RAM, and timeout values of `0` mean no limit.

#### Scenario: User can disable timeout by setting to 0
- **WHEN** `sandbox.timeout.seconds` is set to `0` in config
- **THEN** the timeout guard is skipped and processes run without a time limit

#### Scenario: Memory limit is clamped to system total
- **WHEN** `sandbox.memoryLimit` is set to a value exceeding `os.totalmem()`
- **THEN** the value is clamped to `os.totalmem()` and a warning is logged

#### Scenario: User can disable URL filtering
- **WHEN** `sandbox.safety.urlFilter` is set to `false` in config
- **THEN** tools skip the URL validation step and allow `file://`, `gopher://`, `dict://` schemes

#### Scenario: Python import hook is optional
- **WHEN** `sandbox.safety.pythonImportHook` is set to `false`
- **THEN** `execute_code` runs Python without the restrictive `sys.meta_path` finder, allowing `subprocess`, `os`, and `socket` imports

#### Scenario: Code execution uses configured limits
- **WHEN** `sandbox.timeout.seconds` is `120` and `sandbox.memoryLimit` is `4g` and `sandbox.safety.urlFilter` is `false`
- **THEN** `execute_code` runs with a 120s timeout, 4GB memory cap, and no URL filtering, all within system hardware bounds
