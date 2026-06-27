## Why

Currently, subAgents are launched without configurable temperature, meaning their behavior is fixed by the default LLM settings. Users may want to adjust temperature per-subAgent or globally to control the randomness of their outputs — lower for precise, deterministic tasks and higher for creative, exploratory work.

## What Changes

- Add `temperature` field to `process.subAgent` in config.yaml with a default value of 0.7
- Pass temperature to spawned subAgent processes via `MADZ_SUBAGENT_TEMPERATURE` environment variable
- Override provider temperature in spawned processes when env var is set
- Add optional per-call `temperature` parameter to the subAgent tool schema
- Follow the same resolution hierarchy as timeout: per-call > env var > config default > provider default

## Capabilities

### New Capabilities
- `subagent-temperature`: Configure temperature parameter for subAgents via config.yaml and per-call override

### Modified Capabilities
<!-- None — this is a new capability, not a modification of existing spec requirements -->

## Impact

- `config.yaml` — Add `process.subAgent.temperature` field
- `src/config/schemas.js` — Add validation for temperature (0-2 range)
- `src/config/loader.js` — Read temperature from config
- `src/tools/subAgent.js` — Pass temperature via env var, add per-call override to tool schema
- `src/provider/openai.js` — Override temperature from env var in spawned process