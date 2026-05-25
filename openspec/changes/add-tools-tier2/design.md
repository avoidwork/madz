## Context

Tier 2 tools extend the agent from local computation (Tier 1) to external services and media generation. All Tier 2 tools require either an `network:outbound` sandbox permission and at least one API key. If the required API key is not set, the tool is not registered at all.

The project already has `fetchWithTimeout` from Tier 1's `common.js` module and URL validation from `src/sandbox/urlFilter.js`. Tier 2 reuses these for all outbound HTTP calls.

## Goals / Non-Goals

**Goals:**
- Implement 5 Tier 2 tools: web (2), vision (1), TTS (1), code execution (1), cron (1)
- API-key-based registration: tools only registered when their required env var is present
- Permission gating: all Tier 2 tools require `network:outbound` (except `vision_analyze`)
- Safe code execution: Python runs in forked subprocess with 30s timeout, 512MB memory, no network
- Scheduled tasks persisted to `memory/schedules/`, usable with `node-cron`
- 100% test coverage

**Non-Goals:**
- Tier 3 tools (browser, Discord, Home Assistant, kanban, video, computer use)
- CDP-gated browser tools
- Image generation (FLUX 2 Klein, FAL.ai)
- Voice output through the TUI (saves to filesystem; TUI delivery is a future change)
- Queue-based API call retry with exponential backoff (simple retry: 2 max)

## Decisions

### Decision 1: Web search backend is detected from env var, not config
**Choice:** Detect which API key is set (`EXA_API_KEY` > `FIRECRAWL_API_KEY` > `TAVILY_API_KEY` > `PARALLEL_API_KEY`) and select the backend automatically.
**Rationale:** The user only has one search API key at a time. Config-based selection adds a YAML field the user would need to maintain. Auto-detection from env vars is simpler.
**Alternatives considered:** Configurable `search_backend` in config. Rejected because it adds another config field for a function that auto-detection solves.

### Decision 2: Code execution uses Python only (not multi-language)
**Choice:** `execute_code` only supports Python3 scripts written to temp files.
**Rationale:** Python is the most common language for data processing, the primary use case for code execution. Adding more languages increases attack surface without clear benefit for Tier 2.
**Alternatives considered:** Support JavaScript (same runtime), bash, multiple languages. Rejected because Python is the lowest-common-denominator for data scripts, and JS already executes natively in the harness.

### Decision 4: Cron jobs persist to `memory/schedules/` as JSON files
**Choice:** Each cron job is a JSON file in `memory/schedules/` with fields `{ name, cron, skill, input, enabled, createdAt, updatedAt }`.
**Rationale:** Mirrors the existing `src/scheduler/` module which already reads from this directory. Reuses the scheduler infrastructure.
**Alternatives considered:** Store in `config.yaml` under `schedules` section, or in-memory Map. Rejected because file persistence survives restarts and is inspectable.

### Decision 5: TTS saves output to `~/voice-memos/` as MP3
**Choice:** Use OpenAI TTS API (`tts-1`) to generate audio, save to `~/voice-memos/[timestamp]_[voice].mp3`, return `MEDIA:` path.
**Rationale:** OpenAI's TTS is the only widely-available text-to-speech API we'd integrate at Tier 2. The `MEDIA:` path format is a convention the harness already supports for media attachments.
**Alternatives considered:** Support 3rd-party TTS like ElevenLabs. Rejected because Tier 2 should have one working TTS path first.

### Decision 6: Vision analyze uses the same LLM model as the agent
**Choice:** `vision_analyze` fetches the image, then calls the agent's configured model with the image pixels as context — no separate vision API.
**Rationale:** Most modern LLMs used in the project (GPT-4o, Claude Sonnet) are multimodal. Making a separate vision API call is wasteful. The image is sent directly to the model.
**Alternatives considered:** Dedicated vision API endpoint. Rejected because multimodal models are the default, and separate APIs add cost and latency.

