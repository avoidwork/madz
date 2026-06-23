## 1. Config Schema Updates

- [ ] 1.1 Add `temperature` field to `process.subAgent` section in config.yaml with default value 0.7
- [ ] 1.2 Add `temperature` field to `process.subAgent.skills[].temperature` for per-skill overrides
- [ ] 1.3 Add config validation for temperature range (0-2) and type (float)
- [ ] 1.4 Add config validation tests for valid, invalid, and missing temperature values

## 2. SubAgent Process Temperature Propagation

- [ ] 2.1 Read resolved temperature in `spawnSubAgentProcess()` following hierarchy: per-call > per-skill > global > provider default
- [ ] 2.2 Pass temperature to spawned process via `MADZ_SUBAGENT_TEMPERATURE` environment variable
- [ ] 2.3 Only set env var when temperature is explicitly configured (not when using provider default)
- [ ] 2.4 Add tests for temperature env var propagation with various config scenarios

## 3. Provider Temperature Override in Spawned Process

- [ ] 3.1 Check `MADZ_SUBAGENT_TEMPERATURE` env var in `createChatModel()` in src/provider/openai.js
- [ ] 3.2 Parse env var as float and validate range (0-2)
- [ ] 3.3 Override provider temperature when env var is set and valid
- [ ] 3.4 Fall back to provider default when env var is invalid, empty, or missing
- [ ] 3.5 Ensure parent process temperature remains unchanged (scoped override)
- [ ] 3.6 Add tests for provider temperature override with valid, invalid, and missing env vars

## 4. Per-Call Temperature Override

- [ ] 4.1 Add optional `temperature` parameter to subAgent tool schema
- [ ] 4.2 Validate per-call temperature range (0-2)
- [ ] 4.3 Pass per-call temperature to spawned process (overrides env var and config)
- [ ] 4.4 Add tests for per-call temperature override scenarios

## 5. Integration and Verification

- [ ] 5.1 Verify resolution hierarchy: per-call > per-skill > global > provider default
- [ ] 5.2 Verify concurrent subAgents with different temperatures don't interfere
- [ ] 5.3 Run full test suite and verify all tests pass
- [ ] 5.4 Run lint and verify no lint errors
- [ ] 5.5 Verify application starts without crashing