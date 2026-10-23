## MODIFIED Requirements

### Requirement: Rotating window list
The system SHALL render up to 3 visible options at a time with a rotating window, using the `▸` indicator, so up/down scrolls through all results while 3 are visible. When the filter matches no files, the system SHALL render nothing below the input line — no empty message and no list entries — so the typed input line is never obscured.

#### Scenario: Up to 3 options visible
- **WHEN** there are more than 3 matching files
- **THEN** only 3 options are visible at a time

#### Scenario: Navigation scrolls through all results
- **WHEN** the user presses down past the last visible option
- **THEN** the window rotates to show the next options

#### Scenario: No message rendered when filter has no matches
- **WHEN** the `@` filter matches no files (e.g., a typo like `@src/confg`)
- **THEN** the file picker renders nothing below the input line — no " No matching files." message and no list entries — so the typed input remains visible and unobscured
