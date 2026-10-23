## MODIFIED Requirements

### Requirement: Rotating window list
The system SHALL render up to 3 visible options at a time with a rotating window, using the `▸` indicator, so up/down scrolls through all results while 3 are visible. When the filter matches no files, the system SHALL render nothing (an empty list) and SHALL NOT render an empty message, so the typed input is never obscured.

#### Scenario: Up to 3 options visible
- **WHEN** there are more than 3 matching files
- **THEN** only 3 options are visible at a time

#### Scenario: Navigation scrolls through all results
- **WHEN** the user presses down past the last visible option
- **THEN** the window rotates to show the next options

#### Scenario: No empty message when filter has no matches
- **WHEN** the filter matches no files
- **THEN** the picker renders nothing below the input (an empty list) and does not render a "No matching files." message

#### Scenario: Typed input is not obscured when filter has no matches
- **WHEN** the filter matches no files
- **THEN** the typed input line remains visible and unobscured
