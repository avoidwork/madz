## 1. Setup and Dependencies

- [x] 1.1 Add @langchain/deepagents dependency to package.json
- [x] 1.2 Run npm install to install new dependency
- [x] 1.3 Verify package.json type is "module" for ESM imports

## 2. Delete subAgent Tool Family

- [x] 2.1 Delete src/tools/subAgent.js (process spawning, fan-out logic)
- [x] 2.2 Delete src/tools/subAgentLog.js (log file management)
- [x] 2.3 Delete src/tools/subAgentMessage.js (stdin messaging)
- [x] 2.4 Remove subAgent, subAgentLog, subAgentMessage from TOOL_PERMISSIONS in src/tools/index.js
- [x] 2.5 Remove subAgent, subAgentLog, subAgentMessage from TOOL_FACTORIES in src/tools/index.js
- [x] 2.6 Remove subAgent tool exclusions from recursion guard in src/tools/index.js
- [x] 2.7 Delete tests for subAgent tools (tests/unit/tools/subAgent.test.js, subAgentLog.test.js, subAgentMessage.test.js)

## 3. Create Deep Agents Orchestrator

- [x] 3.1 Create src/agent/deepAgents.js with orchestrator implementation
- [x] 3.2 Implement coding agent configuration with SUB_AGENT.md prompt
- [x] 3.3 Implement utility agent configuration with SUB_AGENT.md prompt
- [x] 3.4 Implement agent routing logic (code tasks → coding agent, general → utility agent)
- [x] 3.5 Implement sub-agent state tracking via Deep Agents built-in capabilities
- [x] 3.6 Implement error handling for sub-agent failures

## 4. Replace ReAct Agent with Deep Agents

- [x] 4.1 Create callReactAgent function using Deep Agents orchestrator
- [x] 4.2 Create callReactAgentStreaming function using Deep Agents event model
- [x] 4.3 Maintain public API signatures compatible with existing callers
- [x] 4.4 Update index.js to use new Deep Agents agent instead of createReactAgent
- [x] 4.5 Handle sub-agent mode detection in index.js for Deep Agents

## 5. Update Streaming and Event Handling

- [x] 5.1 Create event adapter to map Deep Agents events to TUI event types
- [x] 5.2 Map Deep Agents text events to TUI text events
- [x] 5.3 Map Deep Agents reasoning events to TUI reasoning events
- [x] 5.4 Map Deep Agents tool events to TUI tool_start/tool_end/tool_error events
- [x] 5.5 Map Deep Agents compaction events to TUI compaction_start/compaction_end events
- [x] 5.6 Map Deep Agents loop detection events to TUI loop_detected events

## 6. Update TUI Streaming Callback

- [x] 6.1 Update src/tui/app.js skill mode streaming callback (lines 259-364)
- [x] 6.2 Update src/tui/app.js chat mode streaming callback (lines 650-724)
- [x] 6.3 Update auto-continue logic for skill mode (lines 378-490)
- [x] 6.4 Update auto-continue logic for chat mode (lines 741-857)
- [x] 6.5 Verify TUI displays Deep Agents events correctly

## 7. Update Interruption and Loop Detection

- [x] 7.1 Remove AbortController-based interruption from src/agent/react.js
- [x] 7.2 Remove manual orphaned process cleanup code
- [x] 7.3 Implement Deep Agents native interruption handling
- [x] 7.4 Remove turn hash tracking code from src/agent/react.js
- [x] 7.5 Remove turnHashWindow and turnBufferMax from config.yaml
- [x] 7.6 Verify Deep Agents loop detection works correctly

## 8. Integrate Compaction

- [x] 8.1 Integrate context compaction into Deep Agents flow
- [x] 8.2 Ensure compaction events are emitted to streaming callback
- [x] 8.3 Verify compaction works during Deep Agents execution

## 9. Update Configuration

- [x] 9.1 Remove process subAgent config from config.yaml (timeout, maxConcurrent, sessionMode, defaultStrategy, defaultOnError, temperature)
- [x] 9.2 Remove turn hash tracking config from config.yaml (turnHashWindow, turnBufferMax)
- [x] 9.3 Add Deep Agents configuration to config.yaml (agent routing, temperature, etc.)
- [x] 9.4 Update src/provider/openai.js to remove SUB_AGENT_TEMPERATURE env var handling
- [x] 9.5 Update SUB_AGENT_TEMPERATURE to use Deep Agents configuration

## 10. Update System Prompt

- [x] 10.1 Update prompts/SYSTEM_PROMPT.md delegation instructions (lines 51-59)
- [x] 10.2 Replace subAgent tool call instructions with Deep Agents delegation
- [x] 10.3 Add instructions for defaulting to utility agent for general tasks
- [x] 10.4 Add instructions for routing to coding agent for code-related work
- [x] 10.5 Remove all references to subAgent tool calls

## 11. Update Memory Prompts

- [x] 11.1 Update src/memory/prompts.js to pass SUB_AGENT.md to Deep Agents sub-agents
- [x] 11.2 Remove subAgent flag-based prompt loading logic

## 12. Update Tests

- [x] 12.1 Update tests/unit/agent.test.js for Deep Agents orchestrator
- [x] 12.2 Update tests/unit/tools/index.test.js to remove subAgent tool tests
- [x] 12.3 Update tests/unit/prompts.test.js for Deep Agents prompt handling
- [x] 12.4 Update tests/unit/tui.test.js for new streaming event model
- [x] 12.5 Update tests/unit/config.test.js for new config structure
- [x] 12.6 Add tests for Deep Agents event adapter
- [x] 12.7 Add tests for agent routing logic

## 13. Verification

- [x] 13.1 Run npm run test and verify all tests pass
- [x] 13.2 Run npm run lint and verify no lint errors
- [x] 13.3 Run npm run coverage and verify coverage is maintained
- [x] 13.4 Run npm start and verify application starts without crashing
- [ ] 13.5 Test delegation flow with coding agent
- [ ] 13.6 Test delegation flow with utility agent
- [ ] 13.7 Test interruption during sub-agent execution
- [ ] 13.8 Test TUI with Deep Agents streaming events