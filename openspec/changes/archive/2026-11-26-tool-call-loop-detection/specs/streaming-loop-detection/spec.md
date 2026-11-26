# Spec Delta

## ADDED Requirements

### Requirement: Tool-Call Loop Detection

The system SHALL flag a loop when the same tool is called repeatedly against the same target (same tool name + same target/argument) with no state change between calls. This is a distinct detection path from the word-chain text detector, which only observes streamed text and cannot see tool-call metadata.

#### Scenario: Repeated identical tool calls are flagged

- **WHEN** the same tool name and the same target/argument are called more than the configured repeat threshold times with no state change between calls
- **THEN** the system flags a loop

#### Scenario: Calls with an intervening state change are not flagged

- **WHEN** the same tool name and target are called but a state change occurs between calls
- **THEN** the system does not flag a loop

#### Scenario: Calls to different targets are not flagged

- **WHEN** the same tool name is called against different targets
- **THEN** the system does not flag a loop

#### Scenario: A single call is not flagged

- **WHEN** a tool is called only once against a target
- **THEN** the system does not flag a loop

#### Scenario: Tool-call metadata is validated before evaluation

- **WHEN** tool-call metadata (tool name, target, argument) is fed to the loop detector
- **THEN** the system validates it as untrusted input before evaluation

#### Scenario: Tool-call gating is configurable

- **WHEN** the tool-call loop detection is disabled via configuration
- **THEN** the system does not evaluate tool-call metadata for loops
