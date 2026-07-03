## 1. Add Tool Classification Map

- [x] 1.1 Define `TOOL_CLASSIFICATIONS` map in `src/tools/index.js` with all 16 tools classified as orchestrator, subagent, or shared
- [x] 1.2 Add code comments explaining the classification rationale for each tool
- [x] 1.3 Verify all tools in `TOOL_FACTORIES` have a corresponding entry in `TOOL_CLASSIFICATIONS`

## 2. Modify `buildToolConfig()` to Support Classification Filtering

- [x] 2.1 Add optional `classificationFilter` parameter to `buildToolConfig()` function signature
- [x] 2.2 Implement filtering logic that excludes tools not matching the classification filter
- [x] 2.3 Ensure backward compatibility — when `classificationFilter` is not provided, all tools are included
- [x] 2.4 Add JSDoc documentation for the new parameter

## 3. Update `deepAgents.js` for Agent-Specific Tool Assignment

- [x] 3.1 Modify `createDeepAgentsOrchestrator()` to call `buildToolConfig()` twice — once for orchestrator with `['orchestrator', 'shared']` filter, once for codingSubAgent with `['subagent', 'shared']` filter
- [x] 3.2 Update codingSubAgent to receive the filtered subagent tool set instead of the full `tools` object
- [x] 3.3 Update orchestrator to receive the filtered orchestrator tool set instead of the full `tools` object
- [x] 3.4 Remove the shared `const tools` variable and replace with agent-specific tool variables

## 4. Filter Skill Paths by Agent Type

- [x] 4.1 Create a skill classification mechanism — either a classification map or a filter function
- [x] 4.2 Assign skill paths to the codingSubAgent (all skills)
- [x] 4.3 Assign filtered skill paths to the orchestrator (orchestrator-classified and shared skills only)
- [x] 4.4 Update the `createDeepAgent()` call to use agent-specific skill paths

## 5. Update Documentation

- [x] 5.1 Update `docs/OVERVIEW.md` to document the new tool classification architecture
- [x] 5.2 Add inline comments in `deepAgents.js` explaining the classification-based assignment
- [x] 5.3 Document the classification system in `src/tools/index.js`

## 6. Verify and Test

- [x] 6.1 Verify orchestrator does NOT have subagent-only tools (terminal, process, executeCode, todo, etc.)
- [x] 6.2 Verify codingSubAgent has all subagent tools needed for execution
- [x] 6.3 Verify both agents have shared tools (clarify, date, etc.)
- [x] 6.4 Run `npm run lint` to ensure no lint errors
- [x] 6.5 Run `npm run test` to ensure all tests pass
- [x] 6.6 Run `npm start` to verify application starts without crashing