## 1. Remove Dead Code

- [x] 1.1 Delete `src/agent/agentRegistry.js`
- [x] 1.2 Delete `tests/unit/agentRegistry.test.js`

## 2. Defer Eager Prompt Loading

- [x] 2.1 Refactor `src/agent/agentDefinitions.js` to load prompts lazily on first `getAllAgents()` call, caching the resolved array
- [x] 2.2 Update `tests/unit/agentDefinitions.test.js` for lazy-load semantics (prompt-load failure tests must still pass)

## 3. Remove Trivial Identity Wrapper

- [x] 3.1 Inline `getAgentClassifications(agentName)` in `src/agent/deepAgents.js` and delete the function

## 4. Stop Mutating Shared Config Singleton

- [x] 4.1 Trace TUI consumers of `config.summarization.trigger` and `config.providers[providerName].contextWindow`
- [x] 4.2 Refactor `createDeepAgentsOrchestrator` in `src/agent/deepAgents.js` to stop mutating the shared config singleton; propagate derived trigger/context-window values explicitly
- [x] 4.3 Update TUI consumers to read the explicitly-propagated values
- [x] 4.4 Update `tests/unit/deepAgents.test.js` for the config-mutation change

## 5. Replace O(n*m) Tool Lookup

- [x] 5.1 Refactor `createSubagentDefinitions` in `src/agent/deepAgents.js` to build a Map keyed by tool name once and look up in O(1)
- [x] 5.2 Update `tests/unit/deepAgents.test.js` for the tool-lookup change

## 6. Verification

- [x] 6.1 Run `npm run lint`
- [x] 6.2 Run `npm run test`
- [x] 6.3 Run `npm run coverage`
