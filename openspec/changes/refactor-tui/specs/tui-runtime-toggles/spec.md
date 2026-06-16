## ADDED Requirements

### Requirement: Runtime Toggle Commands
The TUI SHALL provide `/toggle` commands for runtime overrides of TUI configuration values stored in `config.yaml`'s `tui` section.

#### Scenario: Toggle a single setting
- **WHEN** user types `/toggle timestamps`
- **THEN** the system toggles the `timestamps` setting off (if currently on) or on (if currently off)

#### Scenario: Toggle without argument shows all toggles
- **WHEN** user types `/toggle` with no arguments
- **THEN** the system displays all toggle settings and their current states

#### Scenario: Toggle persists for session
- **WHEN** a toggle is changed
- **THEN** the new value applies immediately and persists until the application restarts

### Requirement: Toggleable Settings
The following settings SHALL be toggleable at runtime:

| Toggle | Default | Description |
|--------|---------|-------------|
| `autoScroll` | `true` | Auto-scroll to bottom on new messages |
| `timestamps` | `true` | Show timestamps on messages |
| `commandEcho` | `true` | Echo user commands to output |
| `cursorBreathe` | `true` | Enable breathing cursor model |
| `debugOutput` | `false` | Show debug-level messages |

#### Scenario: autoScroll toggle controls scroll behavior
- **WHEN** `autoScroll` is toggled off
- **THEN** new messages no longer trigger automatic scroll to bottom

#### Scenario: timestamps toggle controls timestamp display
- **WHEN** `timestamps` is toggled off
- **THEN** message timestamps are hidden in the conversation panel

#### Scenario: debugOutput toggle controls debug messages
- **WHEN** `debugOutput` is toggled on
- **THEN** debug-level messages appear in the conversation panel

### Requirement: Toggle State in Reducer
The TUI reducer SHALL include a `toggles` field in `TUIState` with all toggleable settings, and provide `TOGGLE_CONFIG` and `SET_CONFIG` actions for updating toggle values.

#### Scenario: TOGGLE_CONFIG action flips a toggle
- **WHEN** `TOGGLE_CONFIG` action is dispatched with key `timestamps`
- **THEN** the `timestamps` value is inverted (true → false, false → true)

#### Scenario: SET_CONFIG action sets multiple toggles
- **WHEN** `SET_CONFIG` action is dispatched with `updates: { autoScroll: false, timestamps: false }`
- **THEN** both `autoScroll` and `timestamps` are set to false

### Requirement: Status Bar Component
The status bar SHALL display:
- Status indicator: `●` green (ready), `▶` yellow (streaming), `✖` red (error)
- Status message: "Ready", "Streaming...", "Compacting context..."
- Skill count: Number of registered skills
- Message count: Total messages in conversation
- Context size: Current conversation token count (human-readable: "1.2k", "15k")
- Toggle indicators: Current toggle states (e.g., `[ts:1 scroll:1]`)

#### Scenario: Status indicator reflects connection state
- **WHEN** the system is ready
- **THEN** the status indicator shows a green `●` with "Ready"

#### Scenario: Status indicator reflects streaming state
- **WHEN** the system is streaming
- **THEN** the status indicator shows a yellow `▶` with "Streaming..."

#### Scenario: Status indicator reflects error state
- **WHEN** the system encounters an error
- **THEN** the status indicator shows a red `✖` with an error message

#### Scenario: Context size is human-readable
- **WHEN** the context size is displayed
- **THEN** it is formatted as a human-readable string (e.g., "1.2k", "15k")

#### Scenario: Toggle indicators show active toggles
- **WHEN** toggles are active
- **THEN** the status bar displays toggle states such as `[ts:1 scroll:1]`
