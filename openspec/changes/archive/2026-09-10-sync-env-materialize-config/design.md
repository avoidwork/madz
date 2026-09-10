## Context

The current config loader (`src/config/loader.js`) parses `config.yaml`, deep-merges with defaults, then calls `_resolveEnvRecursively()` to override leaf values from environment variables. However, `_resolveEnvRecursively()` only walks keys that already exist in the parsed tree — env vars defining paths not present in YAML are silently ignored. This makes env vars a second-class config source.

The existing `_resolveEnvRecursively()` uses a `DROPPED_KEYS` list (providers, credentials, ratelimit, timeout, search, process, calendar) that filters out structural container keys when constructing env-var names. Any `syncEnv()` implementation must account for these dropped segments when reverse-mapping env-var names back to config paths.

The Zod schema (`ConfigSchema` in `src/config/config.js`) defines the 15 top-level sections that form the prefix allowlist. Child schemas like `VectorProjectSchema` define the shape of materialized structures.

## Goals / Non-Goals

**Goals:**
- Implement `syncEnv()` that scans `process.env` for keys matching known config section prefixes and materializes missing structure into the raw config object
- Build a schema-driven reverse mapping from Zod schemas to resolve kebab-case/camelCase ambiguity
- Implement `applyDotPath()` helper for materializing intermediate objects/arrays
- Wire `syncEnv()` into `loadConfig()` between YAML deepMerge and `_resolveEnvRecursively()`
- Ensure idempotency — never override existing YAML keys
- Add unit and integration tests

**Non-Goals:**
- Changing the existing `_resolveEnvRecursively()` DROPPED_KEYS logic — `syncEnv()` relies on the schema-driven reverse mapping, not re-implemented skip logic
- Fixing the dead `subAgentsTemperature` entry in DROPPED_KEYS (flagged as separate concern)
- Module-level cache changes in `src/tools/codeIndex/index.js`
- Adding new npm dependencies

## Decisions

### Decision 1: Schema-driven reverse mapping over convention-based heuristics
**Choice:** Introspect Zod schemas to enumerate all valid config paths and generate their env-var names, building a reverse lookup map.

**Rationale:** Convention-based approaches (assuming all segments are kebab-case or camelCase) are fragile — ambiguous cases like `PROJECT_ALPHA` (could be `project-alpha` or `projectAlpha`) produce wrong paths. A static explicit mapping table requires manual updates when config sections change. The schema-driven approach inherently knows the full config path including DROPPED_KEYS containers, solving the reverse-mapping problem without re-implementing skip logic.

### Decision 2: `syncEnv()` does NOT re-implement DROPPED_KEYS
**Choice:** `syncEnv()` relies entirely on the schema-driven reverse mapping, which inherently knows the full config path including skipped containers.

**Rationale:** The DROPPED_KEYS skip logic is already implemented in `_resolveEnvRecursively()`. Re-implementing it in `syncEnv()` would create a second source of truth that could drift. The schema-driven reverse mapping naturally accounts for dropped segments because the schema encodes the full path (e.g., `providers.openai.credentials.apiKey`).

### Decision 3: `applyDotPath()` as a shared helper
**Choice:** Extract a standalone `applyDotPath()` function that takes a dot-path and value, and materializes intermediate objects/arrays in the raw config object.

**Rationale:** The existing `assignPath()` in `src/config/patch.js` has a MAX_PATH_DEPTH of 5 and doesn't handle array indices. `syncEnv()` needs to handle deeper paths (e.g., `vector.projects.myProject.include.0`) and numeric segments for array materialization. A dedicated helper keeps the logic focused and testable.

### Decision 4: Prefix allowlist from ConfigSchema top-level keys
**Choice:** Use the top-level keys of `ConfigSchema` as the prefix allowlist, filtering env vars to only those whose first segment matches a known section.

**Rationale:** This prevents system env vars (PATH, HOME, NODE_ENV, etc.) from leaking into the config namespace. The allowlist is derived automatically from the schema, so it stays in sync as config sections are added or removed.

## Risks / Trade-offs

- **[Risk] Schema introspection is fragile** — Zod schema shapes may change between versions. The reverse mapping walks `.shape` properties which is a Zod v4 API. → Mitigation: Keep the introspection logic isolated in a single function with clear error handling.
- **[Risk] Array index gaps** — Env vars like `VECTOR_PROJECTS_PROJECT_ALPHA_INCLUDE_0` and `_2` without `_1` could produce sparse arrays. → Mitigation: `applyDotPath()` fills gaps with `null` placeholders.
- **[Risk] Performance** — Scanning all of `process.env` and walking Zod schemas happens once at startup. → Mitigation: This is a one-time cost during `loadConfig()`, which is already called once at module init. The schema walk is cached in the reverse map.
- **[Risk] Ambiguous segment names** — Some env-var segments may map to multiple config paths. → Mitigation: The schema-driven reverse map is a `Map<envVarName, dotPath>` — if two schemas produce the same env-var name, the last one wins. This is acceptable because Zod schema validation will catch structural mismatches at the validateConfig() step.
