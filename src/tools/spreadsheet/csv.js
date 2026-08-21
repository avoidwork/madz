/**
 * CSV import and export utilities.
 * @module spreadsheet/csv
 */

import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

/**
 * Import a CSV string into an array of objects.
 * @param {string} csv - CSV string content
 * @param {Object} [options] - Parse options
 * @param {string} [options.delimiter=","] - Field delimiter character
 * @param {string} [options.quote='"'] - Quote character
 * @param {string} [options.escape='"'] - Escape character
 * @param {boolean} [options.trim=true] - Trim whitespace from fields
 * @param {boolean} [options.skip_empty_lines=false] - Skip empty lines
 * @param {boolean} [options.columns=true] - Use first row as column headers
 * @param {string} [options.encoding="utf-8"] - Input encoding
 * @returns {Object[]} Array of objects keyed by column headers
 * @throws {Error} If CSV is empty or cannot be parsed
 */
export function csvImport(csv, options = {}) {
  if (!csv || typeof csv !== "string" || csv.trim().length === 0) {
    throw new Error("csvImport() requires a non-empty CSV string");
  }

  const {
    delimiter = ",",
    quote = '"',
    escape = '"',
    trim = true,
    skip_empty_lines = false,
    columns = true,
    encoding = "utf-8",
  } = options;

  try {
    const records = parse(csv, {
      delimiter,
      quote,
      escape,
      trim,
      skip_empty_lines,
      columns,
      cast: (value) => {
        // Try to convert numeric strings to numbers
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (trimmed === "") return value;
          const num = Number(trimmed);
          if (!isNaN(num) && isFinite(num)) return num;
          // Try boolean
          if (trimmed.toLowerCase() === "true") return true;
          if (trimmed.toLowerCase() === "false") return false;
        }
        return value;
      },
    });

    if (records.length === 0) {
      throw new Error("csvImport() produced no records");
    }

    return records;
  } catch (err) {
    throw new Error(`csvImport() failed: ${err.message}`);
  }
}

/**
 * Export an array of objects to a CSV string.
 * @param {Object[]} data - Array of objects to export
 * @param {Object} [options] - Stringify options
 * @param {string} [options.delimiter=","] - Field delimiter character
 * @param {string} [options.quote='"'] - Quote character
 * @param {string} [options.escape='"'] - Escape character
 * @param {boolean} [options.header=true] - Include header row
 * @param {string[]} [options.columns] - Specific columns to include (order preserved)
 * @param {boolean} [options.record_delimiter="\n"] - Record delimiter
 * @returns {string} CSV string
 * @throws {Error} If data is empty or not an array
 */
export function csvExport(data, options = {}) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error("csvExport() requires a non-empty array of objects");
  }

  const {
    delimiter = ",",
    quote = '"',
    escape = '"',
    header = true,
    columns,
    record_delimiter = "\n",
  } = options;

  try {
    const output = stringify(data, {
      delimiter,
      quote,
      escape,
      header,
      columns,
      record_delimiter,
      cast: {
        boolean: (value) => String(value),
        date: (value) => {
          if (value instanceof Date) return value.toISOString();
          return String(value);
        },
        object: (value) => JSON.stringify(value),
        number: (value) => String(value),
      },
    });

    return output;
  } catch (err) {
    throw new Error(`csvExport() failed: ${err.message}`);
  }
}

/**
 * Convert CSV to JSON (array of objects).
 * @param {string} csv - CSV string content
 * @param {Object} [options] - Parse options (passed to csvImport)
 * @returns {string} JSON string
 */
export function csvToJson(csv, options = {}) {
  const records = csvImport(csv, options);
  return JSON.stringify(records, null, 2);
}

/**
 * Convert JSON (array of objects) to CSV string.
 * @param {string} json - JSON string containing an array of objects
 * @param {Object} [options] - Stringify options (passed to csvExport)
 * @returns {string} CSV string
 */
export function jsonToCsv(json, options = {}) {
  const data = JSON.parse(json);
  if (!Array.isArray(data)) {
    throw new Error("jsonToCsv() requires a JSON array of objects");
  }
  return csvExport(data, options);
}

/**
 * Convert an array of objects to XLSX-compatible data (array of arrays).
 * First row is headers, subsequent rows are data.
 * @param {Object[]} data - Array of objects
 * @param {string[]} [columns] - Specific columns to include
 * @returns {*[][]} 2D array of values
 */
export function toXlsxFormat(data, columns) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error("toXlsxFormat() requires a non-empty array of objects");
  }

  const cols = columns || Object.keys(data[0]);

  // Header row
  const rows = [cols.map((col) => col)];

  // Data rows
  for (const item of data) {
    rows.push(cols.map((col) => item[col] ?? ""));
  }

  return rows;
}