## Why

Tier 1 tools give the agent basic filesystem and process control. Tier 2 extends capability to the real world: searching and extracting web content, generating images and speech, analyzing vision inputs, executing arbitrary code, scheduling recurring jobs, and routing hard problems through multiple LLMs. These are the tools most likely to be called in typical user workflows — web research, creative generation, code execution, and multi-agent collaboration.

## What Changes

- Add web tools: `web_search`, `web_extract` (gated by EXA/FIRECRAWL/TAVILY/PARALLEL API key)
- Add vision and image tools: `vision_analyze`, `image_generate` (image requires FAL_KEY)
- Add text-to-speech: `text_to_speech` (requires OPENAI_API_KEY)
- Add code execution: `execute_code` (sandboxed Python subprocess)
- Add scheduling: `cronjob` manager (persisted to `memory/schedules/`)
- Add multi-agent: `mixture_of_agents` (routes through 4 LLMs via OpenRouter)
- Register all via `buildToolConfig()` with permission + API key gating
- Each tool file gets unit tests for 100% coverage

## Capabilities

### New Capabilities
- `tools-tier2`: LangChain tools for web search/extract, image/vision generation, TTS, code execution, cron scheduling, and mixture-of-agents — all with API-key-based registration gating

### Modified Capabilities
- `tools` (from add-tools-tier1): The existing tools spec is extended with additional tool files and registration entries; permission gating in `buildToolConfig()` adds `network:outbound` checks
- `sandbox-rte`: Code execution tool requires subprocess memory/cpu constraints; web tools use existing URL filter

## Impact

- **New files**: `src/tools/web.js`, `src/tools/vision.js`, `src/tools/image.js`, `src/tools/tts.js`, `src/tools/code.js`, `src/tools/cron.js`, `src/tools/moa.js`
- **Modified files**: `src/tools/index.js` (expanded import set and permission checks)
- **Config**: `sandbox.permissions` gains `network:outbound` for Tier 2 registration
- **Environment variables**: OPENAI_API_KEY, FAL_KEY, EXA_API_KEY/FIRECRAWL_API_KEY/TAVILY_API_KEY, OPENROUTER_API_KEY
- **Dependencies**: No new npm packages — all HTTP calls use `fetch` (Node.js native)
