## Context

The config loader (`src/config/loader.js`) currently parses `config.yaml`, deep-merges with Zod defaults, then calls `_resolveEnvRecursively()` to override leaf values from environment variables. The recursive resolver only iterates keys that already exist in the parsed YAML tree — env vars defining new config paths are never consulted. This makes env vars a second-class config source.

The Zod schema (`ConfigSchema` in `src/config/config.js`) defines the full shape of the config object, including 15 top-level sections: `providers`, `email`, `calendar`, `sandbox`, `search`, `memory`, `telemetry`, `schedules`, `tui`, `agent`, `lru`, `persistence`, `skillAgentMap`, `subAgentsTemperature`, `vector`. Each section has its own schema (e.g., `VectorConfigSchema` in `schemas/vector.js`).

The existing `_resolveEnvRecursively()` uses a `DROPPED_KEYS` list to filter container keys (providers, credentials, ratelimit, timeout, search, process, calendar, subAgentsTemperature) from env-var paths. The `"subAgentsTemperature"` entry is dead code because the filter uses `p.toLowerCase()` but the entry is mixed-case.

## Goals / Non-Goals

**Goals:**
- Implement `syncEnv()` that scans `process.env` for keys matching known config section prefixes and materializes missing config structure (objects, arrays) into the raw config object
- Build a schema-driven reverse mapping by introspecting `ConfigSchema` to enumerate valid config paths and generate their env-var names
- Add `applyDotPath()` helper to materialize intermediate objects/arrays from dot-paths
- Wire `syncEnv()` into `loadConfig()` between the YAML deepMerge and `_resolveEnvRecursively()`
- Fix dead `"subAgentsTemperature"` entry in DROPPED_KEYS to lowercase `"subagentstemperature"`
- Add unit tests and integration tests

**Non-Goals:**
- Not modifying the existing `_resolveEnvRecursively()` logic or DROPPED_KEYS semantics (except the dead-entry fix)
- Not adding lazy loading or refresh mechanisms for the module-level config cache
- Not changing the Zod schemas themselves

## Decisions

1. **Schema-driven reverse mapping over convention-based**: Walking the Zod schema to enumerate valid config paths and generate their env-var names solves the kebab-case/camelCase ambiguity. The reverse lookup maps `OPENAI_API_KEY` → `providers.openai.credentials.apiKey` directly, without needing to re-derive the skip logic.

2. **Prefix allowlist**: Only consider env vars whose top-level segment matches a known config section (providers, email, calendar, sandbox, search, memory, telemetry, schedules, tui, agent, lru, persistence, skillAgentMap, subAgentsTemperature, vector). This prevents system vars from leaking into the config namespace.

3. **Array materialization via numeric suffixes**: Env vars with numeric suffixes (e.g., `VECTOR_PROJECTS_PROJECT_ALPHA_INCLUDE_0` through `_13`) are assembled into arrays. The `applyDotPath()` helper handles numeric segments by creating/extending arrays.

4. **Idempotent design**: `syncEnv()` only creates missing structure; never overrides existing YAML keys. This preserves the existing precedence: YAML > env vars.

5. **DROPPED_KEYS not re-implemented**: The `syncEnv()` implementation relies entirely on the schema-driven reverse mapping, which inherently knows the full config path including skipped containers. This keeps the skip words in one place (the existing `_resolveEnvRecursively`) and avoids a second source of truth.

6. **Dead entry fix**: Change `"subAgentsTemperature"` to `"subagentstemperature"` in DROPPED_KEYS so the filter actually matches.

## Risks / Trade-offs

- [Schema introspection performance] → Only done once at module load time, cached as a reverse map
- [Env var namespace pollution] → Prefix allowlist mitigates; unknown prefixes are silently ignored
- [Array index gaps] → If env vars define indices 0, 1, 3 (missing 2), the array will have a hole at index 2. This is acceptable — Zod validation will catch structural issues
- [Kebab-case ambiguity] → Schema-driven reverse mapping resolves this; no heuristic needed
