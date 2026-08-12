# xlsx-extraction Specification

## Purpose
TBD - created by archiving change file-format-extraction-tools. Update Purpose after archive.
## Requirements
### Requirement: XLSX to markdown table conversion
The system SHALL convert `.xlsx` spreadsheets to markdown tables, preserving cell values, column headers, and row structure.

#### Scenario: Extract single-sheet xlsx to markdown
- **WHEN** a single-sheet xlsx file is provided
- **THEN** the system outputs a markdown table with headers from the first row and data from subsequent rows

#### Scenario: Extract multi-sheet xlsx to markdown
- **WHEN** a multi-sheet xlsx file is provided
- **THEN** the system outputs separate markdown tables for each sheet, separated by sheet name headers

#### Scenario: Handle empty xlsx file
- **WHEN** an empty xlsx file is provided
- **THEN** the system returns an empty string

#### Scenario: Handle numeric cell values
- **WHEN** a cell contains a numeric value
- **THEN** the system outputs the numeric value as a string in the markdown table

#### Scenario: Handle merged cells
- **WHEN** a cell is merged with another cell
- **THEN** the system outputs the value in the top-left cell position and empty strings for merged positions

### Requirement: XLSX to JSON conversion
The system SHALL convert `.xlsx` spreadsheets to JSON, preserving cell values, types, and sheet structure.

#### Scenario: Extract xlsx to JSON with sheet names
- **WHEN** a multi-sheet xlsx file is provided
- **THEN** the system returns a JSON object with sheet names as keys and arrays of row objects as values

#### Scenario: Preserve cell data types in JSON
- **WHEN** a cell contains a number, string, or boolean value
- **THEN** the system preserves the original data type in the JSON output

#### Scenario: Handle empty rows in JSON output
- **WHEN** an xlsx file has empty rows
- **THEN** the system includes empty row objects in the JSON output

