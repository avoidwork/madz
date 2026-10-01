## 1. Create Tool Implementation

- [x] 1.1 Create `src/tools/decision/index.js` with `decisionImpl(input, options)` using `tool()` wrapper and a permissive Zod schema (`state` as string/object, `questions` as a record of `{ type, instructions, criteria? }`)
- [x] 1.2 Implement the Ollama `/v1/systemone` call via `fetch`, reading config from `options.decisionConfig`, with a timeout and graceful error handling

## 2. Register the Tool

- [x] 2.1 Add `TOOL_PERMISSIONS.decision = ["network:outbound"]` in `src/tools/index.js`
- [x] 2.2 Add `TOOL_CLASSIFICATIONS.decision = ["orchestrator", "coding", "research"]` in `src/tools/index.js`
- [x] 2.3 Add `"decision"` to `ORCHESTRATOR_TOOLS` and `decision` to the `TOOLS` map in `src/tools/index.js`
- [x] 2.4 In `buildToolConfig()`, read `config.agent.decision` into `runtimeOptions.decisionConfig` and add a `case "decision"` that registers only when `hasAllPerms && runtimeOptions.decisionConfig?.baseUrl`

## 3. Add Config Schema

- [x] 3.1 Add a `DecisionSchema` (`baseUrl` string default `""`, `model` string default `"tev1:4b"`, `temperature` number default `0`) in `src/config/schemas/agent.js`
- [x] 3.2 Add `decision` to `AgentSchema` so zod does not strip it
- [x] 3.3 Add the `agent.decision` block to `config.yaml` with an empty `baseUrl`

## 4. Write Tests

- [x] 4.1 Create `tests/unit/tools/decision.test.js` mocking `fetch` to `/v1/systemone`, covering the `choice`, `noul`, and `score` question types
- [x] 4.2 Cover the config-gating path (no `baseUrl` → tool not registered)

## 5. Verify

- [x] 5.1 Run `npm run test` and confirm all tests pass
- [x] 5.2 Run `npm run lint` and confirm no lint errors
- [x] 5.3 Run `npm run coverage` and confirm coverage is maintained
