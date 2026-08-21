# Design: Spreadsheet Computation and Analysis

## Overview

This change adds a comprehensive spreadsheet computation and analysis tool to the Madz AI harness. The tool provides compute, generate, analyze, CSV import/export, modify, and export capabilities for spreadsheet data, built on top of `exceljs` for formula-preserving XLSX support.

## Architecture

```
src/tools/spreadsheet/
├── spreadsheet.js        # Main tool entry point (single file)
├── formulaParser.js      # Safe recursive descent formula parser
├── pivot.js              # Pivot table logic
├── csv.js                # CSV import/export helpers
└── stats.js              # Statistical operations (mean, median, etc.)
```

## Module Design

### spreadsheet.js (Main Tool)

The main tool file follows the existing tool pattern in `src/tools/index.js`. It exposes six function groups:

```javascript
// Compute: run calculations on data
export async function compute(data, operations)

// Generate: create new spreadsheets with formulas
export async function generate(spec)

// Analyze: pivot tables, filtering, aggregation
export async function analyze(data, config)

// CSV import/export
export async function csvImport(filePath, options)
export async function csvExport(data, filePath, options)

// Modify existing XLSX
export async function modify(filePath, transformations)

// Unified export
export async function export(data, format, filePath)
```

Each function accepts a zod input schema and returns structured JSON output.

### formulaParser.js

A safe recursive descent parser for spreadsheet formulas. Handles:

- Basic arithmetic: `+`, `-`, `*`, `/`, `^`
- Cell references: `A1`, `B2`, `C3`
- Built-in functions: `SUM()`, `AVERAGE()`, `COUNT()`, `MIN()`, `MAX()`, `ROUND()`, `IF()`, `ABS()`, `SQRT()`
- Cell range references: `A1:A10`
- String literals: `"text"`
- Boolean values: `TRUE`, `FALSE`

**No `eval()` usage.** All formulas are parsed into an AST and evaluated safely.

### pivot.js

Pivot table logic using lodash's `groupBy` for aggregation:

```javascript
// Group data by one or more keys, apply aggregation functions
function pivot(data, { groupBy, aggregations })

// aggregations: [{ column, method: 'sum' | 'count' | 'avg' | 'min' | 'max' }]
```

### csv.js

CSV import/export using `csv-parse` and `csv-stringify`:

```javascript
// Import: file path → JSON array
function csvImport(filePath, { delimiter, encoding, quote })

// Export: JSON array → file path
function csvExport(data, filePath, { delimiter, encoding, quote })
```

### stats.js

Statistical operations:

```javascript
// Basic statistics
function mean(values)
function median(values)
function mode(values)
function stdDev(values)
function variance(values)
function percentile(values, p)
```

## Data Flow

1. **Input**: User provides data as JSON array, file path, or CSV content
2. **Processing**: Tool parses input, applies operations (compute, analyze, etc.)
3. **Output**: Results returned as JSON, or written to file (XLSX/CSV)

## Error Handling

- File not found → `NotFoundError` with path
- Invalid formula → `FormulaError` with expression and error message
- Invalid CSV → `CsvError` with line number and reason
- File too large (>100MB) → `FileSizeError` with size limit
- All errors logged at structured JSON level (no `console.log`)

## Security Considerations

- **No `eval()`**: All formula parsing uses recursive descent parser
- **Input validation**: All user input validated via zod schemas
- **File path validation**: Paths validated against allowlist, no `file://` schemes
- **Memory limits**: Files >100MB rejected to prevent memory exhaustion
- **Timeout**: All file operations have configurable timeout (default: 30s)

## Testing Strategy

- Unit tests for formula parser (edge cases: nested functions, invalid syntax)
- Unit tests for pivot logic (grouping, aggregation, empty data)
- Unit tests for CSV import/export (various delimiters, encodings)
- Unit tests for statistical functions (known values, edge cases)
- Integration tests for full tool workflow (input → compute → output)
- Tests mirror `src/tools/spreadsheet/` structure in `tests/unit/tools/spreadsheet/`

## Migration Notes

- New dependency: `exceljs`, `csv-parse`, `csv-stringify`
- New tool registered in `src/tools/index.js` with `TOOL_PERMISSIONS` and `TOOL_CLASSIFICATIONS`
- No breaking changes to existing tools