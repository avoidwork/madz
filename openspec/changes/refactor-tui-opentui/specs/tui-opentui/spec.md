## ADDED Requirements

### Requirement: TUI Runtime uses OpenTUI renderer
The TUI SHALL use `@opentui/core` and `@opentui/react` as the rendering engine instead of `ink` and `ink-scroll-view`.

#### Scenario: Renderer initialization
- **WHEN** the app starts in interactive mode (`--mode interactive`)
- **THEN** the entry point calls `createCliRenderer({ exitOnCtrlC: true })` and renders via `createRoot(renderer).render(<App />)`

#### Scenario: Renderer cleanup on shutdown
- **WHEN** the app exits (Ctrl+C, SIGTERM, or programmatic exit)
- **THEN** `renderer.destroy()` is called in a `finally` block, restoring the terminal and freeing native resources

#### Scenario: Entry point uses bun
- **WHEN** the start script is invoked
- **THEN** it runs via `bun index.js` (OpenTUI requires Bun at runtime)

### Requirement: OpenTUI React JSX conventions are used
All TUI components SHALL use OpenTUI React's lowercase JSX elements (`<box>`, `<text>`, `<scrollbox>`, `<input>`, `<markdown>`) with hex color values and style objects for attributes.

#### Scenario: No PascalCase JSX primitives
- **WHEN** TUI component files are inspected
- **THEN** no `<Box>`, `<Text>`, or other PascalCase elements from `ink` are present

#### Scenario: Colors use hex values or OpenTUI color names
- **WHEN** colors are applied to elements
- **THEN** hex values (e.g., `fg="#00FF00"`) or OpenTUI color names are used instead of Ink color strings

## REMOVED Requirements

### Requirement: Ink Application wrapper
**Reason**: Replaced by OpenTUI renderer
**Migration**: Entry point now uses `createCliRenderer()` / `createRoot()` directly

### Requirement: Ink hooks (useInput, useWindowSize, useStdout)
**Reason**: Replaced by OpenTUI React hooks
**Migration**: `useInput` → `useKeyboard`, `useWindowSize` → `useTerminalDimensions`, `stdout.on("resize")` → `useOnResize`
