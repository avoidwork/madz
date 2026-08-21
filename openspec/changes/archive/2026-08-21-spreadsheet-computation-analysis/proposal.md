# Proposal: Spreadsheet Computation and Analysis

## Summary

Add a comprehensive spreadsheet computation and analysis tool to Madz. This tool bridges the gap between the existing read-only XLSX extraction tools and the need for active spreadsheet manipulation — running calculations, generating new spreadsheets with formulas, performing data analysis, and CSV import/export.

## Motivation

The existing XLSX tool (`src/tools/fileExtract/xlsx.js`) is read-only extraction. There is no capability for running calculations on data, generating new spreadsheets with formulas, performing data analysis (pivot tables, filtering, aggregation), or CSV import/export as a standalone tool. In office workflows, spreadsheet computation is fundamental — users need to ask the agent to "calculate the average of column B," "create a pivot table by region," or "export this data as CSV." Currently the agent must fall back to shell commands or manual data handling, which is fragile and loses formula fidelity.

## Technical Approach

The spreadsheet tool will be built on top of `exceljs`, a well-maintained Node.js library that supports both reading and writing XLSX files with full formula preservation. This is critical — the existing `xlsx.js` read tool uses `xlsx-parser` which only extracts rendered values. For computation, we need a library that preserves and evaluates formulas.

The tool will be structured as a single `spreadsheet.js` file under `src/tools/spreadsheet/`, following the existing tool pattern. It will expose several function groups:

1. **compute()** — Accept structured data (JSON array, file path, or CSV content) and run aggregate or custom formula operations. Uses a safe expression evaluator (not `eval()`) for formula parsing.

2. **generate()** — Create new XLSX files with formulas, formatting, and multiple sheets. Accepts a spec object describing sheets, cells, formulas, and formatting rules.

3. **analyze()** — Perform pivot tables, filtering, and statistical operations. Uses lodash/groupby for aggregation and custom math functions for statistics.

4. **csvImport() / csvExport()** — Read/write CSV files with configurable delimiters, encodings, and quoting options.

5. **modify()** — Open an existing XLSX, apply transformations (add/modify/delete cells, sheets, formulas), and save back.

6. **export()** — Unified export endpoint that accepts the internal data representation and outputs XLSX, CSV, or JSON.

The tool will integrate with the existing file extraction pipeline by accepting file paths that the existing xlsx.js tools already know how to read. The output of `xlsx.js` (markdown tables or JSON) will serve as the canonical input for the computation tool.

## Architectural Decisions

- **exceljs over SheetJS**: exceljs has better formula preservation and is more actively maintained for Node.js server-side use. SheetJS (xlsx) is heavier and has licensing concerns for commercial use.
- **Safe formula evaluation**: Custom formulas will be parsed using a recursive descent parser rather than `eval()`, following the forbidden patterns in AGENTS.md §1.1.
- **Single tool file**: Following KISS principle, all spreadsheet operations live in one file (`src/tools/spreadsheet/spreadsheet.js`) with internal modules for formula parsing, pivot logic, and CSV handling.
- **No streaming for large files**: Per the spec, files >100MB are not supported. This keeps the implementation simple and avoids memory issues.
- **Integration with existing tools**: The spreadsheet tool accepts the same file paths as the existing xlsx.js tools, minimizing format conversion overhead.

## Non-goals

- Real-time collaborative editing (not applicable to an AI harness)
- Macro/VBA support (out of scope for a computation tool)
- Chart/graph generation (can be added later as a separate feature)
- Support for legacy .xls format (only .xlsx and .csv)
- Cloud spreadsheet integration (Google Sheets, Office 365)

## Dependencies

- `exceljs` — XLSX read/write with formula support
- `csv-parse` / `csv-stringify` — CSV import/export
- `lodash` — Already available for groupby/aggregation
- Math evaluation — Custom safe parser (no external dependency needed for basic formulas)

## Integration Points

- **src/tools/fileExtract/xlsx.js** — Existing XLSX read tool (xlsxExtract). This is the input layer; the new spreadsheet tool would accept the same file paths and parse the same ZIP structure, then apply computations.
- **src/tools/fileExtract/xlsxParser.js** — XLSX-to-markdown parser; the new tool would need a complementary parser that preserves cell formulas and types (not just markdown rendering).
- **src/tools/fileExtract/xlsxJson.js** — XLSX-to-JSON converter; useful as an intermediate format for the computation tool.
- **src/tools/fileExtract/zipExtractor.js** — Shared ZIP extraction; the new tool would need the inverse (ZIP packing) to generate .xlsx files.
- **src/tools/fileExtract/formatValidator.js** — Shared validation; reusable for input file validation.
- **src/tools/index.js** — Tools are registered here with TOOL_PERMISSIONS and TOOL_CLASSIFICATIONS. Spreadsheet computation tools would need filesystem:read, filesystem:write, and potentially network:outbound (for formula libraries).
- **src/tools/fileExtract/docx.js** — Cross-reference: the output of spreadsheet computation could be embedded in DOCX reports via the document creation tool (#778).