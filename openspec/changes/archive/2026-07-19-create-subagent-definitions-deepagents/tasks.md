## 1. Setup and Registry

- [x] 1.1 Create subagent registry module in src/agent/agentRegistry.js with addAgent, getAgent, listAgents, and validateAgent functions
- [x] 1.2 Add TOOL_CLASSIFICATIONS to src/tools/index.js with search, debug, codeReview, research, testing, documentation, securityAudit, and performance categories
- [ ] 1.3 Update subAgent tool to accept agentType parameter and route to appropriate agent (deferred — routing handled by deepagents library via createDeepAgentsOrchestrator)

## 2. Search Agent

- [x] 2.1 Create search agent definition with system prompt for multi-source search and synthesis
- [x] 2.2 Implement search agent with webSearch, webExtract, grep, glob, and sessionSearch tool access
- [x] 2.3 Add search agent output format: structured summary with sources and key findings

## 3. Debug Agent

- [x] 3.1 Create debug agent definition with system prompt for error tracing and fix proposals
- [x] 3.2 Implement debug agent with readFile, grep, glob, executeCode, and shell tool access
- [x] 3.3 Add debug agent output format: error analysis, root cause, and proposed fix with code

## 4. Code Review Agent

- [x] 4.1 Create code review agent definition with system prompt for structured review
- [x] 4.2 Implement code review agent with readFile, grep, glob, and executeCode tool access
- [x] 4.3 Add code review agent output format: severity-rated findings with file locations and suggestions

## 5. Research Agent

- [x] 5.1 Create research agent definition with system prompt for multi-step research
- [x] 5.2 Implement research agent with webSearch, webExtract, grep, glob, and sessionSearch tool access
- [x] 5.3 Add research agent output format: comprehensive report with findings, recommendations, and sources

## 6. Testing Agent

- [x] 6.1 Create testing agent definition with system prompt for test generation and gap analysis
- [x] 6.2 Implement testing agent with readFile, grep, glob, executeCode, and shell tool access
- [x] 6.3 Add testing agent output format: generated tests with coverage gap analysis

## 7. Documentation Agent

- [x] 7.1 Create documentation agent definition with system prompt for documentation updates
- [x] 7.2 Implement documentation agent with readFile, writeFile, grep, and glob tool access
- [x] 7.3 Add documentation agent output format: documentation changes with generated content

## 8. Security Audit Agent

- [x] 8.1 Create security audit agent definition with system prompt for security scanning
- [x] 8.2 Implement security audit agent with readFile, grep, glob, and shell tool access
- [x] 8.3 Add security audit agent output format: security report with vulnerabilities and remediation steps

## 9. Performance Agent

- [x] 9.1 Create performance agent definition with system prompt for benchmarking
- [x] 9.2 Implement performance agent with readFile, executeCode, grep, and shell tool access
- [x] 9.3 Add performance agent output format: benchmark results with optimization recommendations

## 10. Orchestrator Updates

- [x] 10.1 Update orchestrator to support multiple subagent types and routing (via createDeepAgentsOrchestrator in src/agent/deepAgents.js)
- [x] 10.2 Add parallel execution support for independent subagent calls (handled by deepagents library)
- [x] 10.3 Add agent invocation logging and metrics (logger.info calls for each agent's tool set)

## 11. Tests

- [x] 11.1 Create tests/unit/agentRegistry.test.js with tests for registry, validation, and agent definitions
- [ ] 11.2 Create tests/unit/tools/subAgent.test.js with tests for agentType parameter and routing
- [ ] 11.3 Add integration tests for parallel subagent execution
- [ ] 11.4 Add tests for each agent's output format

## 12. Documentation and Cleanup

- [ ] 12.1 Update README.md with subagent documentation
- [ ] 12.2 Add JSDoc comments to all new functions and classes
- [ ] 12.3 Run npm run test, npm run lint, and npm run coverage to verify everything passes
