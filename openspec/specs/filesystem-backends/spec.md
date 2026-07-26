## ADDED Requirements

### Requirement: srcBackend provides sandboxed access to src/ directory

The system SHALL provide a dedicated FilesystemBackend sandboxed to the src/ directory, enabling agents to read and write files within src/ while preventing access to other project areas.

#### Scenario: srcBackend sandboxed to src/
- **WHEN** createSrcBackend is called with a cwd
- **THEN** it returns a FilesystemBackend with rootDir set to the src/ subdirectory of cwd with virtualMode enabled

#### Scenario: srcBackend defaults to process.cwd()
- **WHEN** createSrcBackend is called without arguments
- **THEN** it uses process.cwd() as the base path for src/

### Requirement: promptsBackend provides sandboxed access to prompts/ directory

The system SHALL provide a dedicated FilesystemBackend sandboxed to the prompts/ directory, enabling agents to read and write prompt files while preventing access to other project areas.

#### Scenario: promptsBackend sandboxed to prompts/
- **WHEN** createPromptsBackend is called with a cwd
- **THEN** it returns a FilesystemBackend with rootDir set to the prompts/ subdirectory of cwd with virtualMode enabled

#### Scenario: promptsBackend defaults to process.cwd()
- **WHEN** createPromptsBackend is called without arguments
- **THEN** it uses process.cwd() as the base path for prompts/

### Requirement: tmpBackend provides sandboxed access to tmp/ directory

The system SHALL provide a dedicated FilesystemBackend sandboxed to the tmp/ directory, enabling agents to read and write temporary files while preventing access to other project areas.

#### Scenario: tmpBackend sandboxed to tmp/
- **WHEN** createTmpBackend is called with a cwd
- **THEN** it returns a FilesystemBackend with rootDir set to the tmp/ subdirectory of cwd with virtualMode enabled

#### Scenario: tmpBackend defaults to process.cwd()
- **WHEN** createTmpBackend is called without arguments
- **THEN** it uses process.cwd() as the base path for tmp/

### Requirement: workspaceBackend provides sandboxed access to workspace/ directory

The system SHALL provide a dedicated FilesystemBackend sandboxed to the workspace/ directory, enabling agents to read and write workspace files while preventing access to other project areas.

#### Scenario: workspaceBackend sandboxed to workspace/
- **WHEN** createWorkspaceBackend is called with a cwd
- **THEN** it returns a FilesystemBackend with rootDir set to the workspace/ subdirectory of cwd with virtualMode enabled

#### Scenario: workspaceBackend defaults to process.cwd()
- **WHEN** createWorkspaceBackend is called without arguments
- **THEN** it uses process.cwd() as the base path for workspace/

### Requirement: backends are registered with correct routes in CompositeBackend

The system SHALL wire all backends into a CompositeBackend with route paths matching their directory structure under the project root.

#### Scenario: CompositeBackend routes subdirectories
- **WHEN** createDeepAgentsOrchestrator is called
- **THEN** the CompositeBackend includes routes: /src → srcBackend, /prompts → promptsBackend, /tmp → tmpBackend, /workspace → workspaceBackend, plus existing /memory contextBackend and coreBackend at "/"
