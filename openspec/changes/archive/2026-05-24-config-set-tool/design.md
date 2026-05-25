## Context

The `:config set` TUI command currently delegates mutation to an inline closure `_setConfigValue` in `src/tui/app.js:58`, which calls `setConfigValue()` from `src/config/loader.js`. This function in turn uses private helpers `assignPath()` (dot-path assignment with intermediate object creation) and `parseValue()` (string-to-boolean/number coercion) along with `saveConfig()` (YAML serialization + write). All mutation logic lives buried in the config loader, making it hard to test independently and harder to reuse from other subsystems.

The project uses `js-yaml` for parsing/serialization and `zod` for schema validation. The config object is created once at boot in `index.js` via `loadConfig()`, then mutated in place via `setConfigValue()`. The TUI passes only a function reference, not the config object itself, through command context.

## Goals / Non-Goals

**Goals:**
- Extract config mutation logic into a self-contained `src/config/mutate.js` module with a clean public API.
- The mutator receives the config object as a parameter (not a closure), making it testable with any config snapshot.
- Preserve backward compatibility: `loader.js` re-exports `setConfigValue()` for `index.js`.
- No change to TUI command parsing or user-facing behavior.

**Non-Goals:**
- Adding new config keys, sections, or schema changes.
- Changing the YAML serialization format or comment preservation.
- Adding undo/rollback for config mutations.
- Multi-file config support.

## Decisions

### Decision 1: Module structure — one file, focused exports
**Choice**: `src/config/mutate.js` exports `setConfigValueAt(config, dotPath, valueStr)` as the primary public API, plus `parseValue(str)`, `assignPath(patched, dotPath, value)`, and `loadConfigAtPath()` for internal/test use.
**Rationale**: Keeps the module boundary clean. The primary function encapsulates the full pipeline (parse → assign → validate → save). `loadConfigAtPath()` is an optional convenience for tools that want to operate on a fresh file read.
**Alternatives**: A class-based approach (`class ConfigMutator`) with `mutate()` method. Rejected — adds unnecessary boilerplate for a stateless pipeline.

### Decision 2: Keep `setConfigValue` as a re-export in `loader.js`
**Choice**: `loader.js` imports from `mutate.js` and re-exports `setConfigValue` under the original name.
**Rationale**: `index.js:205` already `export { setConfigValue, ... }`. Changing the export name would cascade through `app.js` and tests. A re-export preserves the API contract.

### Decision 3: The mutator validates before saving
**Choice**: `setConfigValueAt()` clones the config, applies mutation, validates the clone with zod, then applies the mutation to the original config and saves to disk.
**Rationale**: This is the existing behavior — validation happens on a `structuredClone()` before touching the live config. Repeating this pattern ensures consistency and prevents writing invalid YAML.

### Decision 4: YAML dump with options to preserve readability
**Choice**: Use `yaml.dump(config, { lineWidth: 80, noRefs: true })` in `saveConfig()`.
**Rationale**: `noRefs: true` prevents `*id &id` YAML references that make the file hard to edit manually. `lineWidth: 80` keeps the file readable.

## Risks / Trade-offs

### Risk: YAML comment loss on save
The `yaml.dump()` from `js-yaml` does not preserve comments by default. Every `:config set` will strip comments from `config.yaml`.
**Mitigation**: Acceptable — this is the current behavior, not a regression. Users who add comments should expect them to be overwritten on mutation. No change in this PR.

### Risk: Circular imports if mutate.js imports from loader.js
If `mutate.js` imports `loadConfig()` from `loader.js` (to auto-read the file), we risk circular `import` dependencies.
**Mitigation**: The mutator receives `config` as a parameter rather than reading from disk. `loadConfigAtPath()` is optional and only for convenience. Keep the pipe: parse → assign → validate → save.

### Risk: 100% coverage gate fails with new module
Adding `mutate.js` introduces new functions that must be tested to maintain 100% coverage.
**Mitigation**: Tests are included as part of the task list (see tasks.md).
