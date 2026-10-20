## 1. Schema Updates

- [x] 1.1 Add `maxEntries: z.number().int().positive().default(100)` to `MemorySchema` in `src/config/schemas/memory.js`
- [x] 1.2 Verify `calendar.active`, `tui.statusBar.project`, and `schedules.logPath` already exist in their respective schemas (no change needed)

## 2. config.yaml Updates

- [x] 2.1 Add `active: google` under `calendar:` in `config.yaml`
- [x] 2.2 Add a commented-out `providers.fal` block documenting the optional backend (with `type`, `model`, `credentials.apiKey`) that gates `generateImage`
- [x] 2.3 Add `maxEntries: 100` under `memory:` in `config.yaml`
- [x] 2.4 Add `project: true` under `tui.statusBar:` in `config.yaml`
- [x] 2.5 Add `logPath: ""` under `schedules:` in `config.yaml`

## 3. Tests

- [x] 3.1 Add a test asserting `buildReverseMap(ConfigSchema)` contains `MEMORY_MAX_ENTRIES` → `memory.maxEntries`
- [x] 3.2 Add a test asserting `syncEnv()` materializes `memory.maxEntries` from `MEMORY_MAX_ENTRIES`
- [x] 3.3 Add a test asserting `syncEnv()` materializes `calendar.active` from `CALENDAR_ACTIVE`
- [x] 3.4 Add a test asserting `syncEnv()` materializes `tui.statusBar.project` from `TUI_STATUS_BAR_PROJECT`
- [x] 3.5 Add a test asserting `syncEnv()` materializes `schedules.logPath` from `SCHEDULES_LOG_PATH`
- [x] 3.6 Add a test asserting `calendar.active: msgraph` selects `MsGraphProvider` via `getActiveCalendarProvider`

## 4. Verification

- [x] 4.1 Run `npm run test`
- [x] 4.2 Run `npm run lint`
- [x] 4.3 Run `npm run coverage`
