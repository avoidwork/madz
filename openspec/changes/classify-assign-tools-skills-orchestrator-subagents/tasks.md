## 1. Add Tool Classification Map

- [ ] 1.1 Define `TOOL_CLASSIFICATIONS` map in `src/tools/index.js` with all 16 tools classified as orchestrator, subagent, or shared
- [ ] 1.2 Add code comments explaining the classification rationale for each tool
- [ ] 1.3 Verify all tools in `TOOL_FACTORIES` have a corresponding entry in `TOOL_CLASSIFICATIONS`

## 2. Modify `buildToolConfig()` to Support Classification Filtering

- [ ] 2.1 Add optional `classificationFilter` parameter to `buildToolConfig()` function signature
- [ ] 2.2 Implement filtering logic that excludes tools not matching the classification filter
- [ ] 2.3 Ensure backward compatibility — when `classificationFilter` is not provided, all tools are included
- [ ] 2.4 Add JSDoc documentation for the new parameter

## 3. Update `deepAgents.js` for Agent-Specific Tool Assignment

- [ ] 3.1 Modify `createDeepAgentsOrchestrator()` to call `buildToolConfig()` twice — once for orchestrator with `['orchestrator', 'shared']` filter, once for codingSubAgent with `['subagent', 'shared']` filter
- [ ] 3.2 Update codingSubAgent to receive the filtered subagent tool set instead of the full `tools` object
- [ ] 3.3 Update orchestrator to receive the filtered orchestrator tool set instead of the full `tools` object
- [ ] 3.4 Remove the shared `const tools` variable and replace with agent-specific tool variables

## 4. Filter Skill Paths by Agent Type

- [ ] 4.1 Create a skill classification mechanism — either a classification map or a filter function
- [ ] 4.2 Assign skill paths to the codingSubAgent (all skills)
- [ ] 4.3 Assign filtered skill paths to the orchestrator (orchestrator-classified and shared skills only)
- [ ] 4.4 Update the `createDeepAgent()` call to use agent-specific skill paths

## 5. Update Documentation

- [ ] 5.1 Update `docs/OVERVIEW.md` to document the new tool classification architecture
- [ ] 5.2 Add inline comments in `deepAgents.js` explaining the classification-based assignment
- [ ] 5.3 Document the classification system in `src/tools/index.js`

## 6. Verify and Test

- [ ] 6.1 Verify orchestrator does NOT have subagent-only tools (terminal, process, executeCode, todo, etc.)
- [ ] 6.2 Verify codingSubAgent has all subagent tools needed for execution
- [ ] 6.3 Verify both agents have shared tools (clarify, date, etc.)
- [ ] 6.4 Run `npm run lint` to ensure no lint errors
- [ ] 6.5 Run `npm run test` to ensure all tests pass
- [ ] 6.6 Run `npm start` to verify application starts without crashing