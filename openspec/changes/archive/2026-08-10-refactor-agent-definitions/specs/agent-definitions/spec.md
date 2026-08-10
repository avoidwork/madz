## ADDED Requirements

### Requirement: Factory function creates agent definitions
The system SHALL provide a `createAgentDefinition(name, promptFile, description)` factory function that produces a complete agent definition object with all required properties.

#### Scenario: Factory creates a valid agent object
- **WHEN** `createAgentDefinition("coding", "CODING.md", "Specialized agent for code editing")` is called
- **THEN** the returned object has `name: "coding"`, `description: "Specialized agent for code editing"`, and an empty `systemPrompt: ""`

#### Scenario: Factory loads prompt asynchronously
- **WHEN** the factory is invoked with a valid prompt file name
- **THEN** the agent's `systemPrompt` is populated asynchronously via `readFile` from the `prompts/` directory

### Requirement: Agent definitions directory structure
The system SHALL organize agent definitions under `src/agent/definitions/` with a factory module and individual agent files.

#### Scenario: Directory structure is correct
- **WHEN** the refactoring is complete
- **THEN** `src/agent/definitions/factory.js` exists and `src/agent/definitions/` contains one file per agent (9 files)

### Requirement: Index exports all agent definitions
The system SHALL export all agent definitions from `src/agent/definitions/index.js` and provide a `getAllAgents()` function.

#### Scenario: Index exports all agents
- **WHEN** `import { getAllAgents } from "../../agent/definitions/index.js"` is executed
- **THEN** `getAllAgents()` returns an array of all 9 agent definition objects

### Requirement: Zero behavioral change
The system SHALL maintain identical agent object shapes and behavior after refactoring.

#### Scenario: Agent object shape is preserved
- **WHEN** an agent is imported from the new location
- **THEN** the object has the same `name`, `description`, and `systemPrompt` properties as before

#### Scenario: Prompt loading behavior is preserved
- **WHEN** an agent module is imported
- **THEN** the `systemPrompt` is loaded asynchronously from `prompts/<PROMPT_FILE>` at module initialization
