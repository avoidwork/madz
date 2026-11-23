# Spec Delta

## ADDED Requirements

### Requirement: Subagent Message Loop Detection

The system SHALL apply loop detection to subagent message streams in addition to subagent reasoning, so that a subagent repeating the same message text without making progress is detected and its stream abandoned. Subagent message text SHALL be keyed per subagent so concurrent subagents do not share detector state, and subagent message loop detection SHALL be gated by the same `loopDetection.subagent` toggle that gates subagent reasoning.

#### Scenario: Repeating subagent message text is flagged

- **WHEN** a subagent emits the same message text across consecutive turns without making progress
- **THEN** the loop detector flags the subagent message stream as looping and the stream is abandoned

#### Scenario: Varied subagent message text is not flagged

- **WHEN** a subagent emits varied message text that makes progress
- **THEN** the loop detector does not flag the subagent message stream

#### Scenario: Concurrent subagent message streams are tracked independently

- **WHEN** multiple subagents stream message text concurrently
- **THEN** each subagent's message text is keyed separately so their detector states do not mix

#### Scenario: Subagent message loop detection is configurable

- **WHEN** subagent loop detection is disabled via configuration
- **THEN** subagent message text is not fed to the loop detector

#### Scenario: Subagent message turn lifecycle releases detector state

- **WHEN** a subagent message turn ends
- **THEN** the subagent's detector state is released so it does not leak into the next turn

#### Scenario: Subagent message loop surfaces through the loop-detected signal

- **WHEN** a subagent message loop is detected
- **THEN** the loop-detected signal is returned so the orchestrator can nudge, escalate, or abort the subagent
