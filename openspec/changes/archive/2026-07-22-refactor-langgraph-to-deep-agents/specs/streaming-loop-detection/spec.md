## MODIFIED Requirements

### Requirement: Loop detection uses Deep Agents built-in detection
The system SHALL rely on Deep Agents' built-in loop detection instead of ad-hoc turn hash tracking.

#### Scenario: Turn hash tracking is removed
- **WHEN** the system checks for loop detection configuration
- **THEN** turnHashWindow and turnBufferMax config options are no longer present

#### Scenario: Deep Agents detects agent loop
- **WHEN** the orchestrator detects a looping pattern in agent behavior
- **THEN** Deep Agents triggers loop detection handling

#### Scenario: loop_detected event is emitted
- **WHEN** a loop is detected by Deep Agents
- **THEN** a loop_detected event is emitted to the streaming callback