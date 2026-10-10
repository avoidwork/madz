# tui-context-meter Specification

## Purpose
TBD - created by archiving change tui-context-meter-search. Update Purpose after archive.
## Requirements
### Requirement: Status bar renders a context-window utilization meter
The TUI status bar SHALL render a visual context-window utilization meter instead of a bare token count, showing the proportion of the context window used. The meter SHALL display a bar of block characters (e.g. `[▮▮▮▯▯▯] 62%`) and a percentage label.

#### Scenario: Meter renders at 0% utilization
- **WHEN** `contextSize` is 0 and `contextWindow` is a positive value
- **THEN** the status bar renders a meter showing all empty blocks and 0%

#### Scenario: Meter renders at 50% utilization
- **WHEN** `contextSize` is half of `contextWindow`
- **THEN** the status bar renders a meter showing half filled blocks and 50%

#### Scenario: Meter renders at 100% utilization
- **WHEN** `contextSize` equals `contextWindow`
- **THEN** the status bar renders a meter showing all filled blocks and 100%

#### Scenario: Meter falls back to bare number when context window is unset
- **WHEN** `contextWindow` is 0 or not configured
- **THEN** the status bar renders the bare `formatSize(contextSize)` number instead of a meter

### Requirement: Meter is colored by context utilization
The meter SHALL be colored using the existing `getContextUtilizationColor(contextSize, contextWindow)` helper, which returns cyan for 0-60% utilization, orange for 61-80%, and red for 81-100%.

#### Scenario: Meter is cyan at low utilization
- **WHEN** utilization is 0-60%
- **THEN** the meter renders in cyan

#### Scenario: Meter is orange at medium utilization
- **WHEN** utilization is 61-80%
- **THEN** the meter renders in orange

#### Scenario: Meter is red at high utilization
- **WHEN** utilization is 81-100%
- **THEN** the meter renders in red

