## 1. Config Schema

- [ ] 1.1 Add `sampling: z.boolean().default(true)` to `AgentSchema` in `src/config/schemas/agent.js`

## 2. Tool Registration

- [ ] 2.1 Add `samplingEnabled` to `CONSUMED_RUNTIME_OPTION_KEYS` in `src/tools/index.js`
- [ ] 2.2 Add `samplingEnabled: config?.agent?.sampling !== false` to `runtimeOptions` in `buildToolConfig`
- [ ] 2.3 Move `sampling` out of the exempt `case "clarify"/"process"` branch into its own `case "sampling"` that checks `runtimeOptions.samplingEnabled`

## 3. System Prompt

- [ ] 3.1 Add `SAMPLING_TOOL_TOKEN` and `SAMPLING_TOOL_INSTRUCTION` constants in `src/memory/prompts.js`
- [ ] 3.2 Inject the sampling instruction conditionally in `loadSystemPrompt` based on `config?.agent?.sampling !== false`
- [ ] 3.3 Replace the static sampling block in `prompts/SYSTEM_PROMPT.md` with the `<!-- SAMPLING_TOOL_INSTRUCTION -->` token

## 4. Config File

- [ ] 4.1 Add `sampling: true` under `agent` in `config.yaml`

## 5. Tests

- [ ] 5.1 Add gating tests in `tests/unit/tool_index.test.js` (registers by default / when true / not when false)
- [ ] 5.2 Add token injection/removal tests in `tests/unit/prompts.test.js`

## 6. Verification

- [ ] 6.1 Run `npm test` — full suite passes
- [ ] 6.2 Run `npm run lint` — no warnings or errors
