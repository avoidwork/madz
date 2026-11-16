# Tasks

## 1. Config

- [x] 1.1 Add `silent: z.boolean().default(false)` to `AgentSchema` in `src/config/schemas/agent.js` and verify `AgentSchema.parse({})` yields `silent === false` and `AgentSchema.parse({ silent: true })` yields `silent === true` via the schema test
- [x] 1.2 Add `silent: false   # true = orchestrator stays silent except for final response` under the `agent:` block in `config.yaml` next to `sampling` and verify the config loads without error

## 2. Prompt Token

- [x] 2.1 Add a `<!-- SILENT_INSTRUCTION -->` token in the Delivery subsection of `DELIVERY & OUTPUT` in `prompts/SYSTEM_PROMPT.md`, near rule 3.1, as a standalone unnumbered block and verify the token is present in the file

## 3. Injection Logic

- [x] 3.1 In `src/memory/prompts.js`, define `SILENT_INSTRUCTION_TOKEN` and `SILENT_INSTRUCTION` constants and a `SILENT_SAMPLING_INSTRUCTION` constant (silent variant omitting the "tell the user" sentence) and verify they are exported/defined
- [x] 3.2 In `loadSystemPrompt()`, replace the `<!-- SILENT_INSTRUCTION -->` token with the directive when `config.agent.silent` is true and strip it when false, and select the silent sampling variant when `silent` is true; verify via the prompts unit tests

## 4. Tests

- [x] 4.1 Add unit tests to `tests/unit/memory/prompts.test.js` covering silent off (default, token stripped), silent on (directive injected), silent on + sampling on (silent sampling variant, no "tell the user" sentence), and silent off + sampling off (no sampling instruction); verify all pass
- [x] 4.2 Add schema tests to `tests/unit/config/schemas/agent.test.js` verifying `silent` defaults to `false` and accepts `true`; verify all pass

## Workflow follow-up

- Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes.
- Archive the change after the project's review requirements are satisfied.
