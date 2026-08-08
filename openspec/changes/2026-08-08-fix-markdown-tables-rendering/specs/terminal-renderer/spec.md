# terminal-renderer Specification

## Delta: Table Cell Delimiter Contract

### Requirement: Table cell delimiter format
The `tablecell()` renderer method SHALL wrap each cell's inline-parsed content with the delimiter `^*||*^` (caret, asterisk, two pipes, asterisk, caret).

### Requirement: Table row parsing regex
The `generateTableRow()` function SHALL split cell content using the regex `/\^[*]+\|[|]+[*^]/` to match one or more pipes between the asterisks in the cell delimiter.

#### Scenario: Table with 3 columns renders correctly
- **WHEN** markdown contains a table with 3 header columns and 2 data rows
- **THEN** each row is correctly split into 3 cells and rendered via `cli-table3` with proper borders and alignment

#### Scenario: Table with 2 columns renders correctly
- **WHEN** markdown contains a table with 2 header columns
- **THEN** each row is correctly split into 2 cells

#### Scenario: Table with empty cells renders correctly
- **WHEN** markdown contains a table with empty cells (e.g., `| a | | c |`)
- **THEN** empty cells are preserved as empty strings in the output
