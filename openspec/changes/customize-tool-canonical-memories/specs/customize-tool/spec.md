## ADDED Requirements

### Requirement: Customize Tool Detects Empty Context Directory
The `customize` tool SHALL check whether `memory/context/` directory exists and contains zero `.md` files. If the directory does not exist, the tool creates it. If the directory contains one or more `.md` files, the tool reports success with a message indicating profile already exists and exits without prompting.

#### Scenario: Customize tool detects empty context directory
- **WHEN** the user invokes `customize` and `memory/context/` contains no `.md` files
- **THEN** the tool creates the directory if needed and begins the Q&A session

#### Scenario: Customize tool skips on existing context
- **WHEN** the user invokes `customize` and `memory/context/` contains one or more `.md` files
- **THEN** the tool returns success without starting the Q&A session

### Requirement: Customize Tool Conducts Interactive Q&A
The `customize` tool SHALL prompt the user with a sequence of questions covering identity, preferences, and personal information, collecting responses into a structured set of fields via a readline-based interactive session. Questions are grouped into three categories matching the output file structure.

#### Scenario: Customize tool prompts for identity fields
- **WHEN** the Q&A session is running and enters the identity group
- **THEN** the tool prompts for: name (required), handle or nickname (optional), date of birth (optional), location/city (optional), relationship status (optional)
- **THEN** each question is presented one at a time with a clear prompt label

#### Scenario: Customize tool prompts for preference fields
- **WHEN** the Q&A session is running and enters the preferences group
- **THEN** the tool prompts for: timezone (optional), preferred language (optional), dietary restrictions (optional), communication tone preference (optional), preferred response length (optional)
- **THEN** each question is presented one at a time with a clear prompt label

#### Scenario: Customize tool prompts for personal fields
- **WHEN** the Q&A session is running and enters the personal group
- **THEN** the tool prompts for: pets (optional), hobbies/interests (optional), notable life events or milestones (optional), free-form insights (optional)
- **THEN** each question is presented one at a time with a clear prompt label

#### Scenario: User skips optional questions
- **WHEN** the user presses Enter without typing a response for any optional question
- **THEN** the tool records the field as `"not provided"` in the output file

#### Scenario: User skips mandatory questions
- **WHEN** the user presses Enter without typing a response for the name field
- **THEN** the tool rejects the empty input and re-prompts until a non-empty value is given

### Requirement: Customize Tool Writes Canonical Memory Files
The `customize` tool SHALL write collected responses to three markdown files under `memory/context/`: `user-profile.md`, `preferences.md`, and `personal.md`. Each file uses YAML frontmatter for structured data and a markdown body for human-readable content. The tool never overwrites an existing file — if a file already exists, the tool reads its frontmatter, merges with new data (skipping fields already filled), and only re-prompts for missing fields.

#### Scenario: Tool writes user-profile.md with frontmatter
- **WHEN** the Q&A session completes identity questions
- **THEN** `memory/context/user-profile.md` is created with YAML frontmatter containing name, handle, dob, location, and relationshipStatus fields
- **THEN** the markdown body contains a human-readable summary of the profile

#### Scenario: Tool writes preferences.md with frontmatter
- **WHEN** the Q&A session completes preferences questions
- **THEN** `memory/context/preferences.md` is created with YAML frontmatter containing timezone, language, dietaryRestrictions, tone, and responseLength fields
- **THEN** the markdown body contains a human-readable summary of preferences

#### Scenario: Tool writes personal.md with frontmatter
- **WHEN** the Q&A session completes personal questions
- **THEN** `memory/context/personal.md` is created with YAML frontmatter containing pets, hobbies, milestones, and insights fields
- **THEN** the markdown body contains a human-readable summary of personal details

#### Scenario: Tool skips already-filled fields
- **WHEN** `memory/context/user-profile.md` already exists with name and location filled
- **THEN** the tool reads the existing YAML frontmatter, skips prompts for those fields, and only re-prompts for handle, dob, and relationshipStatus
- **THEN** the tool writes the merged data back to the file preserving existing filled values

### Requirement: Customize Tool Updates Memory Index
The `customize` tool SHALL append entries for each new or modified memory file to `memory/_index.md`. Each entry includes the file path, a short title derived from the filename, and a timestamp.

#### Scenario: Index is updated with new file entries
- **WHEN** the customize tool finishes writing all three context files
- **THEN** `memory/_index.md` receives three new entries with path, title, and timestamp frontmatter fields
- **THEN** entries are appended using the same format as existing index entries defined in the memory-system spec

#### Scenario: Index creation when it does not exist
- **WHEN** `memory/_index.md` does not exist at the time of customization
- **THEN** the tool creates the index file with YAML frontmatter and the three new entries
