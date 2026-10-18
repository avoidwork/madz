## MODIFIED Requirements

### Requirement: Subagent Definition Framework
The system SHALL provide a framework for defining specialized subagents with focused tool access and system prompts. Each generated subagent definition SHALL also carry the eviction-aware filesystem middleware in its `middleware` array, because deepagents does not propagate the orchestrator's custom middleware to inline subagents.

#### Scenario: Define a new subagent
- **WHEN** a developer creates a subagent definition with a name, system prompt, and tool filter
- **THEN** the subagent is registered and can be invoked by the orchestrator

#### Scenario: Subagent has focused tool access
- **WHEN** a subagent is invoked
- **THEN** only tools matching its classification are available in its context

#### Scenario: Subagent definition carries the filesystem middleware replacement
- **WHEN** subagent definitions are generated
- **THEN** each definition's `middleware` array includes an entry named `"FilesystemMiddleware"` built with the config-derived eviction ceiling, so the subagent does not fall back to the library default
