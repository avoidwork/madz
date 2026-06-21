# compaction Specification

## Purpose
TBD - created by archiving change compaction-tool-session-summarization. Update Purpose after archive.
## Requirements
### Requirement: Compaction tool produces semantic session summarization
The compaction tool SHALL produce a semantic summarization of conversation sessions, distilling history into core decisions, key design points, open questions, and next steps.

#### Scenario: Successful summarization with default thread
- **WHEN** the tool is called without a threadID
- **THEN** it reads the latest session file and returns a summary structured with Session Context, Core Decisions, Key Design Points, Open Questions, and Next Steps sections

#### Scenario: Successful summarization with specific thread
- **WHEN** the tool is called with a threadID parameter
- **THEN** it reads the specified session file and returns a summary for that thread

#### Scenario: Summarization limited to max messages
- **WHEN** the tool is called with a maxMessages parameter
- **THEN** it limits the summary to the specified number of messages

### Requirement: Compaction output uses marker-based parsing
The compaction tool SHALL parse output from the spawned node process using a `# Compaction` marker to separate thinking/reasoning from the final summary.

#### Scenario: Marker present with content after it
- **WHEN** the spawned process outputs content with a `# Compaction` marker followed by summary content
- **THEN** the tool returns `{ ok: true, summary: "# Compaction\n\n<content after marker>" }`

#### Scenario: Marker absent from output
- **WHEN** the spawned process outputs content without a `# Compaction` marker
- **THEN** the tool returns `{ ok: false, summary: "", error: "Compaction marker not found in output" }`

#### Scenario: Marker present but no content after it
- **WHEN** the spawned process outputs a `# Compaction` marker with no content following it
- **THEN** the tool returns `{ ok: false, summary: "", error: "Compaction marker found but no summary content after it" }`

#### Scenario: Multiple markers in output
- **WHEN** the spawned process outputs multiple `# Compaction` markers
- **THEN** the tool takes only the first split after the marker (index[1]) and discards everything before it

#### Scenario: Thinking/reasoning before marker
- **WHEN** the spawned process outputs thinking/reasoning content before the `# Compaction` marker
- **THEN** the tool discards all content before the marker and returns only the summary after it

### Requirement: Compaction tool spawns node process with error handling
The compaction tool SHALL spawn a node process to handle file I/O and summarization, with proper timeout and error handling.

#### Scenario: Process spawns successfully
- **WHEN** the tool is called and the node process spawns successfully
- **THEN** the tool captures stdout, waits for the process to exit, and parses the output

#### Scenario: Process times out
- **WHEN** the spawned process exceeds the 60-second timeout
- **THEN** the tool returns `{ ok: false, summary: "", error: "Process spawn error: <timeout message>" }`

#### Scenario: Process spawn fails
- **WHEN** the node process fails to spawn (e.g., file not found)
- **THEN** the tool returns `{ ok: false, summary: "", error: "Process spawn error: <error message>" }`

#### Scenario: Process exits with error output
- **WHEN** the spawned process exits with stderr content
- **THEN** the tool includes stderr in the error message: `<error> | stderr: <stderr content>`

### Requirement: Compaction tool integrates with tool registry
The compaction tool SHALL be registered in the existing tool registry (`src/tools/index.js`) with an empty permissions array.

#### Scenario: Tool is registered without permissions
- **WHEN** the application initializes the tool registry
- **THEN** the compaction tool is available with `TOOL_PERMISSIONS: []`

#### Scenario: Tool is registered with other permissions
- **WHEN** the application initializes the tool registry with other permissions
- **THEN** the compaction tool is still available and functional

### Requirement: Compaction tool has LangChain tool interface
The compaction tool SHALL implement the LangChain Tool interface with a zod schema for input validation.

#### Scenario: Tool has correct name
- **WHEN** the tool is created via `createCompactionTool()`
- **THEN** the tool's name is "compaction"

#### Scenario: Tool has description
- **WHEN** the tool is created via `createCompactionTool()`
- **THEN** the tool has a description explaining its purpose (semantic summarization of sessions)

#### Scenario: Tool has zod schema
- **WHEN** the tool is created via `createCompactionTool()`
- **THEN** the tool has a zod schema with optional `threadID` (string) and `maxMessages` (positive integer) parameters

#### Scenario: Tool uses default sessions directory
- **WHEN** the tool is created without a sessionsDir parameter
- **THEN** it uses the default sessions directory "memory/sessions/"

#### Scenario: Tool uses custom sessions directory
- **WHEN** the tool is created with a sessionsDir parameter
- **THEN** it uses the provided sessions directory path

