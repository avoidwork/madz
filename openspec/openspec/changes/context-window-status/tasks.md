## 1. StatusBar Component

- [ ] 1.1 Add `contextSize` and `isCompacting` props to StatusBar component
- [ ] 1.2 Render `context:${contextSize}` after `msg:${messageCount}` in status bar
- [ ] 1.3 Apply red color when `isCompacting` is true, default `#606060` otherwise

## 2. React Agent Compaction Events

- [ ] 2.1 Emit `compaction_start` event in `callReactAgentStreaming` before compaction loop
- [ ] 2.2 Emit `compaction_end` event in `callReactAgentStreaming` after compaction loop exits

## 3. App Component Integration

- [ ] 3.1 Add `contextSize` and `isCompacting` state variables to App
- [ ] 3.2 Handle `compaction_start` and `compaction_end` events in streaming callback
- [ ] 3.3 Update `contextSize` after `sessionState.addExchange()` calls in `handleChat`
- [ ] 3.4 Reset `contextSize` to 0 in `handleNewSession`
- [ ] 3.5 Pass `contextSize` and `isCompacting` to StatusBar in `statusProps`

## 4. Tests

- [ ] 4.1 Write unit test for StatusBar with contextSize and isCompacting props
- [ ] 4.2 Write unit test for compaction event emission in callReactAgentStreaming
