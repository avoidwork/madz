## 1. Setup and Registry

- [ ] 1.1 Create subagent registry module in src/deepAgents.js with addAgent, getAgent, listAgents, and validateAgent functions
- [ ] 1.2 Add TOOL_CLASSIFICATIONS to src/tools/index.js with search, debug, codeReview, and research categories
- [ ] 1.3 Update subAgent tool to accept agentType parameter and route to appropriate agent

## 2. Search Agent

- [ ] 2.1 Create search agent definition with system prompt for multi-source search and synthesis
- [ ] 2.2 Implement search agent with webSearch, sessionSearch, and webExtract tool access
- [ ] 2.3 Add search agent output format: structured summary with sources and key findings

## 3. Debug Agent

- [ ] 3.1 Create debug agent definition with system prompt for error tracing and fix proposals
- [ ] 3.2 Implement debug agent with executeCode, read_file, grep, and shell tool access
- [ ] 3.3 Add debug agent output format: error analysis, root cause, and proposed fix with code

## 4. Code Review Agent

- [ ] 4.1 Create code review agent definition with system prompt for structured review
- [ ] 4.2 Implement code review agent with read_file, grep, and glob tool access
- [ ] 4.3 Add code review agent output format: severity-rated findings with file locations and suggestions

## 5. Research Agent

- [ ] 5.1 Create research agent definition with system prompt for multi-step research
- [ ] 5.2 Implement research agent with webSearch, webExtract, and sessionSearch tool access
- [ ] 5.3 Add research agent output format: comprehensive report with findings, recommendations, and sources

## 6. Orchestrator Updates

- [ ] 6.1 Update orchestrator to support multiple subagent types and routing
- [ ] 6.2 Add parallel execution support for independent subagent calls
- [ ] 6.3 Add agent invocation logging and metrics

## 7. Tests

- [ ] 7.1 Create tests/unit/deepAgents.test.js with tests for registry, validation, and agent definitions
- [ ] 7.2 Create tests/unit/tools/subAgent.test.js with tests for agentType parameter and routing
- [ ] 7.3 Add integration tests for parallel subagent execution
- [ ] 7.4 Add tests for each agent's output format

## 8. Documentation and Cleanup

- [ ] 8.1 Update README.md with subagent documentation
- [ ] 8.2 Add JSDoc comments to all new functions and classes
- [ ] 8.3 Run npm run test, npm run lint, and npm run coverage to verify everything passes
