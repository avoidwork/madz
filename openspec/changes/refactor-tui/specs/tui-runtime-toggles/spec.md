## ADDED Requirements

### Requirement: Runtime toggle system via /toggle commands
The TUI SHALL provide runtime toggle commands that allow users to override `config.yaml` defaults without editing configuration files.

#### Scenario: Toggle a setting on/off
- **WHEN** the user types `/toggle timestamps`
- **THEN** the `timestamps` toggle is turned off
- **WHEN** the user types `/toggle timestamps` again
- **THEN** the `timestamps` toggle is turned back on

#### Scenario: Show all toggle states
- **WHEN** the user types `/toggle` (no arguments)
- **THEN** the TUI displays all toggles and their current states

#### Scenario: Toggle overrides config defaults
- **WHEN** a toggle is changed via `/toggle`
- **THEN** the override takes effect immediately in the UI
- **WHEN** the application restarts
- **THEN** the toggle reverts to the `config.yaml` default (overrides are in-memory only)

### Requirement: Five toggles are supported
The toggle system SHALL support exactly five toggles with the specified defaults:

| Toggle | Default | Description |
|--------|---------|-------------|
| `autoScroll` | `true` | Auto-scroll to bottom on new messages |
| `timestamps` | `true` | Show timestamps on messages |
| `commandEcho` | `true` | Echo user commands to output |
| `cursorBreathe` | `true` | Enable breathing cursor model |
| `debugOutput` | `false` | Show debug-level messages |

#### Scenario: autoScroll toggle
- **WHEN** `autoScroll` is `true`
- **THEN** new messages trigger `scrollToBottom()`
- **WHEN** `autoScroll` is `false`
- **THEN** the user's scroll position is preserved on new messages

#### Scenario: timestamps toggle
- **WHEN** `timestamps` is `true`
- **THEN** messages display with `[HH:MM]` timestamps
- **WHEN** `timestamps` is `false`
- **THEN** messages display without timestamps

#### Scenario: commandEcho toggle
- **WHEN** `commandEcho` is `true`
- **THEN** user commands are echoed to the output stream
- **WHEN** `commandEcho` is `false`
- **THEN** user commands are not echoed

#### Scenario: cursorBreathe toggle
- **WHEN** `cursorBreathe` is `true`
- **THEN** the cursor fades to dark gray after 2 seconds of idle
- **WHEN** `cursorBreathe` is `false`
- **THEN** the cursor remains fully visible

#### Scenario: debugOutput toggle
- **WHEN** `debugOutput` is `true`
- **THEN** debug-level messages appear in the output stream
- **WHEN** `debugOutput` is `false`
- **THEN** debug-level messages are hidden (default)

### Requirement: Toggle indicators appear in status bar
The status bar SHALL display toggle indicators showing which runtime features are active.

#### Scenario: Status bar shows toggle indicators
- **WHEN** the status bar renders
- **THEN** it displays toggle indicators in the format `[ts:1 scroll:1]` where `1` means enabled and `0` means disabled

#### Scenario: Indicators update on toggle change
- **WHEN** a toggle is changed via `/toggle`
- **THEN** the status bar indicators update immediately
