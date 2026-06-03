## 1. Config schema and defaults

- [ ] 1.1 Add `memory.ephemeral` section to `MemorySchema` in `src/config/schemas.js` with `ttlDays` (number, default 7) and `maxEntries` (number, default 10)
- [ ] 1.2 Add `memory.ephemeral` default values to `DEFAULT_CONFIG` in `src/config/schemas.js`

## 2. Sampling tool implementation

- [ ] 2.1 Create `src/tools/sampling.js` with `writeEphemeralMemory` function that writes `ephemeral: true` frontmatter files to `memory/context/`
- [ ] 2.2 Implement expiration calculation: `createdDate + ttlDays` rounded up to next midnight in system timezone
- [ ] 2.3 Implement rate limiting: 60-minute cooldown between writes using per-instance closure timestamp
- [ ] 2.4 Implement capacity check: count current `ephemeral: true` files, reject if at or above `maxEntries`
- [ ] 2.5 Create Zod schema for the sampling tool input (single `content` string field, required)
- [ ] 2.6 Export `createSamplingTool` factory function that creates a LangChain tool with runtime options (contextDir, ttlDays, maxEntries, cooldownMs)
- [ ] 2.7 Export `samplingImpl` for testing

## 3. Tool registration

- [ ] 3.1 Add `sampling` entry to `TOOL_PERMISSIONS` in `src/tools/index.js` with empty permissions (no permission required, like `clarify`)
- [ ] 3.2 Add `sampling: createSamplingTool` to `TOOL_FACTORIES` map in `src/tools/index.js`
- [ ] 3.3 Add `sampling` case to `buildToolConfig` switch with `runtimeOptions` carrying `contextDir`, `ephemeralTtlDays`, `ephemeralMaxEntries`, `ephemeralCooldownMs`

## 4. Session-init cleanup

- [ ] 4.1 Create `src/memory/expireEphemeral.js` with `expireEphemeralMemories` function that reads all `.md` files in `memory/context/`, checks `ephemeral: true` and `expiresAt <= now`, unlinks expired files
- [ ] 4.2 Function must handle missing directory gracefully (return void, no error)
- [ ] 4.3 Export `expireEphemeralMemories` from `src/memory/index.js` barrel
- [ ] 4.4 Wire cleanup into `index.js`: import `expireEphemeralMemories`, call via `queueMicrotask()` after `createSession()` and tool config, pass `config.memory.contextDir`
- [ ] 4.5 Cleanup must be fire-and-forget: wrap in try/catch, swallow errors, not block session init

## 5. Tests

- [ ] 5.1 Create `tests/unit/tools_sampling.test.js` with tests for `writeEphemeralMemory` (writes file with correct frontmatter, includes proper expiration date)
- [ ] 5.2 Add tests for rate limiting (rejects within cooldown, succeeds after cooldown)
- [ ] 5.3 Add tests for capacity limit (rejects at capacity, succeeds with room)
- [ ] 5.4 Add tests for `expireEphemeralMemories` (deletes expired files, preserves non-expired ephemeral, preserves non-ephemeral, handles missing directory)
- [ ] 5.5 Add tests for config schema validation of `memory.ephemeral` section (valid defaults, override values)

## 6. Update existing test files

- [ ] 6.1 Add a sampling tool import + tool registration test in `tests/unit/tool_index.test.js` (or equivalent tool registration test)
- [ ] 6.2 Run `npm run test` to verify all tests pass
- [ ] 6.3 Run `npm run coverage` and verify 100% coverage is maintained
- [ ] 6.4 Run `npm run fix` to lint and format
