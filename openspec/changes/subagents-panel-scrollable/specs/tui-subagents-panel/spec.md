# Spec Delta

## MODIFIED Requirements

### Requirement: SUBAGENTS panel SHALL render subagent activity

`src/tui/subagentsPanel.js` SHALL render each subagent's reasoning/message segments and tool calls, keyed by namespace.

#### Scenario: Panel renders subagent message segments

- **WHEN** the SUBAGENTS panel is rendered with a subagent store containing a subagent's message segments
- **THEN** the panel renders the subagent's message content

#### Scenario: Panel renders subagent reasoning segments

- **WHEN** the SUBAGENTS panel is rendered with a subagent store containing a subagent's reasoning segments
- **THEN** the panel renders the subagent's reasoning content

#### Scenario: Panel renders subagent tool calls

- **WHEN** the SUBAGENTS panel is rendered with a subagent store containing a subagent's tool calls
- **THEN** the panel renders the subagent's tool call activity

## ADDED Requirements

### Requirement: SUBAGENTS panel SHALL scroll via arrow and page keys

When the SUBAGENTS panel is the active view, the up/down arrow keys and PageUp/PageDown keys SHALL scroll the panel's virtualized list in the chosen direction. Up/PageUp scroll toward the top; Down/PageDown scroll toward the bottom. Line keys scroll by one line; page keys scroll by the viewport height.

#### Scenario: Up arrow scrolls up

- **WHEN** the SUBAGENTS panel is the active view and the user presses the up arrow key
- **THEN** the panel scrolls up by one line

#### Scenario: Down arrow scrolls down

- **WHEN** the SUBAGENTS panel is the active view and the user presses the down arrow key
- **THEN** the panel scrolls down by one line

#### Scenario: PageUp scrolls up by a page

- **WHEN** the SUBAGENTS panel is the active view and the user presses PageUp
- **THEN** the panel scrolls up by the viewport height

#### Scenario: PageDown scrolls down by a page

- **WHEN** the SUBAGENTS panel is the active view and the user presses PageDown
- **THEN** the panel scrolls down by the viewport height

#### Scenario: Manual scroll-up suppresses auto-scroll

- **WHEN** the user scrolls away from the bottom of the panel
- **THEN** auto-scroll to the bottom is suppressed until the user returns to the bottom
