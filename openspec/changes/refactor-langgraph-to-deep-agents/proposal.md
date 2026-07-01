## Why

The current subAgent implementation spawns child Node.js processes via `node index.js --sub-agent` for every skill execution and delegation. This approach has significant limitations: process overhead from full Node.js startup latency, no native coordination between orchestrator and sub-agents, limited observability, complex manual error handling for fan-out strategies, and no native interruption support. Deep Agents provides a native, coordinated multi-agent architecture with built-in orchestration, state management, and observability that eliminates these limitations while maintaining the same delegation semantics.

## What Changes

- Replace `src/agent/react.js` ReAct agent with Deep Agents orchestrator from `@langchain/deepagents`
- Delete `src/tools/subAgent.js`, `src/tools/subAgentLog.js`, `src/tools/subAgentMessage.js` (process-spawning subAgent tool family)
- Remove subAgent tool registrations from `src/tools/index.js` (TOOL_PERMISSIONS, TOOL_FACTORIES)
- Update `prompts/SYSTEM_PROMPT.md` delegation instructions to use Deep Agents instead of subAgent tool calls
- Remove turn hash tracking loop detection and config (`turnHashWindow`, `turnBufferMax`)
- Adapt TUI streaming callback to work with Deep Agents event model
- Restructure `config.yaml` agent configuration for Deep Agents settings
- Update `src/provider/openai.js` temperature handling for Deep Agents

## Capabilities

### New Capabilities
- `deep-agents-orchestrator`: Native multi-agent orchestration using LangChain Deep Agents, replacing process-spawning subAgent with specialized agents (coding, utility) managed by a central orchestrator

### Modified Capabilities
- `react-agent`: Replaced with Deep Agents orchestrator; public API (`callReactAgent`, `callReactAgentStreaming`) maintained for compatibility
- `subagent`: Removed entirely; replaced by Deep Agents native delegation
- `streaming-interruption`: Updated to use Deep Agents native interruption instead of AbortController + manual cleanup
- `streaming-loop-detection`: Removed ad-hoc turn hash tracking; relies on Deep Agents built-in loop detection
- `compaction`: Integrated into Deep Agents flow instead of separate handling
- `config-system`: Removed process subAgent config and turn hash tracking config; added Deep Agents configuration

## Impact

- **Affected code:** `src/agent/react.js`, `src/tools/subAgent.js`, `src/tools/subAgentLog.js`, `src/tools/subAgentMessage.js`, `src/tools/index.js`, `index.js`, `src/tui/app.js`, `prompts/SYSTEM_PROMPT.md`, `config.yaml`, `src/provider/openai.js`, `src/memory/prompts.js`
- **Dependencies:** Adds `@langchain/deepagents` dependency
- **API surface:** Public agent API maintained for compatibility; internal implementation changes significantly
- **TUI:** Streaming callback event model needs adaptation for Deep Agents events
- **Breaking:** Process-based subAgent tool family removed; turn hash tracking removed