## 1. Update ORCHESTRATOR_TOOLS array

- [ ] 1.1 Add "cronJob" to ORCHESTRATOR_TOOLS array in src/tools/index.js (line ~161)
- [ ] 1.2 Verify the array remains alphabetically ordered or follows existing convention

## 2. Update TOOL_CLASSIFICATIONS

- [ ] 2.1 Add "orchestrator" to the cronJob classification in TOOL_CLASSIFICATIONS (line 81)
- [ ] 2.2 Verify the classification array follows existing convention (alphabetical order)

## 3. Update README.md

- [ ] 3.1 Update the Built-in Tools table in README.md to show orchestrator has access to cronJob
- [ ] 3.2 Verify the table formatting is consistent with existing entries

## 4. Write unit tests

- [ ] 4.1 Create tests/unit/tools_orchestrator.test.js
- [ ] 4.2 Test that "cronJob" is included in ORCHESTRATOR_TOOLS array
- [ ] 4.3 Test that "orchestrator" is included in cronJob's TOOL_CLASSIFICATIONS entry
- [ ] 4.4 Test that getToolsForAgentTypes returns cronJob when orchestrator type is queried

## 5. Verify

- [ ] 5.1 Run npm run test and verify all tests pass
- [ ] 5.2 Run npm run lint and fix any lint errors
- [ ] 5.3 Run npm run coverage and verify coverage is maintained
