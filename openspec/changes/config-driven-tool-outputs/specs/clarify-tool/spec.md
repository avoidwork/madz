## MODIFIED Requirements

### Requirement: Clarify tool description notes the question is echoed
The `clarify` tool `description` SHALL note that the question is echoed back in the result.

#### Scenario: Description reflects echo behavior
- **WHEN** the `clarify` tool is registered
- **THEN** its `description` mentions that the question is echoed back in the result

### Requirement: Clarify tool description notes the interrupt behavior
The `clarify` tool `description` SHALL note that it interrupts the agent to surface the question and captures the user's reply.

#### Scenario: Description reflects interrupt behavior
- **WHEN** the `clarify` tool is registered
- **THEN** its `description` mentions that it interrupts the agent to surface the question and captures the user's reply

### Requirement: Clarify tool description references memory/tools
The `clarify` tool `description` SHALL reference `memory/tools/` as the location where clarification questions are stored for session context.

#### Scenario: Description references tools directory
- **WHEN** the `clarify` tool is registered
- **THEN** its `description` mentions `memory/tools/` as the storage location for clarification questions
