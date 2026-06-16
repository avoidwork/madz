## ADDED Requirements

### Requirement: Runtime Toggle Commands
The TUI SHALL provide built-in `/toggle` commands for runtime overrides of TUI configuration defaults, stored in memory and persisted via `config.yaml` on restart.

#### Scenario: /toggle without arguments shows all toggles
- **WHEN** the user types `/toggle`
- **THEN** the system displays all toggle names and their current states

#### Scenario: /toggle <key> toggles a setting
- **WHEN** the user types `/toggle timestamps`
- **THEN** the `timestamps` toggle flips from `true` to `false` (or vice versa)
- **WHEN** the user types `/toggle timestamps` again
- **THEN** the `timestamps` toggle flips back to `true`

#### Scenario: Toggle overrides are in-memory only
- **WHEN** the TUI restarts
- **THEN** toggle overrides revert to `config.yaml` defaults

### Requirement: Available Toggles
The TUI SHALL support the following runtime toggles with these defaults:

| Toggle | Default | Description |
|--------|---------|-------------|
| `autoScroll` | `true` | Auto-scroll to bottom on new messages |
| `timestamps` | `true` | Show timestamps on messages |
| `commandEcho` | `true` | Echo user commands to output |
| `cursorBreathe` | `true` | Enable breathing cursor model |
| `debugOutput` | `false` | Show debug-level messages |

#### Scenario: autoScroll toggle controls scroll behavior
- **WHEN** `autoScroll` is `true` and a new message arrives
- **THEN** the conversation scrolls to the bottom
- **WHEN** `autoScroll` is `false` and a new message arrives
- **THEN** the conversation does not auto-scroll

#### Scenario: timestamps toggle controls timestamp display
- **WHEN** `timestamps` is `true`
- **THEN** messages display `[HH:MM]` timestamps
- **WHEN** `timestamps` is `false`
- **THEN** messages do not display timestamps

#### Scenario: commandEcho toggle controls command display
- **WHEN** `commandEcho` is `true` and the user submits a command
- **THEN** the command is echoed to the output area
- **WHEN** `commandEcho` is `false` and the user submits a command
- **THEN** the command is not echoed to the output area

### Requirement: Status Bar Toggle Indicators
The TUI SHALL display active toggle states in the status bar for quick visual reference.

#### Scenario: Toggle indicators appear in status bar
- **WHEN** the status bar renders with active toggles
- **THEN** it displays toggle states such as `[ts:1 scroll:1]` alongside existing metrics

#### Scenario: Toggle indicators update on change
- **WHEN** the user toggles a setting via `/toggle`
- **THEN** the status bar indicators update immediately
