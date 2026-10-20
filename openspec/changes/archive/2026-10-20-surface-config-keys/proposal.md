## Why

An audit (`memory/context/config_yaml_dead_keys_audit.md`, Tier 3) found five config keys that live code reads yet are absent from `config.yaml`. These knobs already work via code fallbacks but are undiscoverable and unconfigurable through the single source of truth. Surfacing them makes the behavior explicit and lets users override via env vars.

## What Changes

- Add `calendar.active` to `config.yaml` with its current effective default (`|| "google"` at `src/tools/calendar/providers/factory.js:18`), making the msgraph provider selectable.
- Add `providers.fal` to `config.yaml` as a documented optional backend (gates `generateImage` registration at `src/tools/index.js:329,411`). It is commented-out/documented rather than an empty stub that implies it is configured.
- Add `memory.maxEntries` to `config.yaml` with default 100 (fallback `config.memory.maxEntries || 100` at `src/tools/memory/index.js:300`).
- Add `tui.statusBar.project` to `config.yaml` (fallback `statusBar.project !== false` at `src/tui/statusBar.js:128`), allowing the project segment to be hidden.
- Add `schedules.logPath` to `config.yaml` (fallback `if (config.schedules.logPath)` at `index.js:68`).
- Add the matching field to the relevant Zod schema under `src/config/schemas/` for each key so env-var overrides resolve through `buildReverseMap()`.
- Do **NOT** add `sandbox.urlAllowlist` or `search.parallel` — the audit explicitly corrected these out.

## Capabilities

### New Capabilities
- `config-keys-surface`: Documents the five config keys that are read by code but were absent from `config.yaml`, their effective defaults, and the requirement that omitting any key preserves existing behavior.

### Modified Capabilities
- `config-system`: The `config.yaml` file gains five new keys with documented defaults, and the Zod schemas gain the matching fields so env-var overrides resolve.
- `env-config-materialization`: The schema-driven reverse map now includes the new keys (`calendar.active`, `memory.maxEntries`, `tui.statusBar.project`, `schedules.logPath`, `providers.fal`), so env vars can reach them.

## Impact

- `config.yaml` — five keys added.
- `src/config/schemas/memory.js` — add `maxEntries` to `MemorySchema`.
- `src/config/schemas/providers.js` — `CalendarConfigSchema.active` already exists; `ProvidersSchema` is passthrough so `providers.fal` passes through; no change needed beyond confirming.
- `src/config/schemas/tui.js` — `statusBar.project` already exists.
- `src/config/schemas/schedules.js` — `logPath` already exists.
- No runtime code behavior changes — all five keys already work via fallbacks; this change only surfaces them.
