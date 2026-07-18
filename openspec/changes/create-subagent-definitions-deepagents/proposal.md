## Why

The current architecture has a single `coding` subagent, but our workflow regularly benefits from specialized agents with focused context windows and tool access. Dedicated subagents would reduce context pollution in the main thread, enable parallel execution of independent tasks, provide deeper expertise in specific domains, and improve reliability by isolating failures to individual subagent contexts.

## What Changes

- Add subagent definition framework to `deepAgents.js` with registry pattern
- Create focused tool access via `TOOL_CLASSIFICATIONS` filtering in `src/tools/index.js`
- Implement eight agents across three priority tiers:
  - High Priority: Search, Debug, Code Review, Research
  - Medium Priority: Testing, Documentation
  - Lower Priority: Security Audit, Performance
- Update orchestrator to support multiple subagent types and parallel execution
- Add unit tests for each agent definition and parallel execution scenarios
- Update `subAgent` tool to accept agent type parameter

## Capabilities

### New Capabilities
- `subagent-definitions`: Framework for defining specialized subagents with focused tool access and system prompts
- `agent-registry`: Registry pattern for loading and validating subagent definitions
- `tool-classification`: Tool filtering system that categorizes tools by agent type
- `parallel-execution`: Orchestrator support for concurrent subagent invocations
- `search-agent`: Multi-source search agent with synthesis capabilities
- `debug-agent`: Error tracing and fix proposal agent
- `code-review-agent`: Structured code review agent with severity ratings
- `research-agent`: Multi-step research agent with source tracking
- `testing-agent`: Test generation and gap analysis agent
- `documentation-agent`: Documentation update and generation agent
- `security-audit-agent`: Security scanning and vulnerability detection agent
- `performance-agent`: Performance benchmarking and optimization agent

### Modified Capabilities
- `subAgent-tool`: Update existing subAgent tool to support agent type parameter and routing

## Impact

- `src/deepAgents.js` — Add subagent definitions and registry
- `src/tools/index.js` — Update `TOOL_CLASSIFICATIONS` with agent type categorization
- `src/tools/subAgent.js` — Update to support agent type parameter and routing
- `src/orchestrator.js` — Add parallel execution support for independent subagent calls
- `tests/unit/deepAgents.test.js` — Add tests for new agents and parallel execution
- `tests/unit/tools/subAgent.test.js` — Update tests for agent type parameter
