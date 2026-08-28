# tui-streaming Specification (Modified)

## Purpose
Define the streaming handler behavior with stabilized closures and deduplicated token calculation.

## Requirements

### Requirement: createStreamingHandler SHALL be memoized with useCallback
The `createStreamingHandler` function in `src/tui/app.js` SHALL be wrapped with `useCallback` to prevent creating new closures on every render.

#### Scenario: createStreamingHandler is memoized
- **WHEN** `createStreamingHandler` is defined in the App component
- **THEN** it is wrapped with `React.useCallback`

#### Scenario: Memoized handler has correct dependencies
- **WHEN** the App component re-renders
- **THEN** the streaming handler reference only changes when its dependencies change

### Requirement: Token calculation SHALL be deduplicated into a single function
The pattern of calculating conversation tokens + system prompt tokens and setting context size SHALL be extracted into a single reusable function, eliminating the duplicate code found in three locations in `src/tui/app.js`.

#### Scenario: Single token calculation function exists
- **WHEN** token calculation is needed in App
- **THEN** a single `updateContextSize` function is called

#### Scenario: Token calculation is async-safe
- **WHEN** the system prompt loads asynchronously
- **THEN** the token calculation completes and updates context size without race conditions

#### Scenario: Duplicate code removed from three locations
- **WHEN** `src/tui/app.js` is examined
- **THEN** the token calculation pattern appears exactly once (in the deduplicated function)

### Requirement: StatusBar SHALL not use React.memo
The StatusBar component SHALL be a plain function component without `React.memo`, since its props change on every render making memoization ineffective.

#### Scenario: StatusBar is a plain function
- **WHEN** StatusBar is defined in `src/tui/statusBar.js`
- **THEN** it is NOT wrapped with `React.memo`

#### Scenario: StatusBar renders correctly without memo
- **WHEN** StatusBar receives updated props
- **THEN** it re-renders and displays the correct values
