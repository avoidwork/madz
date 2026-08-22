## Context

The madz harness uses LangChain ChatOpenAI models for both the orchestrator and sub-agents. Currently, temperature is set at the provider level via `providers.<name>.temperature` in `config.yaml` (default 0.4). All sub-agents (coding, search, debug, code-review, security-audit, testing, documentation, performance, research) inherit this single temperature value through the shared model instance created in `src/agent/deepAgents.js`.

Different agents have fundamentally different operational needs. A code-review agent should be deterministic and precise, while a research agent benefits from creative exploration. Without per-agent temperature control, operators must choose between a single compromise value or hardcoding agent-specific behavior.

## Goals / Non-Goals

**Goals:**
- Add a `subAgentsTemperature` config section as a flat record of agent name → temperature value (0–2)
- Support environment variable resolution following existing conventions (e.g., `SUB_AGENTS_TEMPERATURE_CODING=0.3`)
- Provide a `getSubAgentTemperature(agentName)` accessor utility
- Wire temperature into the sub-agent model creation layer in `deepAgents.js`
- Write unit tests for schema validation, env var resolution, and accessor function

**Non-Goals:**
- Global sub-agent temperature override (a single value for all agents)
- Template-based temperature in skill definitions
- Temperature mutation via TUI at runtime
- Support for orchestrator model temperature override

## Decisions

### Decision 1: Use Zod record schema for per-agent temperature
**Choice:** `z.record(z.string(), z.number().min(0).max(2))` with `.default({})`
**Rationale:** The existing provider temperature uses `z.number().min(0).max(2).default(0.4)` (providers.js:71). A record schema follows the same Zod pattern but maps agent names to values. Using `.default({})` means agents not listed in the config simply get `undefined` from the accessor, letting the model use its own default.

### Decision 2: Environment variable naming with hyphen-to-underscore conversion
**Choice:** `SUB_AGENTS_TEMPERATURE_CODE_REVIEW` for agent `code-review`
**Rationale:** The existing `_toUpperSnake` function in `loader.js` (line 20-32) converts camelCase to UPPER_SNAKE_CASE but does not handle hyphens. Since agent names like `code-review` contain hyphens, we need to replace hyphens with underscores before the snake_case conversion. This follows the principle that env var keys should only contain uppercase letters, digits, and underscores.

### Decision 3: Dropped key for env var resolution
**Choice:** Add `subAgentsTemperature` to the `DROPPED_KEYS` array in `_resolveEnvRecursively`
**Rationale:** Following the existing pattern (providers, credentials, calendar are all dropped), `subAgentsTemperature` should be dropped so that nested keys like `coding` become `SUB_AGENTS_TEMPERATURE_CODING` rather than `SUB_AGENTS_TEMPERATURE_SUB_AGENTS_TEMPERATURE_CODING`.

### Decision 4: Accessor function in config.js
**Choice:** Export `getSubAgentTemperature(agentName)` from `src/config/config.js`
**Rationale:** The accessor reads from the resolved config object. Since the config is loaded via `loadConfig()` in `loader.js`, the accessor needs to read from the resolved config. Placing it in `config.js` keeps it with the schema and DEFAULT_CONFIG, making it discoverable alongside the schema definition.

### Decision 5: Temperature passed at model creation, not at invocation
**Choice:** Create separate ChatOpenAI model instances per agent with different temperature values in `deepAgents.js`
**Rationale:** LangChain ChatOpenAI models are created once with their temperature at construction time. The temperature is not a runtime parameter on `generate()` or `invoke()` calls. Therefore, the temperature must be baked into the model instance when sub-agents are created in `createSubagentDefinitions()`.

## Risks / Trade-offs

### Risk: Model instance per agent increases memory
**Mitigation:** Each ChatOpenAI instance is lightweight — it's primarily a config object with no active connections. The memory overhead is negligible compared to the agent graph state.

### Risk: DeepAgents may override model temperature
**Mitigation:** The deepagents library accepts a model instance in the subagent definition. If deepagents overrides the temperature internally, we would need to verify behavior and potentially file an issue upstream. The model instance we pass has the temperature set at construction, which is the standard LangChain pattern.

### Risk: New agent definitions need temperature defaults
**Mitigation:** The accessor returns `undefined` for unlisted agents, which means the provider default applies. New agents don't need explicit temperature entries unless the operator wants to override the default.

## Migration Plan

This is a purely additive change:
1. Add new config section `subAgentsTemperature` — no existing config is affected
2. Add new schema file and export — no existing schemas change
3. Add `subAgentsTemperature` to DROPPED_KEYS — no existing env var resolution changes (the key is new)
4. Modify hyphen handling in `_toUpperSnake` — this is a bug fix that only affects paths containing hyphens; no existing paths use hyphens at the leaf level
5. Wire temperature into deepAgents.js — existing agents without temperature config get undefined, preserving current behavior

No migration of existing config files is needed. Users can optionally add `subAgentsTemperature` entries to `config.yaml` at their convenience.

## Open Questions

1. Should we document recommended temperature values in the config.yaml comment block?
2. Should the accessor validate that the agent name exists in the known agent list, or silently return undefined for unknown names? (Current plan: silently return undefined.)