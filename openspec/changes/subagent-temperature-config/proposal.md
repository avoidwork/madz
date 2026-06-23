## Why

Currently, subAgents are launched without configurable temperature, meaning their behavior is fixed by the default LLM settings. Users may want to adjust temperature per-subAgent or globally to control the randomness of their outputs — lower for precise, deterministic tasks and higher for creative, exploratory work. This limits fine-grained control over subAgent behavior without needing to modify system prompts or skill definitions.

## What Changes

- Add `temperature` field to `process.subAgent` in config.yaml as a global default (0-2 range, OpenAI spec)
- Add `temperature` field to `process.subAgent.skills[].temperature` for per-skill overrides
- Pass temperature to spawned subAgent processes via `MADZ_SUBAGENT_TEMPERATURE` environment variable
- Override provider temperature in spawned processes when env var is set
- Add optional `temperature` parameter to subAgent tool schema for per-call overrides
- Follow resolution hierarchy: per-call > per-skill config > global config > env var > provider default

## Capabilities

### New Capabilities
- `subagent-temperature`: Configure temperature for subAgents via config.yaml with global default and per-skill override support

### Modified Capabilities
<!-- No existing capabilities have spec-level requirement changes -->

## Impact

- **Config:** `config.yaml` — new `process.subAgent.temperature` and `process.subAgent.skills[].temperature` fields
- **Tools:** `src/tools/subAgent.js` — `spawnSubAgentProcess()` passes temperature via env var; tool schema adds optional `temperature` parameter
- **Provider:** `src/provider/openai.js` — `createChatModel()` checks `MADZ_SUBAGENT_TEMPERATURE` env var and overrides provider temperature
- **Backward compatibility:** All changes are additive. Existing configs without temperature continue to work using provider defaults.