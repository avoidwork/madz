# Spec Delta

## Purpose

Provides a read-only TUI panel that displays live system information (CPU, memory, disk, uptime, platform, Node version, process memory) gathered from Node built-ins, reachable via the `/system` slash command.

## ADDED Requirements

### Requirement: SYSTEM panel SHALL be registered in PANELS

`PANELS` in `src/tui/panels.js` SHALL include a `SYSTEM` entry, and `getPanelOrder()` SHALL include it in the tab navigation order.

#### Scenario: SYSTEM panel is registered

- **WHEN** the panel registry is inspected
- **THEN** `PANELS.SYSTEM` resolves to `"system"` and `getPanelOrder()` includes it in the navigation order

### Requirement: SystemPanel SHALL gather system info from Node built-ins

`src/tui/systemPanel.js` SHALL gather system information using only Node built-ins (`node:os`, `node:fs`, `node:process`), including CPU load, memory usage, disk usage, uptime, platform, Node version, and process memory.

#### Scenario: System info is gathered

- **WHEN** the system panel gathers system information
- **THEN** it returns CPU count/load, total and free memory, disk usage, uptime, platform, Node version, and process memory from Node built-ins

#### Scenario: Missing fs.statfs support is handled

- **WHEN** `fs.statfs` is unavailable (older Node)
- **THEN** the panel reports disk usage as unavailable without crashing

#### Scenario: Unavailable load average is handled

- **WHEN** load average is unavailable on the platform
- **THEN** the panel reports load as unavailable without crashing

### Requirement: SystemPanel SHALL render system info read-only

`src/tui/systemPanel.js` SHALL render the gathered system information read-only and provide an escape back to the conversation via `onViewChange("conversation")`.

#### Scenario: Panel renders system info

- **WHEN** the system panel is rendered
- **THEN** it displays the gathered system information read-only

#### Scenario: User escapes back to conversation

- **WHEN** the user triggers the escape action in the system panel
- **THEN** the panel calls `onViewChange("conversation")` to return to the conversation view

### Requirement: App SHALL render the SYSTEM panel

The App render switch in `src/tui/app.js` SHALL include a `currentView === PANELS.SYSTEM` branch that renders the system panel, passing `onViewChange` and `activeView`.

#### Scenario: App renders the system panel

- **WHEN** the current view is the system panel
- **THEN** the App renders the system panel component with `onViewChange` and `activeView` props
