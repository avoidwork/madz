# tui-message-optimization Specification

## Purpose
TBD - created by archiving change tui-messages-ref-optimization. Update Purpose after archive.
## Requirements
### Requirement: Messages SHALL be stored in a mutable ref
The system SHALL use `useRef([])` to store the messages array instead of `useState([])`. The ref SHALL be accessible as `messagesRef.current` throughout the component.

#### Scenario: Ref initialization
- **WHEN** the app component mounts
- **THEN** `messagesRef.current` is initialized as an empty array `[]`

#### Scenario: Ref mutation during streaming
- **WHEN** a streaming chunk arrives
- **THEN** `messagesRef.current` is mutated directly without creating a new array reference

### Requirement: UI updates SHALL be triggered via forceRender state
The system SHALL use a separate `useState(0)` state variable (`forceRender`) to trigger re-renders. The `forceRender` function SHALL be called after mutations that require UI updates.

#### Scenario: Force render after non-streaming update
- **WHEN** a non-streaming operation modifies messages (e.g., clearing, error handling)
- **THEN** `forceRender(prev => prev + 1)` is called immediately after mutation

#### Scenario: No force render for internal state updates
- **WHEN** an internal operation modifies messages that doesn't require immediate UI update
- **THEN** `forceRender` is NOT called (throttled updates handle this)

### Requirement: Streaming updates SHALL be throttled
The system SHALL implement a throttle strategy that limits re-render frequency during high-chunk-rate streaming. A `renderTickRef` SHALL track update ticks, and `forceRender` SHALL be called every N ticks (default: 5).

#### Scenario: Throttle during high-frequency streaming
- **WHEN** streaming chunks arrive faster than the throttle interval
- **THEN** `forceRender` is called only every 5 ticks, not on every chunk

#### Scenario: Throttle is configurable
- **WHEN** the throttle interval needs to be adjusted
- **THEN** the interval can be configured via a constant or settings value

### Requirement: createStreamingHandler SHALL be memoized
The system SHALL wrap `createStreamingHandler` in `useCallback` to prevent callback reference churn on every render.

#### Scenario: Callback stability
- **WHEN** the component re-renders without dependency changes
- **THEN** `createStreamingHandler` reference remains stable

#### Scenario: Callback updates with dependencies
- **WHEN** a dependency of `createStreamingHandler` changes
- **THEN** `createStreamingHandler` reference is updated

### Requirement: All setMessages call sites SHALL be converted
The system SHALL convert all 19 `setMessages` call sites in `src/tui/app.js` to use the ref-based pattern.

#### Scenario: Direct mutation sites
- **WHEN** a call site previously used `setMessages((prev) => { clone })` pattern
- **THEN** it is converted to `messagesRef.current` direct mutation

#### Scenario: Array operation sites
- **WHEN** a call site previously used `setMessages([])` or `setMessages((prev) => prev.filter(...))`
- **THEN** it is converted to `messagesRef.current = []` or `messagesRef.current = messagesRef.current.filter(...)`

#### Scenario: addMessage site
- **WHEN** the `addMessage` function previously used `setMessages((prev) => prev.concat(...))`
- **THEN** it is converted to `messagesRef.current.push(...)`

### Requirement: Tests SHALL read from messagesRef.current
The system SHALL update all test assertions that previously mocked `setMessages` or checked message state to read from `messagesRef.current` instead.

#### Scenario: Test reads ref value
- **WHEN** a test verifies message state
- **THEN** it reads from `messagesRef.current` instead of mocking `setMessages`

#### Scenario: Test passes after update
- **WHEN** all test assertions are updated to use the ref pattern
- **THEN** all existing tests pass without regression

