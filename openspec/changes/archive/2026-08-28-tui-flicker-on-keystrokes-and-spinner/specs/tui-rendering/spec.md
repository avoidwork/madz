# Spec: TUI Rendering Performance

## ADDED Requirements

### Requirement: StatusBar SHALL be memoized with React.memo
The StatusBar component MUST be wrapped with `React.memo` to prevent re-renders when its props (statusMessage, skillCount, messageCount, contextSize, isCompacting) have not changed.

#### Scenario: StatusBar does not re-render on unchanged props
- **Given** StatusBar is rendered with props `{ statusMessage: "Ready", skillCount: 3, messageCount: 10, contextSize: 500, isCompacting: false }`
- **When** a parent component re-renders without changing any StatusBar props
- **Then** StatusBar should NOT re-render (React.memo shallow comparison returns true)

#### Scenario: StatusBar re-renders on changed statusMessage
- **Given** StatusBar is rendered with `statusMessage: "Ready"`
- **When** statusMessage changes to `"Streaming..."`
- **Then** StatusBar SHOULD re-render (React.memo shallow comparison returns false)

### Requirement: InputPanel SHALL be memoized with React.memo
The InputPanel component MUST be wrapped with `React.memo` to prevent re-renders when its props (value, onChange, onSubmit, onFocus, onBlur, focus) have not changed.

#### Scenario: InputPanel does not re-render on unchanged props
- **Given** InputPanel is rendered with stable callbacks and unchanged value
- **When** a parent component re-renders without changing InputPanel props
- **Then** InputPanel should NOT re-render

#### Scenario: InputPanel re-renders on value change
- **Given** InputPanel is rendered with `value: ""`
- **When** value changes to `"hello"`
- **Then** InputPanel SHOULD re-render

### Requirement: MessageList SHALL be memoized with React.memo
The MessageList component MUST be wrapped with `React.memo` to prevent re-renders when its props (messages, assistantName, renderWindow) have not changed.

#### Scenario: MessageList does not re-render on unchanged props
- **Given** MessageList is rendered with stable messages array reference
- **When** a parent component re-renders without changing MessageList props
- **Then** MessageList should NOT re-render

#### Scenario: MessageList re-renders on message count change
- **Given** MessageList is rendered with 5 messages
- **When** a new message is added (messageCount changes to 6)
- **Then** MessageList SHOULD re-render

### Requirement: App handlers SHALL be stabilized with useCallback
The App component MUST use `useCallback` for all handler functions passed to child components (onChange, onSubmit, onFocus, onBlur) to ensure stable function references across renders.

#### Scenario: handleSubmit has stable reference
- **Given** App component defines handleSubmit
- **When** App re-renders due to unrelated state changes
- **Then** handleSubmit reference should remain stable (useCallback)

#### Scenario: onFocus/onBlur have stable references
- **Given** App component renders with onFocus/onBlur handlers
- **When** App re-renders due to unrelated state changes
- **Then** onFocus/onBlur references should remain stable (useCallback with empty deps)

### Requirement: StatusBar SHALL NOT use ink-spinner
The StatusBar component MUST NOT use `ink-spinner` for spinner animation. Instead, it MUST use direct `stdout.write()` calls with ANSI escape codes to update the spinner frame without triggering React re-renders.

#### Scenario: Spinner does not use ink-spinner
- **Given** StatusBar is rendered in streaming mode
- **When** StatusBar renders its spinner area
- **Then** StatusBar should NOT import or use `ink-spinner`

#### Scenario: Spinner uses stdout.write()
- **Given** StatusBar is rendered in streaming mode
- **When** the component mounts
- **Then** it should start writing spinner frames via `stdout.write()`

### Requirement: Spinner SHALL use ANSI escape codes
The spinner MUST use `\r` carriage return to overwrite the spinner position each frame, and `\x1B[?25l` / `\x1B[?25h` to hide/show the cursor during animation.

#### Scenario: Spinner uses carriage return
- **Given** Spinner is active
- **When** each frame is written
- **Then** it should use `\r` to overwrite the current position

#### Scenario: Cursor is hidden during spinner animation
- **Given** Spinner is active
- **When** the component mounts
- **Then** it should write `\x1B[?25l` to hide the cursor

#### Scenario: Cursor is restored on unmount
- **Given** Spinner is active
- **When** the component unmounts
- **Then** it should write `\x1B[?25h` to restore the cursor
