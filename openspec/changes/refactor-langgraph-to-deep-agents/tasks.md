## 1. Setup and Dependencies

- [ ] 1.1 Add @langchain/deepagents dependency to package.json
- [ ] 1.2 Run npm install to install new dependency
- [ ] 1.3 Verify package.json type is "module" for ESM imports

## 2. Delete subAgent Tool Family

- [ ] 2.1 Delete src/tools/subAgent.js (process spawning, fan-out logic)
- [ ] 2.2 Delete src/tools/subAgentLog.js (log file management)
- [ ] 2.3 Delete src/tools/subAgentMessage.js (stdin messaging)
- [ ] 2.4 Remove subAgent, subAgentLog, subAgentMessage from TOOL_PERMISSIONS in src/tools/index.js
- [ ] 2.5 Remove subAgent, subAgentLog, subAgentMessage from TOOL_FACTORIES in src/tools/index.js
- [ ] 2.6 Remove subAgent tool exclusions from recursion guard in src/tools/index.js
- [ ] 2.7 Delete tests for subAgent tools (tests/unit/tools/subAgent.test.js, subAgentLog.test.js, subAgentMessage.test.js)

## 3. Create Deep Agents Orchestrator

- [ ] 3.1 Create src/agent/deepAgents.js with orchestrator implementation
- [ ] 3.2 Implement coding agent configuration with SUB_AGENT.md prompt
- [ ] 3.3 Implement utility agent configuration with SUB_AGENT.md prompt
- [ ] 3.4 Implement agent routing logic (code tasks → coding agent, general → utility agent)
- [ ] 3.5 Implement sub-agent state tracking via Deep Agents built-in capabilities
- [ ] 3.6 Implement error handling for sub-agent failures

## 4. Replace ReAct Agent with Deep Agents

- [ ] 4.1 Create callReactAgent function using Deep Agents orchestrator
- [ ] 4.2 Create callReactAgentStreaming function using Deep Agents event model
- [ ] 4.3 Maintain public API signatures compatible with existing callers
- [ ] 4.4 Update index.js to use new Deep Agents agent instead of createReactAgent
- [ ] 4.5 Handle sub-agent mode detection in index.js for Deep Agents

## 5. Update Streaming and Event Handling

- [ ] 5.1 Create event adapter to map Deep Agents events to TUI event types
- [ ] 5.2 Map Deep Agents text events to TUI text events
- [ ] 5.3 Map Deep Agents reasoning events to TUI reasoning events
- [ ] 5.4 Map Deep Agents tool events to TUI tool_start/tool_end/tool_error events
- [ ] 5.5 Map Deep Agents compaction events to TUI compaction_start/compaction_end events
- [ ] 5.6 Map Deep Agents loop detection events to TUI loop_detected events

## 6. Update TUI Streaming Callback

- [ ] 6.1 Update src/tui/app.js skill mode streaming callback (lines 259-364)
- [ ] 6.2 Update src/tui/app.js chat mode streaming callback (lines 650-724)
- [ ] 6.3 Update auto-continue logic for skill mode (lines 378-490)
- [ ] 6.4 Update auto-continue logic for chat mode (lines 741-857)
- [ ] 6.5 Verify TUI displays Deep Agents events correctly

## 7. Update Interruption and Loop Detection

- [ ] 7.1 Remove AbortController-based interruption from src/agent/react.js
- [ ] 7.2 Remove manual orphaned process cleanup code
- [ ] 7.3 Implement Deep Agents native interruption handling
- [ ] 7.4 Remove turn hash tracking code from src/agent/react.js
- [ ] 7.5 Remove turnHashWindow and turnBufferMax from config.yaml
- [ ] 7.6 Verify Deep Agents loop detection works correctly

## 8. Integrate Compaction

- [ ] 8.1 Integrate context compaction into Deep Agents flow
- [ ] 8.2 Ensure compaction events are emitted to streaming callback
- [ ] 8.3 Verify compaction works during Deep Agents execution

## 9. Update Configuration

- [ ] 9.1 Remove process subAgent config from config.yaml (timeout, maxConcurrent, sessionMode, defaultStrategy, defaultOnError, temperature)
- [ ] 9.2 Remove turn hash tracking config from config.yaml (turnHashWindow, turnBufferMax)
- [ ] 9.3 Add Deep Agents configuration to config.yaml (agent routing, temperature, etc.)
- [ ] 9.4 Update src/provider/openai.js to remove SUB_AGENT_TEMPERATURE env var handling
- [ ] 9.5 Update SUB_AGENT_TEMPERATURE to use Deep Agents configuration

## 10. Update System Prompt

- [ ] 10.1 Update prompts/SYSTEM_PROMPT.md delegation instructions (lines 51-59)
- [ ] 10.2 Replace subAgent tool call instructions with Deep Agents delegation
- [ ] 10.3 Add instructions for defaulting to utility agent for general tasks
- [ ] 10.4 Add instructions for routing to coding agent for code-related work
- [ ] 10.5 Remove all references to subAgent tool calls

## 11. Update Memory Prompts

- [ ] 11.1 Update src/memory/prompts.js to pass SUB_AGENT.md to Deep Agents sub-agents
- [ ] 11.2 Remove subAgent flag-based prompt loading logic

## 12. Update Tests

- [ ] 12.1 Update tests/unit/agent.test.js for Deep Agents orchestrator
- [ ] 12.2 Update tests/unit/tools/index.test.js to remove subAgent tool tests
- [ ] 12.3 Update tests/unit/prompts.test.js for Deep Agents prompt handling
- [ ] 12.4 Update tests/unit/tui.test.js for new streaming event model
- [ ] 12.5 Update tests/unit/config.test.js for new config structure
- [ ] 12.6 Add tests for Deep Agents event adapter
- [ ] 12.7 Add tests for agent routing logic

## 13. Verification

- [ ] 13.1 Run npm run test and verify all tests pass
- [ ] 13.2 Run npm run lint and verify no lint errors
- [ ] 13.3 Run npm run coverage and verify coverage is maintained
- [ ] 13.4 Run npm start and verify application starts without crashing
- [ ] 13.5 Test delegation flow with coding agent
- [ ] 13.6 Test delegation flow with utility agent
- [ ] 13.7 Test interruption during sub-agent execution
- [ ] 13.8 Test TUI with Deep Agents streaming events