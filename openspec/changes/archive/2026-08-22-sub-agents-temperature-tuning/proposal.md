## Why

Currently all sub-agents share the same provider-level temperature (0.4 for OpenAI). This doesn't account for the different roles agents play — a code-review agent should be deterministic and precise (low temperature), while a research agent should be creative (higher temperature). Per-agent temperature tuning lets operators calibrate agent behavior to their specific role, reducing hallucination in critical tasks and enabling more creative exploration where appropriate.

## What Changes

- Add a new `subAgentsTemperature` config section as a flat record of agent name → temperature value (number 0–2)
- Add Zod schema validation for the new config section
- Add environment variable resolution support (e.g., `SUB_AGENTS_TEMPERATURE_CODING=0.3`)
- Add accessor utility `getSubAgentTemperature(agentName)` to read per-agent temperature
- Modify subagent model creation to use per-agent temperature when configured
- Default `{}` means no override — agents use provider/model default

## Capabilities

### New Capabilities

- **sub-agents-temperature**: Per-agent temperature configuration and resolution, allowing operators to set temperature values (0–2) for each sub-agent type via config.yaml or environment variables.

### Modified Capabilities

- **config-system**: Adds `subAgentsTemperature` section to the config schema and loader, extending the existing config system with a new top-level section.
- **subagent**: Subagent model instantiation now supports per-agent temperature overrides instead of sharing a single model instance.

## Impact

- `src/config/schemas/subAgentsTemperature.js` — New schema file
- `src/config/schemas/index.js` — Export new schema
- `src/config/config.js` — Add to ConfigSchema, add accessor function
- `src/config/loader.js` — Add to DROPPED_KEYS, handle hyphens in path segments
- `src/agent/deepAgents.js` — Modify createSubagentDefinitions for per-agent models
- `tests/unit/config-subAgentsTemperature.test.js` — New test file

## Non-goals

- Global temperature override for all sub-agents (would be a single value, not per-agent)
- Temperature configuration for the orchestrator agent itself
- Template-based temperature in skill definitions
- Hardcoded temperature defaults in code