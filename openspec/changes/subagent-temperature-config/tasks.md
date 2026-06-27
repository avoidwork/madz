## 1. Config Schema Changes

- [ ] 1.1 Add `temperature` field to `process.subAgent` section in config.yaml with default value 0.7
- [ ] 1.2 Add temperature validation to config schema (must be number between 0 and 2)
- [ ] 1.3 Add JSDoc comments for the new config field

## 2. Config Loader Changes

- [ ] 2.1 Update config loader to read `process.subAgent.temperature` from config.yaml
- [ ] 2.2 Ensure temperature falls back to 0.7 when not configured
- [ ] 2.3 Add unit tests for config loading with temperature field

## 3. SubAgent Tool Changes

- [ ] 3.1 Add optional `temperature` parameter to subAgent tool input schema
- [ ] 3.2 Update `spawnSubAgentProcess()` to read temperature from config
- [ ] 3.3 Pass temperature to spawned process via `MADZ_SUBAGENT_TEMPERATURE` env var
- [ ] 3.4 Implement resolution hierarchy: per-call > env var > config default
- [ ] 3.5 Add JSDoc comments for the new parameter and updated function

## 4. Provider Changes

- [ ] 4.1 Update `createChatModel()` in src/provider/openai.js to check `MADZ_SUBAGENT_TEMPERATURE` env var
- [ ] 4.2 Override provider temperature when env var is set in spawned process
- [ ] 4.3 Ensure main process temperature is not affected by spawned process env var
- [ ] 4.4 Add unit tests for temperature override in spawned process

## 5. Testing

- [ ] 5.1 Add unit tests for config validation (valid values, invalid values, missing field)
- [ ] 5.2 Add unit tests for subAgent tool with temperature parameter
- [ ] 5.3 Add unit tests for temperature resolution hierarchy
- [ ] 5.4 Add integration tests for spawned process temperature override
- [ ] 5.5 Run full test suite and verify all tests pass
- [ ] 5.6 Verify 100% code coverage is maintained

## 6. Documentation

- [ ] 6.1 Update config.yaml comments to document the new temperature field
- [ ] 6.2 Update any relevant README or documentation files