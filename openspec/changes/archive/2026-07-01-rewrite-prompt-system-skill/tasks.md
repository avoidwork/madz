## 1. Create Skill Directory Structure

- [ ] 1.1 Create `system-skills/rewrite-prompt/` directory
- [ ] 1.2 Create `system-skills/rewrite-prompt/scripts/` directory

## 2. Create SKILL.md

- [ ] 2.1 Write YAML frontmatter with name, description, permissions (filesystem:read, process:spawn), and compatibility
- [ ] 2.2 Write SKILL.md body with clear instructions for prompt rewriting: analyze intent, identify missing context, restructure, preserve original intent
- [ ] 2.3 Include guidance on handling edge cases (empty input, already-structured prompts, very long prompts)

## 3. Implement Rewrite Script

- [ ] 3.1 Create `scripts/rewrite-prompt.js` with JSDoc comments on all public functions
- [ ] 3.2 Implement prompt input handling (stdin and file argument)
- [ ] 3.3 Implement intent analysis to identify user's core request
- [ ] 3.4 Implement context gap detection (missing environment, constraints, format expectations)
- [ ] 3.5 Implement restructuring logic (context → task → constraints → output format)
- [ ] 3.6 Implement intent preservation check to ensure semantic equivalence
- [ ] 3.7 Implement edge case handling (empty input, already-structured, very long prompts)

## 4. Add Tests

- [ ] 4.1 Create `tests/unit/rewrite-prompt.test.js`
- [ ] 4.2 Test empty/whitespace input returns error
- [ ] 4.3 Test vague prompt is rewritten with added context
- [ ] 4.4 Test unstructured prompt is restructured into clear format
- [ ] 4.5 Test already-structured prompt is minimally modified
- [ ] 4.6 Test very long prompt is processed without truncation
- [ ] 4.7 Test intent preservation — rewritten prompt matches original intent

## 5. Verify and Commit

- [ ] 5.1 Run `npm run test` and verify all tests pass
- [ ] 5.2 Run `npm run lint` and verify no lint errors
- [ ] 5.3 Run `npm run coverage` and verify coverage is maintained
- [ ] 5.4 Verify application starts: `timeout 10 npm start 2>&1 || true`
- [ ] 5.5 Stage all changes and commit with conventional commit format
- [ ] 5.6 Push branch and create PR targeting main