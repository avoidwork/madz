## ADDED Requirements

### Requirement: Rotating quote in status bar
The system SHALL display a rotating quote in the bottom status bar, positioned to the left of the version number on the right side. The quote SHALL change at a fixed interval of approximately 2 minutes, chosen at random, and SHALL NOT repeat the immediately-previous quote.

#### Scenario: Status bar displays a quote to the left of the version
- **WHEN** the status bar is rendered in normal mode
- **THEN** the quote is displayed to the left of the version number, with the version right-aligned

#### Scenario: Quote rotates at a fixed interval
- **WHEN** approximately 2 minutes elapse while the status bar is visible
- **THEN** the displayed quote changes to a different quote

#### Scenario: Quote does not repeat the immediately-previous quote
- **WHEN** the quote rotates
- **THEN** the newly displayed quote is not the same as the previously displayed quote

### Requirement: Curated quote list
The system SHALL ship with a finite v1 list of 25 curated real Mads Mikkelsen interview quotes, stored in a frozen array in a dedicated quotes module. The data structure SHALL be designed so a second list of character quotes can be merged in later without rewriting the rotation logic.

#### Scenario: Quote list is frozen and finite
- **WHEN** the quotes module is loaded
- **THEN** it exposes a frozen array containing exactly 25 curated real interview quotes

#### Scenario: Character quotes can be merged later
- **WHEN** a second list of character quotes is added
- **THEN** the rotation logic operates on the combined list without modification

### Requirement: Quote rotation helper
The system SHALL provide a `getRandomQuoteIndex(previousIndex, random)` helper that returns a valid index into the quote list, avoids returning the previous index when the list has more than one element, returns `0` for a single-element list, and returns `-1` for an empty list.

#### Scenario: Helper returns a valid index
- **WHEN** `getRandomQuoteIndex` is called with a previous index and a random function
- **THEN** it returns an integer index within the bounds of the quote list

#### Scenario: Helper avoids the previous index
- **WHEN** the quote list has more than one element and a previous index is provided
- **THEN** the returned index is not equal to the previous index

#### Scenario: Helper handles a single-element list
- **WHEN** the quote list contains exactly one element
- **THEN** the helper returns index `0`

#### Scenario: Helper handles an empty list
- **WHEN** the quote list is empty
- **THEN** the helper returns `-1`

### Requirement: Subtle styling and truncation
The system SHALL style the quote subtly using a muted color and SHALL truncate long quotes to fit the terminal width.

#### Scenario: Quote is styled with a muted color
- **WHEN** the quote is rendered
- **THEN** it uses a muted color consistent with the status bar's other muted elements

#### Scenario: Long quotes are truncated
- **WHEN** a quote exceeds the maximum display width
- **THEN** the quote is truncated to fit within the status bar
