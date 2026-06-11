## ADDED Requirements

### Requirement: Reflection skill discovers sessions from the last 7 days
The Reflection skill SHALL read all `.md` session files from `memory/sessions/`, filter to sessions where `startedAt` is within the last 7 days from the current time, and sort the remaining sessions by `startedAt` in descending order (most recent first).

#### Scenario: Filter out sessions older than 7 days
- **WHEN** the skill receives files with `startedAt` values spanning the last 14 days
- **THEN** only sessions with `startedAt` within the last 7 days are included in the summary

#### Scenario: Sort by most recent first
- **WHEN** the skill processes multiple sessions within the 7-day window
- **THEN** sessions are ordered with the most recent `startedAt` appearing first in the output sequence

#### Scenario: Handle missing frontmatter gracefully
- **WHEN** a session file exists but lacks a valid `startedAt` field in its frontmatter
- **THEN** the session is excluded from the reflection and no error is raised

### Requirement: Reflection generates a narrative summary of session energy
The Reflection skill SHALL produce a concise narrative summary describing the qualitative experience of interactions in each session. The summary SHALL NOT reproduce factual content, technical decisions, or step-by-step details. Instead, it SHALL capture the mood, energy, and rhythm of the user-agent dynamic.

#### Scenario: Include energy and mood description
- **WHEN** the skill processes a session with a clearly enthusiastic user
- **THEN** the summary mentions the energetic tone (e.g., "high energy", "curious and playful")

#### Scenario: Exclude granular technical details
- **WHEN** a session contains detailed technical debugging or code work
- **THEN** the summary references the nature of the work at a high level (e.g., "tinkering on TUI bugs") without reproducing steps or code

#### Scenario: Produce a cohesive narrative
- **WHEN** there are multiple sessions within the window
- **THEN** the output reads as a flowing narrative connecting the sessions chronologically

### Requirement: Reflection is written to memory/context/reflection.md
The Reflection skill SHALL write its output to `memory/context/reflection.md` with frontmatter containing `updatedDate` and `timestamp` fields. The `timestamp` field SHALL mirror `updatedDate` to ensure the context loader picks up the file alongside other context entries.

#### Scenario: Write reflection with frontmatter
- **WHEN** the skill finishes generating the summary
- **THEN** `memory/context/reflection.md` is created or overwritten with a document containing frontmatter (`updatedDate`, `timestamp`) and a prose body

#### Scenario: Overwrite existing reflection
- **WHEN** `memory/context/reflection.md` already exists from a previous run
- **THEN** the file is replaced entirely with the new summary

#### Scenario: Context loader picks up the file
- **WHEN** the context loader reads from `memory/context/`
- **THEN** `reflection.md` is included in the loaded context files alongside `profile.md` and other `.md` files

### Requirement: Reflection produces bounded output
The Reflection skill SHALL limit its output to approximately 200-400 words and SHALL NOT exceed 5 kB (20k tokens) in total file size including frontmatter. The skill SHALL prioritize the most recent sessions when the number of sessions or total interaction volume is large.

#### Scenario: Limit output length
- **WHEN** there are many sessions (>5) within the 7-day window
- **THEN** the summary condenses older sessions into brief mentions while giving more detail to recent ones

#### Scenario: Empty session window
- **WHEN** no sessions exist within the last 7 days
- **THEN** `memory/context/reflection.md` is written with only frontmatter (`updatedDate`, `timestamp`) and no body content

#### Scenario: Truncate if exceeding size limit
- **WHEN** the generated summary would exceed 5 kB total file size
- **THEN** the skill truncates the output, omitting oldest sessions first, to ensure the final file stays within the limit
