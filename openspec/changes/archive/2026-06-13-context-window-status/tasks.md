## 1. StatusBar Component

- [x] 1.1 Add `contextSize` and `isCompacting` props to StatusBar component
- [x] 1.2 Render `context:${contextSize}` after `msg:${messageCount}` in status bar
- [x] 1.3 Apply red color when `isCompacting` is true, default `#606060` otherwise

## 2. React Agent Compaction Events

- [x] 2.1 Emit `compaction_start` event in `callReactAgentStreaming` before compaction loop
- [x] 2.2 Emit `compaction_end` event in `callReactAgentStreaming` after compaction loop exits

## 3. App Component Integration

- [x] 3.1 Add `contextSize` and `isCompacting` state variables to App
- [x] 3.2 Handle `compaction_start` and `compaction_end` events in streaming callback
- [x] 3.3 Update `contextSize` after `sessionState.addExchange()` calls in `handleChat`
- [x] 3.4 Reset `contextSize` to 0 in `handleNewSession`
- [x] 3.5 Pass `contextSize` and `isCompacting` to StatusBar in `statusProps`

## 4. Tests

- [x] 4.1 Write unit test for StatusBar with contextSize and isCompacting props
- [x] 4.2 Write unit test for compaction event emission in callReactAgentStreaming
