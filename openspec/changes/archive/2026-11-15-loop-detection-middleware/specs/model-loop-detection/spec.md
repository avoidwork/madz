# Spec Delta

## Purpose

Detects when the model repeats the same message or reasoning content across successive model calls, injects a "You're looping" nudge to break the loop, and escalates to context compaction when the loop persists.

## ADDED Requirements

### Requirement: Content Hashing

The system SHALL hash the most recent model message text and reasoning content independently so that message loops and reasoning loops are detected separately.

#### Scenario: Message text is hashed independently

- **WHEN** a model call produces a message with text content
- **THEN** the system computes a hash of that text content and records it in the message hash window

#### Scenario: Reasoning content is hashed independently

- **WHEN** a model call produces reasoning content (e.g. `additional_kwargs.reasoning_content` or a reasoning content block)
- **THEN** the system computes a hash of that reasoning content and records it in the reasoning hash window

#### Scenario: Empty content is ignored

- **WHEN** a model call produces neither message text nor reasoning content
- **THEN** the system records no hash for that call

### Requirement: Rolling Hash Window

The system SHALL maintain a rolling window of recent content hashes per thread, bounded to a configured window size and a configured TTL, so that only recent model output is considered for loop detection.

#### Scenario: Window is bounded

- **WHEN** the number of recorded hashes exceeds the configured window size
- **THEN** the oldest hashes are evicted so the window never exceeds the configured size

#### Scenario: Hashes expire by TTL

- **WHEN** a recorded hash is older than the configured TTL
- **THEN** the hash is pruned from the window so past content cannot cause false positives

#### Scenario: State is tracked per thread

- **WHEN** model calls occur on different threads
- **THEN** each thread maintains its own independent hash window

### Requirement: Loop Detection Threshold

The system SHALL detect a loop when a content hash appears more than the configured threshold times within the rolling window.

#### Scenario: Loop detected above threshold

- **WHEN** a content hash appears more than the configured threshold times within the window
- **THEN** the system flags a loop for that content

#### Scenario: No loop at or below threshold

- **WHEN** a content hash appears at or below the configured threshold times within the window
- **THEN** the system does not flag a loop

#### Scenario: Different content does not trigger a loop

- **WHEN** multiple different content hashes each appear below the threshold within the window
- **THEN** the system does not flag a loop

### Requirement: Loop Nudge Injection

The system SHALL inject a `HumanMessage` with the text "You're looping" into the model state when a loop is detected, so the model observes the nudge on its next turn.

#### Scenario: Nudge is injected on loop detection

- **WHEN** a loop is detected
- **THEN** the system appends a `HumanMessage` with text "You're looping" to the model state

#### Scenario: Nudge is a fixed literal

- **WHEN** a loop is detected
- **THEN** the injected message text is exactly "You're looping" and is not derived from user input

### Requirement: Loop Escalation

The system SHALL track loop-nudge injections per thread and, when the configured escalation count is reached within the configured escalation window, invoke the agent's compaction path instead of injecting another nudge.

#### Scenario: Escalation triggers compaction

- **WHEN** the number of loop-nudge injections within the escalation window reaches the configured escalation count
- **THEN** the system invokes the compaction path rather than injecting another nudge

#### Scenario: Escalation window expires

- **WHEN** the escalation window elapses without reaching the configured escalation count
- **THEN** the system resets the injection counter for that thread

#### Scenario: Below escalation count does not compact

- **WHEN** the number of loop-nudge injections within the escalation window is below the configured escalation count
- **THEN** the system does not invoke the compaction path

### Requirement: Configurable Loop Detection

The system SHALL read loop-detection behavior from configuration, including enabled state, window size, detection threshold, escalation count, and escalation window duration, with production-safe defaults.

#### Scenario: Disabled is a no-op

- **WHEN** loop detection is disabled in configuration
- **THEN** the system performs no loop detection and injects no nudge

#### Scenario: Defaults apply when unset

- **WHEN** loop-detection configuration is absent
- **THEN** the system applies the configured defaults for window size, threshold, escalation count, and escalation window
