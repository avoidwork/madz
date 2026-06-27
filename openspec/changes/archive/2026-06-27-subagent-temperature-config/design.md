## Context

SubAgents are spawned as separate `node index.js` processes. Each subAgent is a full madz instance that reads its own config.yaml. Currently, the temperature parameter is configured at `providers.openai.temperature` and is not configurable per subAgent. Users want to control the randomness of subAgent outputs independently of the main process settings.

The existing pattern for subAgent configuration is in `process.subAgent` in config.yaml, which includes `timeout`, `maxConcurrent`, `sessionMode`, `defaultStrategy`, and `defaultOnError`. The temperature field should follow this same pattern.

## Goals / Non-Goals

**Goals:**
- Add `temperature` field to `process.subAgent` in config.yaml with a default value of 0.7
- Pass temperature to spawned subAgent processes via `MADZ_SUBAGENT_TEMPERATURE` environment variable
- Override provider temperature in spawned processes when env var is set
- Add optional per-call `temperature` parameter to the subAgent tool schema
- Follow the same resolution hierarchy as timeout: per-call > env var > config default > provider default

**Non-Goals:**
- Per-skill temperature overrides in config.yaml (out of scope for this iteration)
- Modifying the main process temperature
- CLI argument passing for temperature
- Per-skill temperature overrides in skill definitions

## Decisions

### Decision 1: Environment variable over CLI arguments
**Choice:** Use `MADZ_SUBAGENT_TEMPERATURE` env var to pass temperature to spawned processes.
**Rationale:** Keeps the spawn command simple and consistent with how other subAgent config (like timeout) is passed. CLI arguments would require parsing and validation in the spawned process.
**Alternatives considered:**
- CLI argument: More complex, requires parsing in spawned process
- Config file in temp directory: Unnecessary complexity, env var is sufficient

### Decision 2: No per-skill overrides in config.yaml
**Choice:** Only global `process.subAgent.temperature` in config.yaml, no per-skill overrides.
**Rationale:** Keeps the scope focused and avoids complicating the config schema. Per-skill overrides could be added later if needed. The per-call override via tool parameter provides sufficient flexibility for most use cases.
**Alternatives considered:**
- Per-skill overrides in config.yaml: More complex schema, requires nested config structure
- Per-skill overrides in skill definitions: Would require modifying each skill file, less flexible

### Decision 3: OpenAI spec compliance
**Choice:** Validate temperature values to be between 0 and 2, following OpenAI's API specification.
**Rationale:** Ensures compatibility with OpenAI's API and prevents invalid values from being passed to the LLM.
**Alternatives considered:**
- Wider range (0-1): More restrictive, doesn't support all OpenAI features
- No validation: Risk of invalid values being passed to the LLM

### Decision 4: Resolution hierarchy
**Choice:** Per-call > env var > config default > provider default.
**Rationale:** Consistent with existing subAgent behavior (timeout resolution) and easy to understand. Provides maximum flexibility from most specific (per-call) to least specific (provider default).
**Alternatives considered:**
- Env var > per-call: Less flexible, doesn't allow per-call overrides
- Config default > env var: Less flexible, doesn't allow process-level overrides

## Risks / Trade-offs

### Risk: Invalid temperature values
**Mitigation:** Validate temperature values at config load time (0-2 range). Reject invalid values with a clear error message.

### Risk: Backward compatibility
**Mitigation:** The temperature field is optional in config.yaml. If not set, the default value of 0.7 is used. Existing configs without the field will continue to work.

### Risk: Multiple subAgents with different temperatures
**Mitigation:** Each spawned process has its own environment, so different subAgents can have different temperatures via the per-call override.

## Migration Plan

This change is backward compatible. Existing configs without the `temperature` field will continue to work with the default value of 0.7. No migration is required.

## Open Questions

- Should per-skill temperature overrides be added in a future iteration?
- Should the temperature range be configurable (e.g., for non-OpenAI providers)?