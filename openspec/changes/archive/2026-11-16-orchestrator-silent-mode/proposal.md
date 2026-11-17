# Proposal

## Why

The deepAgents orchestrator narrates its work — intermediate commentary, progress updates, and tool narration — during a turn. In automated workflows, CI, or when the user only wants the final result, this chatter is noise. A `silent` mode lets the user suppress all mid-turn output and receive only the final answer.

## What Changes

- Add a `silent` boolean config option (default `false`) under the `agent:` block in `config.yaml`, validated by a new `silent: z.boolean().default(false)` field in `AgentSchema` (`src/config/schemas/agent.js`).
- Add a `<!-- RULE_31_INSTRUCTION -->` token as the body of rule 3.1 in the Delivery subsection of `DELIVERY & OUTPUT` in `prompts/SYSTEM_PROMPT.md`.
- In `loadSystemPrompt()` (`src/memory/prompts.js`), define a `RULE_31_TOKEN` constant plus `RULE_31_DEFAULT` and `RULE_31_SILENT` body constants. Swap the token for the default "Be concise" body when `config.agent.silent` is false, and for the silent directive when true.
- When `silent` is true, also inject a silent variant of the sampling instruction that omits the "briefly tell the user when you capture a memory" sentence — sampling still captures memories but does not announce them. When `silent` is false, inject the full sampling instruction as today.
- Scope: orchestrator only. The sole caller of `loadSystemPrompt()` is `createDeepAgentsOrchestrator()` in `src/agent/deepAgents.js`, which inherits the behavior automatically. Subagents report to the orchestrator, not the user, so they are untouched.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `system-prompt`: Add a requirement that `loadSystemPrompt` conditionally injects a silent-mode directive based on `agent.silent`, and that the silent sampling variant omits the "tell the user" announcement sentence.

## Impact

- `src/config/schemas/agent.js` — add `silent` field to `AgentSchema`.
- `config.yaml` — add `silent: false` under `agent:`.
- `prompts/SYSTEM_PROMPT.md` — add `<!-- RULE_31_INSTRUCTION -->` token as rule 3.1 body in Delivery subsection.
- `src/memory/prompts.js` — add `RULE_31_TOKEN`/`RULE_31_DEFAULT`/`RULE_31_SILENT` and swap logic in `loadSystemPrompt()`.
- `tests/unit/memory/prompts.test.js` — add silent on/off and silent sampling variant tests.
- `tests/unit/config/schemas/agent.test.js` — verify `silent` default and acceptance.
- No new dependencies; no runtime behavior change when `silent` is false (default).

## Non-goals

- No change to subagent prompt handling or subagent definitions.
- No runtime suppression logic in the orchestrator code — behavior is controlled via prompt directive only.
- No change to the sampling tool's capture behavior; only the announcement sentence is omitted when silent.
