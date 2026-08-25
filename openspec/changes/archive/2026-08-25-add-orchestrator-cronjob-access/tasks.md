## 1. Update ORCHESTRATOR_TOOLS array

- [x] 1.1 Add "cronJob" to ORCHESTRATOR_TOOLS array in src/tools/index.js (line ~161)
- [x] 1.2 Verify the array remains alphabetically ordered or follows existing convention

## 2. Update TOOL_CLASSIFICATIONS

- [x] 2.1 Add "orchestrator" to the cronJob classification in TOOL_CLASSIFICATIONS (line 81)
- [x] 2.2 Verify the classification array follows existing convention (alphabetical order)

## 3. Update README.md

- [x] 3.1 Update the Built-in Tools table in README.md to show orchestrator has access to cronJob
- [x] 3.2 Verify the table formatting is consistent with existing entries

## 4. Write unit tests

- [x] 4.1 Create tests/unit/tools_orchestrator.test.js
- [x] 4.2 Test that "cronJob" is included in ORCHESTRATOR_TOOLS array
- [x] 4.3 Test that "orchestrator" is included in cronJob's TOOL_CLASSIFICATIONS entry
- [x] 4.4 Test that getToolsForAgentTypes returns cronJob when orchestrator type is queried

## 5. Verify

- [x] 5.1 Run npm run test and verify all tests pass
- [x] 5.2 Run npm run lint and fix any lint errors
- [x] 5.3 Run npm run coverage and verify coverage is maintained
