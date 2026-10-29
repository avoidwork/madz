## ADDED Requirements

### Requirement: Config-gated sampling tool registration
The `sampling` tool SHALL be registered only when `agent.sampling` is enabled in the config. The flag defaults to `true`, so an absent flag leaves the tool registered.

#### Scenario: sampling enabled by default
- **WHEN** `agent.sampling` is absent from the config
- **THEN** the `sampling` tool SHALL be registered in the tool index

#### Scenario: sampling explicitly enabled
- **WHEN** `agent.sampling` is set to `true`
- **THEN** the `sampling` tool SHALL be registered in the tool index

#### Scenario: sampling disabled
- **WHEN** `agent.sampling` is set to `false`
- **THEN** the `sampling` tool SHALL NOT be registered in the tool index

### Requirement: Conditional sampling instruction in system prompt
The system prompt SHALL include the sampling tool instruction only when `agent.sampling` is enabled, and SHALL omit it when disabled.

#### Scenario: Instruction present when enabled
- **WHEN** `agent.sampling` is enabled
- **THEN** the system prompt SHALL contain the sampling tool instruction

#### Scenario: Instruction omitted when disabled
- **WHEN** `agent.sampling` is disabled
- **THEN** the system prompt SHALL NOT contain the sampling tool instruction
