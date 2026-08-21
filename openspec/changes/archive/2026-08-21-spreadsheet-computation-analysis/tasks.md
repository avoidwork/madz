# Tasks: Spreadsheet Computation and Analysis

## 1. Setup

- [ ] 1.1 Add dependencies (exceljs, csv-parse, csv-stringify) to package.json and run npm install
- [ ] 1.2 Create directory structure: src/tools/spreadsheet/ and tests/unit/tools/spreadsheet/

## 2. Formula Parser

- [ ] 2.1 Implement recursive descent parser for spreadsheet formulas (src/tools/spreadsheet/formulaParser.js)
- [ ] 2.2 Add support for arithmetic operators, cell references, cell ranges, and string literals
- [ ] 2.3 Implement built-in functions: SUM, AVERAGE, COUNT, MIN, MAX, ROUND, IF, ABS, SQRT
- [ ] 2.4 Add error handling for division by zero, circular references, and invalid formulas

## 3. Statistical Operations

- [ ] 3.1 Implement mean, median, mode, stddev, variance, and percentile functions (src/tools/spreadsheet/stats.js)
- [ ] 3.2 Handle null/undefined values in statistical calculations
- [ ] 3.3 Add date range grouping (month, quarter, year) for time-series data

## 4. CSV Import/Export

- [ ] 4.1 Implement csvImport() with configurable delimiter, quote char, and encoding (src/tools/spreadsheet/csv.js)
- [ ] 4.2 Implement csvExport() with configurable options (header row, delimiter, quoting)
- [ ] 4.3 Support CSV↔JSON↔XLSX format conversion
- [ ] 4.4 Handle escaped characters and multiline fields

## 5. Pivot Table Logic

- [ ] 5.1 Implement pivot table generation with configurable keys and aggregations (src/tools/spreadsheet/pivot.js)
- [ ] 5.2 Support aggregation methods: sum, count, avg, min, max
- [ ] 5.3 Implement filter operations with condition expressions
- [ ] 5.4 Handle large datasets (10,000+ rows) with memory-efficient processing

## 6. Main Spreadsheet Tool

- [ ] 6.1 Implement compute() function — run calculations on structured data (src/tools/spreadsheet/spreadsheet.js)
- [ ] 6.2 Implement generate() function — create new XLSX files with formulas and formatting
- [ ] 6.3 Implement analyze() function — pivot tables, filtering, statistical operations
- [ ] 6.4 Implement modify() function — open existing XLSX, apply transformations, save back
- [ ] 6.5 Implement export() function — unified export endpoint (XLSX, CSV, JSON)
- [ ] 6.6 Add zod input schemas for all public functions
- [ ] 6.7 Add JSDoc comments with @param and @returns on all public APIs

## 7. Tool Registration

- [ ] 7.1 Register spreadsheet tool in src/tools/index.js with TOOL_PERMISSIONS (filesystem:read, filesystem:write)
- [ ] 7.2 Add TOOL_CLASSIFICATION (feature)
- [ ] 7.3 Wire tool into deepAgents tool configuration

## 8. Unit Tests

- [ ] 8.1 Write tests for formula parser (formulaParser.test.js)
- [ ] 8.2 Write tests for statistical operations (stats.test.js)
- [ ] 8.3 Write tests for CSV import/export (csv.test.js)
- [ ] 8.4 Write tests for pivot table logic (pivot.test.js)
- [ ] 8.5 Write tests for main spreadsheet tool (spreadsheet.test.js)

## 9. Integration Tests

- [ ] 9.1 Write integration test for full tool workflow (input → compute → output)
- [ ] 9.2 Write integration test for spreadsheet generation with formula preservation

## 10. Documentation

- [ ] 10.1 Update AGENTS.md section 2.0 with spreadsheet tool in project layout
- [ ] 10.2 Add spreadsheet tool to README.md tools section