# spreadsheet-computation Specification

## Purpose
TBD - created by archiving change spreadsheet-computation-analysis. Update Purpose after archive.
## Requirements
### Requirement: Safe formula evaluation
The system SHALL evaluate spreadsheet formulas using a recursive descent parser without using `eval()`, `new Function()`, or any dynamic code execution.

#### Scenario: Basic arithmetic formula
- **WHEN** a formula like `=A1+B1*2` is evaluated with A1=10, B1=5
- **THEN** the system returns 20

#### Scenario: Built-in function SUM
- **WHEN** a formula like `=SUM(A1:A5)` is evaluated with values [1, 2, 3, 4, 5]
- **THEN** the system returns 15

#### Scenario: Invalid formula syntax
- **WHEN** a malformed formula like `=SUM(A1:INVALID` is provided
- **THEN** the system throws a descriptive FormulaError with the expression and error location

### Requirement: Compute operations
The system SHALL accept structured data (JSON array, file path, or CSV content) and run aggregate or custom formula operations.

#### Scenario: Compute from JSON data
- **WHEN** a JSON array of objects and an operation like `{ column: "price", operation: "sum" }` is provided
- **THEN** the system returns the computed result

#### Scenario: Compute from file path
- **WHEN** a file path to a CSV or XLSX file and an operation are provided
- **THEN** the system reads the file, parses the data, and returns the computed result

### Requirement: Generate spreadsheets
The system SHALL create new XLSX files with formulas, formatting, and multiple sheets.

#### Scenario: Generate single sheet with formulas
- **WHEN** a spec with one sheet, cell values, and formulas is provided
- **THEN** the system creates an XLSX file with the specified content and preserved formulas

#### Scenario: Generate multi-sheet workbook
- **WHEN** a spec with multiple sheets is provided
- **THEN** the system creates an XLSX file with all specified sheets

### Requirement: Analyze data (pivot tables)
The system SHALL perform pivot tables, filtering, and statistical operations on structured data.

#### Scenario: Pivot by single key
- **WHEN** data grouped by a single key with aggregation `{ method: "sum", column: "amount" }` is provided
- **THEN** the system returns pivot results grouped by that key

#### Scenario: Pivot by multiple keys
- **WHEN** data grouped by multiple keys with aggregations is provided
- **THEN** the system returns pivot results grouped by all specified keys

### Requirement: CSV import
The system SHALL read CSV files with configurable delimiters, encodings, and quoting options.

#### Scenario: Import standard CSV
- **WHEN** a standard CSV file path is provided with default options
- **THEN** the system returns a JSON array of objects with parsed values

#### Scenario: Import CSV with custom delimiter
- **WHEN** a CSV file with semicolon delimiter is provided with `{ delimiter: ";" }`
- **THEN** the system correctly parses the columns

### Requirement: CSV export
The system SHALL write CSV files with configurable delimiters, encodings, and quoting options.

#### Scenario: Export to CSV
- **WHEN** a JSON array and output file path are provided
- **THEN** the system writes a valid CSV file

#### Scenario: Export with custom delimiter
- **WHEN** a JSON array, output path, and `{ delimiter: ";" }` are provided
- **THEN** the system writes a CSV file with semicolon delimiters

### Requirement: Modify existing XLSX
The system SHALL open an existing XLSX file, apply transformations, and save back with formulas preserved.

#### Scenario: Add a cell with formula
- **WHEN** a file path and transformation `{ sheet: "Sheet1", cell: "C1", formula: "=A1+B1" }` is provided
- **THEN** the system updates the file with the new formula preserved

#### Scenario: Delete a sheet
- **WHEN** a file path and transformation `{ sheet: "TempSheet", action: "delete" }` is provided
- **THEN** the system removes the specified sheet and saves the file

### Requirement: Unified export
The system SHALL accept internal data representation and output XLSX, CSV, or JSON formats.

#### Scenario: Export to XLSX
- **WHEN** data and format "xlsx" with a file path are provided
- **THEN** the system writes an XLSX file

#### Scenario: Export to JSON
- **WHEN** data and format "json" with a file path are provided
- **THEN** the system writes a JSON file

### Requirement: File size limit
The system SHALL reject files larger than 100MB with a FileSizeError.

#### Scenario: File exceeds size limit
- **WHEN** a file larger than 100MB is provided
- **THEN** the system throws a FileSizeError with the file size and limit

### Requirement: Error handling for edge cases
The system SHALL handle common spreadsheet edge cases gracefully without crashing.

#### Scenario: Division by zero
- **WHEN** a formula like `=A1/0` is evaluated with A1=10
- **THEN** the system returns an error value (e.g., `#DIV/0!`) instead of crashing

#### Scenario: Circular reference detection
- **WHEN** a formula creates a circular reference (e.g., cell A1 references itself)
- **THEN** the system detects the circular reference and returns an error value (e.g., `#REF!`)

#### Scenario: Null/undefined values in aggregation
- **WHEN** a dataset contains null or undefined values in a column being aggregated
- **THEN** the system skips null/undefined values in the aggregation (e.g., SUM ignores nulls)

#### Scenario: Special characters in sheet names
- **WHEN** a sheet name contains special characters (e.g., "Sales & Marketing")
- **THEN** the system properly escapes the sheet name in formulas (e.g., `'Sales & Marketing'!A1`)

#### Scenario: Maximum row/column limits
- **WHEN** a spreadsheet exceeds Excel's limits (1,048,576 rows or 16,384 columns)
- **THEN** the system throws a FileSizeError or SheetLimitError with the exceeded limit

### Requirement: Date range grouping
The system SHALL support grouping data by date ranges (month, quarter, year) for pivot tables.

#### Scenario: Group by month
- **WHEN** data with date fields is grouped by month with an aggregation
- **THEN** the system returns pivot results grouped by month (e.g., "2024-01", "2024-02")

#### Scenario: Group by quarter
- **WHEN** data with date fields is grouped by quarter with an aggregation
- **THEN** the system returns pivot results grouped by quarter (e.g., "Q1 2024", "Q2 2024")

### Requirement: Round-trip format conversion
The system SHALL preserve data types and values when converting between formats.

#### Scenario: CSV → XLSX → CSV round-trip
- **WHEN** a CSV file is converted to XLSX and back to CSV
- **THEN** the values are preserved (numeric values remain numeric, text remains text)

#### Scenario: XLSX → JSON → XLSX round-trip
- **WHEN** an XLSX file is converted to JSON and back to XLSX
- **THEN** the formulas and values are preserved in the output XLSX

### Requirement: Tool registration
The system SHALL register the spreadsheet tool in `src/tools/index.js` with appropriate permissions and classifications.

#### Scenario: Tool has correct permissions
- **WHEN** the spreadsheet tool is registered
- **THEN** it has `filesystem:read` and `filesystem:write` permissions

#### Scenario: Tool has correct classification
- **WHEN** the spreadsheet tool is registered
- **THEN** it is classified as a `feature` tool

