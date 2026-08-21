# Tasks: Spreadsheet Computation and Analysis

## Task 1: Add dependencies

Add `exceljs`, `csv-parse`, and `csv-stringify` to package.json dependencies. Run `npm install`.

## Task 2: Create formula parser

Implement `src/tools/spreadsheet/formulaParser.js` with a recursive descent parser for spreadsheet formulas. Handle basic arithmetic, cell references, built-in functions (SUM, AVERAGE, COUNT, MIN, MAX, ROUND, IF, ABS, SQRT), cell ranges, string literals, and booleans. No eval() usage.

## Task 3: Create statistical operations

Implement `src/tools/spreadsheet/stats.js` with mean, median, mode, stdDev, variance, and percentile functions.

## Task 4: Create CSV import/export

Implement `src/tools/spreadsheet/csv.js` using csv-parse and csv-stringify. Support configurable delimiters, encodings, and quoting options.

## Task 5: Create pivot table logic

Implement `src/tools/spreadsheet/pivot.js` using lodash groupBy for aggregation. Support sum, count, avg, min, max aggregation methods.

## Task 6: Create main spreadsheet tool

Implement `src/tools/spreadsheet/spreadsheet.js` with six function groups: compute(), generate(), analyze(), csvImport(), csvExport(), modify(), and export(). Each with zod input schemas.

## Task 7: Register tool in index.js

Add the spreadsheet tool to `src/tools/index.js` with TOOL_PERMISSIONS (filesystem:read, filesystem:write) and TOOL_CLASSIFICATIONS.

## Task 8: Write unit tests

Write unit tests in `tests/unit/tools/spreadsheet/` covering formula parser, stats, CSV, pivot, and the main spreadsheet tool.

## Task 9: Write integration tests

Write integration tests for full tool workflow (input → compute → output).

## Task 10: Update AGENTS.md

Add the spreadsheet tool to the project layout in AGENTS.md section 2.0.