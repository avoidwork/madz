## ADDED Requirements

### Requirement: File-producing tools resolve output directory from config.memory.toolsDir
The file-producing tools (`clarify`, `generatePptx`, `generatePdf`, `spreadsheet`, `tts`) SHALL resolve their output directory from `config.memory.toolsDir` via `loadConfig()`, defaulting to `memory/tools/` when the config value is absent.

#### Scenario: generatePptx defaults outputPath to toolsDir
- **WHEN** `generatePptx` is invoked without an `outputPath`
- **THEN** the output file is written under `config.memory.toolsDir` (default `memory/tools/`)

#### Scenario: generatePdf defaults outputPath to toolsDir
- **WHEN** `generatePdf` is invoked without an `outputPath`
- **THEN** the output file is written under `config.memory.toolsDir` (default `memory/tools/`)

#### Scenario: spreadsheet defaults outputPath to toolsDir
- **WHEN** the `spreadsheet` tool is invoked without an `outputPath`
- **THEN** the output file is written under `config.memory.toolsDir` (default `memory/tools/`)

#### Scenario: tts writes to toolsDir
- **WHEN** the `textToSpeech` tool generates audio
- **THEN** the audio file is written under `config.memory.toolsDir` (default `memory/tools/`), not `~/voice-memos`

### Requirement: clarify writes clarifications to toolsDir
The `clarify` tool SHALL write `clarifications.md` to `config.memory.toolsDir` (default `memory/tools/`) via `loadConfig()` when no `clarificationsFile` option is provided.

#### Scenario: clarify writes to toolsDir by default
- **WHEN** the `clarify` tool is invoked without a `clarificationsFile` option
- **THEN** the clarification entry is appended to `memory/tools/clarifications.md`

#### Scenario: clarify preserves explicit clarificationsFile override
- **WHEN** the `clarify` tool is invoked with a `clarificationsFile` option
- **THEN** the clarification entry is appended to the provided path

### Requirement: loadContext excludes clarifications.md
The `loadContext()` function SHALL no longer include `clarifications.md` in the system-prompt concatenation because the file is relocated to `memory/tools/`.

#### Scenario: clarifications.md absent from context
- **WHEN** `loadContext()` reads `memory/context/`
- **THEN** `clarifications.md` is not among the loaded `.md` files

### Requirement: SYSTEM_PROMPT.md fallback directive
The `SYSTEM_PROMPT.md` SHALL include a fallback directive instructing tools to save outputs to `memory/tools/` when a tool does not handle the concern itself.

#### Scenario: Fallback directive present
- **WHEN** `SYSTEM_PROMPT.md` is loaded
- **THEN** it contains a directive stating tool outputs should be saved to `memory/tools/` when a tool does not handle the concern itself
