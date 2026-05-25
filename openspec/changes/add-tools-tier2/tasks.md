## 1. Safety Configuration Extension

- [ ] 1.1 Extend sandbox config schema with safety subobject: `sandbox.safety.urlFilter`, `sandbox.safety.pythonImportHook`
- [ ] 1.2 Add `sandbox.timeout.seconds` as configurable number (0 = no limit), default 30
- [ ] 1.3 Add `sandbox.memoryLimit` as parseable string (e.g., "512m", "2g"), clamped to `os.totalmem()`
- [ ] 1.4 Write config schema tests (0 disables guard, memory clamped, timeout 0 skips)

## 2. Web Tools

- [ ] 2.1 Create src/tools/web.js — implement web_search with auto-detection of API key (Exa > Firecrawl > Tavily > Parallel)
- [ ] 2.2 Implement web_extract with URL validation, markdown return for small pages, LLM summary for large pages
- [ ] 2.3 Write unit tests for web.js (each backend selection, limit parameter, URL rejection, content size paths)

## 3. Vision & Image Tools

- [ ] 3.1 Create src/tools/vision.js — implement vision_analyze: fetch from URL or decode dataUri, send to multimodal LLM
- [ ] 3.2 Create src/tools/image.js — implement image_generate via FAL.ai flux/klein API with sync_mode
- [ ] 3.3 Write unit tests for vision.js (url fetch, dataUri decode, oversized rejection) and image.js (API call, prompt length, unregistered without key)

## 4. Text-to-Speech

- [ ] 4.1 Create src/tools/tts.js — implement text_to_speech: call OpenAI TTS API (tts-1), save to ~/voice-memos/[timestamp]_[voice].mp3
- [ ] 4.2 Write unit tests for tts.js (API call, file save, unregistered without OPENAI_API_KEY)

## 5. Code Execution

- [ ] 5.1 Create src/tools/code.js — implement execute_code: support language parameter (python3/javascript/shell), write temp file, spawn interpreter, enforce timeout/memory, cleanup temp
- [ ] 5.2 Implement Python import hook via sys.meta_path_finder to block subprocess/os/socket (configurable off, only applies to python3 language)
- [ ] 5.3 Write unit tests for code.js (python3 execution, JS execution via node, shell execution, timeout, missing interpreter, temp cleanup, import hook on/off)

## 6. Cron Job Manager

- [ ] 6.1 Create src/tools/cron.js — implement cronjob with create/list/update/pause/resume/run/remove actions
- [ ] 6.2 Persist jobs as JSON files in memory/schedules/ with fields: name, cron, skill, input, enabled, createdAt, updatedAt
- [ ] 6.3 Run action invokes via scheduler module; validate cron expression via node-cron library
- [ ] 6.4 Write unit tests for cron.js (all CRUD actions, persistence, cron validation, unregistered without network:outbound)

## 7. Mixture of Agents

- [ ] 7.1 Create src/tools/moa.js — implement mixture_of_agents: 4 parallel OpenRouter calls + 1 aggregator
- [ ] 7.2 Per-call timeout: 60 seconds; partial results aggregated when one call fails
- [ ] 7.3 Write unit tests for moa.js (parallel calls, aggregation, partial results on timeout, unregistered without OPENROUTER_API_KEY)

## 8. Tool Registration & Integration

- [ ] 8.1 Update src/tools/index.js with new tool imports and network:outbound permission checks
- [ ] 8.2 wire safety config into tool modules (timeout, memory, urlFilter, pythonImportHook)
- [ ] 8.3 Write integration tests for tool registration (no tools with no permissions, web tools with network:outbound+key, moa with key, vision without permission)
- [ ] 8.4 Run npm run test for all tests passing
- [ ] 8.5 Run npm run fix && npm run lint to verify formatting
- [ ] 8.6 Run npm run coverage and verify 100% on all new files
