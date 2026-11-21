# Tasks

## 1. Verify Registration

- [ ] 1.1 Verify the `poppy` tool is imported and registered in `src/tools/index.js` (imports, `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, `TOOLS`, and the `buildToolConfig` switch case) and confirm the registration is complete
- [ ] 1.2 Verify the `poppy` tool list is surfaced in subagent descriptions per AGENTS.md §7.2 in `src/agent/deepAgents.js`

## 2. Unit Registry Tests

- [ ] 2.1 Add `tests/unit/tools/poppy/registry.test.js` verifying `poppy` is present in `TOOL_PERMISSIONS` with `network:outbound`, in `TOOL_CLASSIFICATIONS` for the expected agent types, in `ORCHESTRATOR_TOOLS`, and in `TOOLS`, and verify the unit test passes
- [ ] 2.2 Add unit tests verifying `buildToolConfig()` registers the `poppy` tool only when `network:outbound` is enabled, and that it is absent when the permission is missing, and verify the unit test passes

## 3. Integration Registry Test

- [ ] 3.1 Add `tests/integration/tools/poppy/registry.test.js` verifying the orchestrator can invoke a Poppy tool via `buildToolConfig()` with `network:outbound` enabled, and that the tool is absent when the permission is disabled, and verify the integration test passes

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
