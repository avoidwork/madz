# skills-view-description-truncation Specification

## Purpose
TBD - created by archiving change ellipsize-long-skill-descriptions. Update Purpose after archive.
## Requirements
### Requirement: Skills view truncates long descriptions
The system SHALL truncate a skill description in the skills view when it exceeds a fixed character threshold, appending an ellipsis (`…`) to the truncated text. The threshold SHALL be defined as a named constant. The underlying description data SHALL NOT be mutated.

#### Scenario: Description under the threshold renders unchanged
- **WHEN** a skill description is shorter than the threshold
- **THEN** the skills view renders the description verbatim without truncation

#### Scenario: Description over the threshold is truncated with an ellipsis
- **WHEN** a skill description exceeds the threshold
- **THEN** the skills view renders the first N characters of the description followed by an ellipsis (`…`), where N is the threshold

#### Scenario: Description exactly at the threshold is not truncated
- **WHEN** a skill description is exactly the threshold length
- **THEN** the skills view renders the description verbatim without truncation

#### Scenario: Truncation does not mutate the underlying description
- **WHEN** a skill description is truncated for display
- **THEN** the underlying `skill.description` value is unchanged

