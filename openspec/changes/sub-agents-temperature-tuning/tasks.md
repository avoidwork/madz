## 1. Create SubAgentsTemperature schema

- [x] 1.1 Create src/config/schemas/subAgentsTemperature.js with SubAgentsTemperatureSchema = z.record(z.string(), z.number().min(0).max(2))
- [x] 1.2 Export SubAgentsTemperatureSchema from src/config/schemas/index.js

## 2. Add subAgentsTemperature to root ConfigSchema

- [x] 2.1 Import SubAgentsTemperatureSchema in src/config/config.js
- [x] 2.2 Add subAgentsTemperature: SubAgentsTemperatureSchema.default({}) to ConfigSchema
- [x] 2.3 Export getSubAgentTemperature(agentName) function that reads from the resolved config and returns the temperature or undefined

## 3. Add env var resolution support

- [x] 3.1 Add 'subAgentsTemperature' to the DROPPED_KEYS array in _resolveEnvRecursively in src/config/loader.js
- [x] 3.2 Modify _toUpperSnake in src/config/loader.js to convert hyphens to underscores before the snake_case conversion, so agent names like code-review resolve to CODE_REVIEW env vars

## 4. Wire temperature into deepAgents sub-agent model creation

- [x] 4.1 In src/agent/deepAgents.js, modify createSubagentDefinitions to read temperature from config.subAgentsTemperature[agentDef.name]
- [x] 4.2 Create per-agent model instances with the appropriate temperature when config.subAgentsTemperature[agentName] is defined
- [x] 4.3 For agents not listed in subAgentsTemperature, pass undefined for temperature (letting the model use its default)

## 5. Write unit tests

- [x] 5.1 Create tests/unit/config-subAgentsTemperature.test.js — test schema validation for valid temperatures (0–2), invalid temperatures (out of range, non-numeric), and empty config
- [x] 5.2 Test env var resolution — verify that SUB_AGENTS_TEMPERATURE_CODING=0.3 correctly populates subAgentsTemperature.coding
- [x] 5.3 Test hyphenated agent name env var — verify that SUB_AGENTS_TEMPERATURE_CODE_REVIEW=0.1 correctly populates subAgentsTemperature['code-review']
- [x] 5.4 Test getSubAgentTemperature accessor — verify correct value returned for listed agents, undefined for unlisted agents, and undefined for empty string

## 6. Verify and test

- [x] 6.1 Run npm run test to confirm all tests pass
- [x] 6.2 Run npm run lint to confirm no lint errors
- [x] 6.3 Run npm run coverage to confirm coverage is maintained
- [x] 6.4 Run timeout 10 npm start to verify application starts without crashing