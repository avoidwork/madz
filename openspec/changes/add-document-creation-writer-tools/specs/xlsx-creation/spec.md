# xlsx-creation Specification

## Purpose
Define the requirements for creating XLSX files from structured tabular data within the madz agent.

## Requirements

### Requirement: Create XLSX from tabular data
The system SHALL accept an array of arrays (tabular data) and produce a valid `.xlsx` file with proper cell formatting.

#### Scenario: Create spreadsheet from 2D array
- **WHEN** a 2D array of values is provided
- **THEN** the system outputs an XLSX file with each row and column mapped to cells

#### Scenario: Create spreadsheet with header row
- **WHEN** the first row of data contains string values intended as headers
- **THEN** the system outputs an XLSX file with bold-formatted header cells

#### Scenario: Create spreadsheet with numeric data
- **WHEN** numeric values are provided in cells
- **THEN** the system outputs an XLSX file with numeric cell types (not text)

### Requirement: Create XLSX with formulas
The system SHALL accept formulas in cell values and produce an XLSX file with working formulas.

#### Scenario: Insert SUM formula
- **WHEN** a cell value is a formula string (e.g., "=SUM(A1:A5)")
- **THEN** the system outputs an XLSX file with the formula preserved and evaluated by spreadsheet software

#### Scenario: Insert AVERAGE formula
- **WHEN** a cell value is a formula string (e.g., "=AVERAGE(B2:B10)")
- **THEN** the system outputs an XLSX file with the formula preserved

### Requirement: Create XLSX with multiple sheets
The system SHALL accept an object with multiple sheet definitions and produce an XLSX file with multiple sheets.

#### Scenario: Create workbook with two sheets
- **WHEN** an object with `sheets` array containing two sheet definitions is provided
- **THEN** the system outputs an XLSX file with two sheets named according to the definitions

### Requirement: Tool output format
The system SHALL return `{ filePath, format, size }` on successful creation.

#### Scenario: Return file metadata
- **WHEN** an XLSX file is successfully created
- **THEN** the system returns an object with `filePath` (absolute path), `format` ("xlsx"), and `size` (file size in bytes)