## Context

The config audit (`memory/context/config_yaml_dead_keys_audit.md`, Tier 3) identified five keys that live code reads but that are absent from `config.yaml`. Each already works through an inline fallback, so the behavior is correct today — but the knob is undiscoverable and cannot be overridden via env vars because the Zod schema does not expose it to `buildReverseMap()`.

The affected consumers:
- `calendar.active` → `src/tools/calendar/providers/factory.js:18` (`calendarConfig.active || "google"`)
- `providers.fal` → `src/tools/index.js:329,411` (`providers?.fal || {}` gates `generateImage`)
- `memory.maxEntries` → `src/tools/memory/index.js:300` (`config.memory.maxEntries || 100`)
- `tui.statusBar.project` → `src/tui/statusBar.js:128` (`statusBar.project !== false`)
- `schedules.logPath` → `index.js:68` (`if (config.schedules.logPath)`)

## Goals / Non-Goals

**Goals:**
- Surface all five keys in `config.yaml` with their current effective defaults.
- Add the matching field to the relevant Zod schema so env-var overrides resolve through `buildReverseMap()`.
- Preserve existing behavior when any key is omitted (fallbacks remain).
- Make `calendar.active: msgraph` observably select `MsGraphProvider`.

**Non-Goals:**
- Do **NOT** add `sandbox.urlAllowlist` or `search.parallel` — the audit explicitly corrected these out (nothing reads `config.sandbox.urlAllowlist`; `search.parallel` is read only into `runtimeOptions`, which is consumed at four sites that do not include it).
- No runtime code behavior changes — this is a discoverability/config-surface change only.
- No removal of dead keys (Tier 1/Tier 2) — that is out of scope for this issue.

## Decisions

**Decision 1: Add `calendar.active` to config.yaml with default `google`.**
The factory already falls back to `"google"`. Adding the key with `active: google` documents the default and, when set to `msgraph`, selects `MsGraphProvider`. `CalendarConfigSchema.active` already exists as `z.enum(["google", "msgraph"]).optional()`, so no schema change is needed — but the key must be present in YAML to be discoverable.

**Decision 2: Add `providers.fal` as a documented optional backend, not an empty stub.**
`ProvidersSchema` is `z.object({}).passthrough()`, so `providers.fal` passes through validation already. The issue explicitly requires it be commented-out or documented rather than an empty stub that implies it is configured. We add a commented-out block in `config.yaml` showing the shape (`type`, `model`, `credentials.apiKey`) so users know how to enable `generateImage`. No schema change needed (passthrough).

**Decision 3: Add `memory.maxEntries` to `MemorySchema` and config.yaml.**
`MemorySchema` currently lacks `maxEntries`. Add `maxEntries: z.number().int().positive().default(100)` so `buildReverseMap()` produces `MEMORY_MAX_ENTRIES` → `memory.maxEntries`. Add `maxEntries: 100` to config.yaml.

**Decision 4: `tui.statusBar.project` already exists in `TuiSchema`.**
`TuiSchema.statusBar` already has `project: z.boolean().default(true)`. Add `project: true` to config.yaml under `tui.statusBar`. No schema change needed.

**Decision 5: `schedules.logPath` already exists in `SchedulesSchema`.**
`SchedulesSchema` already has `logPath: z.string().optional()`. Add `logPath: ""` to config.yaml under `schedules`. No schema change needed.

**Decision 6: Env-var override resolution.**
For the keys that already exist in the schema (`calendar.active`, `tui.statusBar.project`, `schedules.logPath`), `buildReverseMap()` already produces the env-var mapping. For `memory.maxEntries`, adding the field to `MemorySchema` makes `MEMORY_MAX_ENTRIES` resolve. `providers.fal` is passthrough and not env-resolvable (it is a nested provider object), which is acceptable — it is documented as a YAML-only backend.

## Risks / Trade-offs

- **Risk: `providers.fal` as a commented block could be mistaken for an active config.** → Mitigation: comment it out with a clear `# Optional: enables generateImage` note; do not create an empty object that implies it is configured.
- **Risk: Adding `maxEntries` default of 100 could change behavior if the schema default differs from the code fallback.** → Mitigation: the code fallback is `config.memory.maxEntries || 100`, and the schema default is 100, so they match. Omitting the key yields identical behavior.
- **Risk: `calendar.active` enum could reject a future provider.** → Mitigation: the enum is `["google", "msgraph"]`, matching the two implemented providers. Adding a provider would require extending the enum, which is out of scope.
