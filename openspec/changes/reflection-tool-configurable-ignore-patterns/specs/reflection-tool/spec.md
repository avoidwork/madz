## ADDED Requirements

### Requirement: Reflection tool reads session files
The reflection tool SHALL read session files from the `memory/sessions/` directory using Node.js `fs/promises` and return structured session data.

#### Scenario: Read sessions from memory directory
- **WHEN** the tool is called with no ignore patterns and default windowDays
- **THEN** it reads all files in `memory/sessions/` and returns structured session data

#### Scenario: Handle empty sessions directory
- **WHEN** the `memory/sessions/` directory is empty or does not exist
- **THEN** the tool returns an empty array `[]`

### Requirement: Reflection tool filters by date window
The reflection tool SHALL filter sessions by their `startedAt` date, keeping only sessions within the specified `windowDays` (default 7).

#### Scenario: Filter sessions by default 7-day window
- **WHEN** the tool is called with no windowDays parameter
- **THEN** only sessions with `startedAt` within the last 7 days are included

#### Scenario: Filter sessions by custom window
- **WHEN** the tool is called with `windowDays: 14`
- **THEN** only sessions with `startedAt` within the last 14 days are included

#### Scenario: Exclude sessions outside window
- **WHEN** the tool is called with `windowDays: 3`
- **THEN** sessions with `startedAt` older than 3 days are excluded

### Requirement: Reflection tool filters by ignore patterns
The reflection tool SHALL exclude sessions whose content (YAML frontmatter or body) matches any of the provided `ignorePatterns`.

#### Scenario: Exclude sessions matching ignore pattern in frontmatter
- **WHEN** the tool is called with `ignorePatterns: ["Run the scan-issues skill"]`
- **THEN** sessions whose frontmatter or body contains "Run the scan-issues skill" are excluded

#### Scenario: Exclude sessions matching ignore pattern in body
- **WHEN** the tool is called with `ignorePatterns: ["Run the reflection skill"]`
- **THEN** sessions whose body contains "Run the reflection skill" are excluded

#### Scenario: Multiple ignore patterns
- **WHEN** the tool is called with `ignorePatterns: ["pattern1", "pattern2"]`
- **THEN** sessions matching either pattern are excluded

#### Scenario: No ignore patterns
- **WHEN** the tool is called with an empty `ignorePatterns` array
- **THEN** no sessions are excluded based on patterns

### Requirement: Reflection tool extracts user messages
The reflection tool SHALL extract only user messages (`role === "user"`) from each session's message array.

#### Scenario: Extract only user messages
- **WHEN** a session contains messages with roles "user", "assistant", and "system"
- **THEN** only messages with `role === "user"` are included in the output

#### Scenario: Session with no user messages
- **WHEN** a session has messages but none with `role === "user"`
- **THEN** the session is included with an empty `userMessages` array

### Requirement: Reflection tool returns structured data
The reflection tool SHALL return a JSON array of session objects with `sessionId`, `startedAt`, and `userMessages` fields.

#### Scenario: Return structured session data
- **WHEN** the tool processes sessions successfully
- **THEN** each session object contains `sessionId` (UUID), `startedAt` (ISO date string), and `userMessages` (array of `{content, timestamp}`)

#### Scenario: Parse YAML frontmatter for metadata
- **WHEN** a session file has YAML frontmatter with `startedAt`
- **THEN** the `startedAt` value is extracted and used in the output

### Requirement: Reflection tool handles malformed files gracefully
The reflection tool SHALL skip malformed session files (invalid YAML or JSON) without throwing errors.

#### Scenario: Skip malformed YAML frontmatter
- **WHEN** a session file has invalid YAML frontmatter
- **THEN** the session is skipped and a warning is logged

#### Scenario: Skip malformed JSON body
- **WHEN** a session file has invalid JSON body
- **THEN** the session is skipped and a warning is logged

### Requirement: Reflection tool is registered in index.js
The reflection tool SHALL be imported and registered in `src/tools/index.js` with `filesystem:read` permission and `orchestrator` classification.

#### Scenario: Tool registered with correct permission
- **WHEN** the tool is added to `TOOL_PERMISSIONS`
- **THEN** it requires `["filesystem:read"]` permission

#### Scenario: Tool registered with correct classification
- **WHEN** the tool is added to `TOOL_CLASSIFICATIONS`
- **THEN** it is classified as `["orchestrator"]`
