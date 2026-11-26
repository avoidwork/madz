# Spec Delta

## ADDED Requirements

### Requirement: SystemPanel SHALL handle gatherSystemInfo rejection without an unhandled rejection

`src/tui/systemPanel.js` SHALL attach a rejection handler to the `gatherSystemInfo()` promise chain so that a rejected promise does not surface as an unhandled promise rejection, while preserving the cancelled/disposed guard so state is not set after unmount.

#### Scenario: gatherSystemInfo rejects

- **WHEN** `gatherSystemInfo()` rejects while the system panel is mounted
- **THEN** the rejection is handled and no unhandled promise rejection is emitted

#### Scenario: gatherSystemInfo rejects after unmount

- **WHEN** `gatherSystemInfo()` rejects after the system panel has been cancelled/disposed
- **THEN** the rejection is handled and no state is set after unmount