## Risks / Trade-offs

[Risk: API token cost from MOA]
MOA makes 5 LLM API calls (4 references + 1 aggregate). A single use can cost $0.10-$0.50+. Mitigation: the tool description must warn about cost; consider adding a `maxCost` parameter later.

[Risk: Web search API rate limits]
Free tiers of Exa/Firecrawl/Tavily have strict rate limits (e.g., 100-500 requests/day). Mitigation: `maxRetries: 2` on each request; the user can switch backends by changing which env var is set.

[Risk: Code execution allows arbitrary computation]
Even sandboxed, a Python subprocess could consume all memory or CPU. Mitigation: enforce 512MB memory (configurable), 30s timeout, no network access (no `network:outbound`), and `subprocess`/`os` module restrictions via a custom Python import hook.

[Risk: Image generation timeout failures]
FLUX 2 on FAL.ai can take 5-30 seconds depending on load. Mitigation: `sync_mode: true` with 30s timeout is generous, but slow periods may cause failure. The tool description should note this variability.

[Risk: TTS API quota exhaustion]
OpenAI TTS has character-based billing. At $0.015/1K chars (tts-1), 100 voice memos at 500 chars each = $0.75. Mitigation: document pricing in tool description; no hard cap at API level (user sets their own OpenAI quota).

### Decision 7: Safety limits are fully configurable with hardware-aware caps
**Choice:** All sandbox safety parameters (timeout, memory limits, URL filtering, Python import restrictions) are configurable via `config.yaml`. Values are clamped: hard limit is system memory (for memory limits) or `Infinity` (for timeouts). User can set limits to 0 to disable entirely. If user disables a safety layer (e.g., URL filter, timeout), the tool simply skips that check.
**Rationale:** The user may want unrestricted tool usage on their local machine where they control all risk. Hard-coded min/max values prevent the tool from being unusable (e.g., timeout of 1s is too short for MOA), but setting to 0 disables the guard. For memory: cap at `totalSystemMemory` — a user with 8GB can set `maxSubprocessMem: 7g` but not `32g`.
**Alternatives considered:** Always enforce minimums. Rejected because it prevents power users from tuning for their hardware.

## Risks / Trade-offs

[Risk: API token cost from MOA]
MOA makes 5 LLM API calls (4 references + 1 aggregate). A single use can cost $0.10-$0.50+. Mitigation: the tool description must warn about cost; consider adding a `maxCost` parameter later.

[Risk: Web search API rate limits]
Free tiers of Exa/Firecrawl/Tavily have strict rate limits (e.g., 100-500 requests/day). Mitigation: `maxRetries: 2` on each request; the user can switch backends by changing which env var is set.

[Risk: Code execution allows arbitrary computation]
Even sandboxed, a Python subprocess could consume all memory or CPU. Mitigation: enforce configurable memory (default 512MB, max system RAM), configurable timeout (default 30s, 0=no limit), no network access unless sandbox allows it, and optional Python import hook. All safety toggles are explicit: user must set value to `0` to disable.

[Risk: Image generation timeout failures]
FLUX 2 on FAL.ai can take 5-30 seconds depending on load. Mitigation: `sync_mode: true` with 30s default timeout (configurable to 0 for no limit); the tool description should note this variability.

[Risk: TTS API quota exhaustion]
OpenAI TTS has character-based billing. At $0.015/1K chars (tts-1), 100 voice memos at 500 chars each = $0.75. Mitigation: document pricing in tool description; no hard cap at API level (user sets their own OpenAI quota).

## Open Questions
1. Should `execute_code` restrict Python imports (no `subprocess`, `os`, `socket`)? **Decision: Yes — implement a restrictive `sys.meta_path` finder, but allow user to disable via `sandbox.safety.python_import_hook: false`.**
2. Should `cronjob` `run` action be blocked without confirmation? **Decision: Allow silent run — the LLM can reason about whether to invoke it.**
