# Spec Delta

## ADDED Requirements

### Requirement: Subagent Reasoning Loop Detection
The system SHALL apply loop detection to subagent reasoning streams in addition to the main agent loop, so that a subagent repeating the same reasoning without making progress is detected and its stream abandoned. Subagent reasoning SHALL be keyed per subagent so concurrent subagents do not share detector state, and subagent loop detection SHALL be toggleable via configuration.

#### Scenario: Repeating subagent reasoning is flagged
- **WHEN** a subagent emits the same reasoning across consecutive turns without making progress
- **THEN** the loop detector flags the subagent reasoning stream as looping and the stream is abandoned

#### Scenario: Varied subagent reasoning is not flagged
- **WHEN** a subagent emits varied reasoning that makes progress
- **THEN** the loop detector does not flag the subagent reasoning stream

#### Scenario: Concurrent subagents are tracked independently
- **WHEN** multiple subagents stream reasoning concurrently
- **THEN** each subagent's reasoning is keyed separately so their detector states do not mix

#### Scenario: Subagent loop detection is configurable
- **WHEN** subagent loop detection is disabled via configuration
- **THEN** subagent reasoning is not fed to the loop detector

#### Scenario: Subagent turn lifecycle releases detector state
- **WHEN** a subagent reasoning turn ends
- **THEN** the subagent's detector state is released so it does not leak into the next turn

#### Scenario: Subagent loop surfaces through the loop-detected signal
- **WHEN** a subagent reasoning loop is detected
- **THEN** the loop-detected signal is returned so the orchestrator can nudge, escalate, or abort the subagent
