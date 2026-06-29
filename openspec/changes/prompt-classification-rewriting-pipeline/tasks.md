## 1. Setup module structure

- [x] 1.1 Create `src/agent/promptPipeline/` directory with `index.js`, `prompts.js`, and `categories.js` files
- [x] 1.2 Define category enums in `categories.js`: intent (question, task, creative, analysis, other), domain (coding, writing, analysis, general, other), complexity (simple, moderate, complex)
- [x] 1.3 Add validation functions for category values in `categories.js`

## 2. Implement prompt classification module

- [x] 2.1 Create `classifyPrompt()` function in `index.js` that takes a raw prompt string and returns classification metadata
- [x] 2.2 Create classification prompt template in `prompts.js` that instructs the LLM to output intent, domain, and complexity
- [x] 2.3 Integrate LLM call within `classifyPrompt()` using existing LLM infrastructure
- [x] 2.4 Add error handling: return default metadata (intent="other", domain="general", complexity="moderate") on LLM failure
- [x] 2.5 Add JSDoc comments with `@param` and `@returns` for `classifyPrompt()`

## 3. Implement prompt rewriting module

- [ ] 3.1 Create `rewritePrompt()` function in `index.js` that takes a prompt string and classification metadata, returns rewritten prompt
- [ ] 3.2 Create rewriting prompt template in `prompts.js` that uses classification metadata to optimize the prompt structure
- [ ] 3.3 Integrate LLM call within `rewritePrompt()` using existing LLM infrastructure
- [ ] 3.4 Add error handling: return original prompt on LLM failure
- [ ] 3.5 Add JSDoc comments with `@param` and `@returns` for `rewritePrompt()`

## 4. Implement pipeline orchestrator

- [ ] 4.1 Create `processPrompt()` function that calls `classifyPrompt()` then `rewritePrompt()` sequentially
- [ ] 4.2 Ensure `processPrompt()` handles cascading failures (classification fails → use defaults → still attempt rewrite)
- [ ] 4.3 Add JSDoc comments with `@param` and `@returns` for `processPrompt()`
- [ ] 4.4 Export all public functions from `index.js`

## 5. Add configuration support

- [x] 5.1 Add `agent.promptRewrite.enabled` config flag (default: false) to config schema in `src/config/schemas.js`
- [x] 5.2 Update config loader in `src/config/loader.js` to accept and pass through new pipeline settings (handled via deepMerge + schema defaults)
- [x] 5.3 Add optional config keys for custom prompt templates (with fallback to defaults in `prompts.js`) — implemented as external files in `./prompts/` loaded by intent
- [x] 5.4 Ensure config changes are validated and backward compatible

## 6. Integrate pipeline into agent flow

- [ ] 6.1 Modify `callReactAgent()` in `src/agent/react.js` to import and call `processPrompt()` before `HumanMessage` construction
- [ ] 6.2 Gate pipeline execution behind `config.agent.promptRewrite.enabled` check
- [ ] 6.3 When pipeline is disabled, pass raw input through unchanged (no behavioral change)
- [ ] 6.4 Ensure the agent graph receives the same `HumanMessage` format regardless of pipeline state

## 7. Write unit tests

- [ ] 7.1 Create `tests/unit/promptPipeline.test.js` with tests for `classifyPrompt()`
- [ ] 7.2 Test valid classification for each intent/domain/complexity combination
- [ ] 7.3 Test classification error fallback to default metadata
- [ ] 7.4 Create tests for `rewritePrompt()` with valid and error cases
- [ ] 7.5 Create tests for `processPrompt()` orchestrator including cascading failure scenarios
- [ ] 7.6 Create tests for config schema validation of new pipeline settings
- [ ] 7.7 Mock LLM calls in all tests — no real API calls

## 8. Verify and commit

- [ ] 8.1 Run `npm run test` and verify all tests pass
- [ ] 8.2 Run `npm run lint` and verify no lint errors
- [ ] 8.3 Run `npm run coverage` and verify 100% coverage is maintained
- [ ] 8.4 Verify application starts with `timeout 10 npm start`
- [ ] 8.5 Commit changes with conventional commit format
- [ ] 8.6 Push branch and create PR targeting main