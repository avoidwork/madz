## ADDED Requirements

### Requirement: TUI Application Entry Point
The application SHALL start as a CLI process and launch a React-based terminal user interface using the `ink` library. The TUI SHALL render a main viewport showing conversation history, tool outputs, and status indicators, without requiring an HTTP server. The application MUST accept CLI arguments for mode selection (`--batch`, `--pipeline`), memory directory path, and configuration file path.

#### Scenario: Application launches in interactive mode by default
- **WHEN** the user runs `node bin/madz.mjs` with no arguments
- **THEN** the application launches the interactive TUI showing the conversation viewport with an input prompt

#### Scenario: Application launches in batch mode via CLI flag
- **WHEN** the user runs `node bin/madz.mjs --batch`
- **THEN** the application parses stdin for the prompt and tool list, executes without a TUI, and writes output to stdout

#### Scenario: Application launches in pipeline mode via CLI flag
- **WHEN** the user runs `node bin/madz.mjs --pipeline`
- **THEN** the application reads prompt from stdin and writes structured JSON output to stdout

### Requirement: Keyboard Shortcuts
The TUI SHALL support keyboard-based interaction for all primary operations. The system MUST handle keyboard events with a consistent, discoverable binding scheme displayed in a help overlay.

#### Scenario: User opens help overlay
- **WHEN** the user presses `?` in the TUI
- **THEN** the application displays a help screen listing all available keyboard shortcuts and their functions

#### Scenario: User clears the current conversation
- **WHEN** the user presses `Ctrl+L` in the TUI
- **THEN** the application clears the current viewport scrollback and retains the session in memory

#### Scenario: User switches between interaction modes
- **WHEN** the user presses a mode-switch key (e.g., `m`)
- **THEN** the application cycles through available modes (conversational, batch, pipeline) and updates the viewport indicator

### Requirement: Viewport Rendering
The TUI SHALL render a scrollable conversation viewport that displays messages from both user and assistant, including embedded tool call outputs, error messages, and system notifications. The viewport SHALL maintain scrollback history accessible via mouse wheel or `j`/`k` key navigation.

#### Scenario: New assistant message is rendered
- **WHEN** the assistant responds with text output
- **THEN** the application appends the message to the viewport below the current content with visual distinction from user messages

#### Scenario: Tool output appears in conversation
- **WHEN** a tool executes and returns structured output
- **THEN** the application renders the tool name and result in a collapsible code block within the conversation viewport

#### Scenario: User scrolls through history
- **WHEN** the viewport contains more content than fits the terminal height
- **THEN** the user scrolls using `j`/`k` keys or mouse wheel to view earlier conversation entries

### Requirement: Input Handling
The TUI SHALL provide a text input area at the bottom of the viewport where the user types commands and conversation messages. The input area MUST support multi-line input and standard terminal editing keys (Backspace, Ctrl+U, Ctrl+W for word deletion, Tab for autocomplete on available commands).

#### Scenario: User sends a conversation message
- **WHEN** the user types a message and presses Enter
- **THEN** the application appends the user message to the conversation and sends it to the session manager for processing

#### Scenario: User enters a command
- **WHEN** the user types a command starting with `/` (e.g., `/status`, `/memory`)
- **THEN** the application parses and dispatches the command to the appropriate handler

#### Scenario: User edits a multi-line input
- **WHEN** the user types a multi-line message and presses Enter
- **THEN** the application sends the full multi-line text as a single message to the session, including line breaks

### Requirement: Mode Indicator
The TUI SHALL display a persistent mode indicator in the viewport showing the current interaction mode (conversational, batch, or pipeline). The indicator MUST update immediately when the user switches modes.

#### Scenario: Mode indicator reflects current mode
- **WHEN** the application is running in conversational mode
- **THEN** the viewport displays "mode: conversational" in the mode indicator area

#### Scenario: Mode changes on switch
- **WHEN** the user switches from batch to pipeline mode via keypress
- **THEN** the mode indicator immediately updates to "mode: pipeline"

### Requirement: Status Bar
The TUI SHALL display a persistent status bar at the bottom of the viewport showing current session state, memory file path, Docker container status, and tool registry size. The status bar MUST update in real-time as state changes.

#### Scenario: Status bar shows active session
- **WHEN** a session is started and active
- **THEN** the status bar displays the session ID along with the memory directory path

#### Scenario: Status bar reflects tool count
- **WHEN** the tool registry loads
- **THEN** the status bar displays the number of registered tools (e.g., "tools: 5")

#### Scenario: Status bar shows container health
- **WHEN** the Docker container is healthy and running
- **THEN** the status bar displays "container: healthy"; when unhealthy, it displays "container: error" with a reason
