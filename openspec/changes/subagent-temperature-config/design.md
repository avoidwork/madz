## Context

SubAgents are spawned as separate `node index.js` processes that read their own config.yaml. Currently, temperature is configured only at the provider level (`providers.openai.temperature`) and cannot be adjusted per-subAgent or globally for subAgent invocations. The temperature parameter controls randomness in LLM outputs — lower for precise, deterministic tasks and higher for creative, exploratory work.

The existing pattern for subAgent configuration (timeout, maxConcurrent, sessionMode) uses environment variables passed from the parent process to the spawned child. Temperature should follow this same pattern.

## Goals / Non-Goals

**Goals:**
- Add global default temperature under `process.subAgent.temperature`
- Add per-skill temperature override under `process.subAgent.skills[].temperature`
- Pass temperature to spawned processes via `MADZ_SUBAGENT_TEMPERATURE` env var
- Override provider temperature in spawned processes when env var is set
- Add optional per-call `temperature` parameter to subAgent tool schema

**Non-Goals:**
- Runtime config reloading (temperature changes require restart)
- Temperature validation against specific LLM provider capabilities
- Per-message temperature overrides within a single subAgent session
- UI/CLI configuration interface

## Decisions

### Decision 1: Environment Variable over CLI Argument
**Choice:** Pass temperature via `MADZ_SUBAGENT_TEMPERATURE` environment variable.
**Rationale:** Follows the existing pattern used for timeout configuration. Keeps the spawned process invocation clean. CLI arguments would require modifying the node command line and parsing logic.
**Alternatives considered:**
- CLI argument: More explicit but requires command line modification and parsing
- Config file in temp directory: Overly complex for a single value
- stdin: Unnecessary overhead for a single configuration value

### Decision 2: Resolution Hierarchy
**Choice:** per-call > per-skill config > global config > env var > provider default
**Rationale:** Provides maximum flexibility while maintaining sensible defaults. Per-call override allows ad-hoc adjustments without config changes. Per-skill override allows skill-specific tuning. Global config provides a sensible default for all subAgents.
**Alternatives considered:**
- Config only: Less flexible, requires config changes for every adjustment
- Env var only: Not user-friendly, requires environment setup

### Decision 3: Graceful Degradation
**Choice:** Invalid temperature values fall back to provider default rather than crashing.
**Rationale:** Spawned processes may receive stale or corrupted env vars. Crashing would be worse than using a reasonable default. The parent process continues unaffected.
**Alternatives considered:**
- Hard fail: Safer but creates fragile spawned processes
- Log and continue: Added as optional low-priority enhancement

### Decision 4: Scoped Override
**Choice:** Temperature override only affects the spawned process.
**Rationale:** The parent process should continue using its configured temperature. This prevents unintended side effects and maintains process isolation.
**Alternatives considered:**
- Global override: Would affect all LLM calls in the parent process, unintended side effects

## Risks / Trade-offs

### Risk: Config Schema Validation
**Trade-off:** Adding new optional fields increases config complexity slightly.
**Mitigation:** Fields are optional, existing configs continue to work. Validation is straightforward (0-2 range).

### Risk: Env Var Parsing Errors
**Trade-off:** String-to-float conversion in spawned process may fail.
**Mitigation:** Graceful fallback to provider default. Parse with parseFloat, check isNaN, validate range.

### Risk: Concurrent SubAgent Interference
**Trade-off:** Multiple subAgents with different temperatures must not interfere.
**Mitigation:** Each spawned process has its own environment. Env vars are scoped to the child process only.

### Risk: Backward Compatibility
**Trade-off:** New config fields must not break existing deployments.
**Mitigation:** All fields are optional. Missing temperature falls through to provider default.

## Migration Plan

No migration required. The change is fully backward compatible:
1. Deploy the code change
2. Existing configs continue to work using provider defaults
3. Users can optionally add `temperature` to their config.yaml
4. No database migrations, no config file migrations

## Open Questions

- Should temperature be exposed in the TUI config editor? (Out of scope for this change)
- Should we log temperature overrides for debugging? (Low priority, can be added later)
- Are there LLM providers that don't support temperature? (Provider-specific handling can be added later)