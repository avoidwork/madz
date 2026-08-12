/**
 * ZIP archive extraction utility.
 * Decompresses ZIP-based document archives and extracts XML content.
 * Uses adm-zip (pure JS) for maximum compatibility.
 * @module fileExtract/zipExtractor
 */

import AdmZip from "adm-zip";
import { ZIP_FORMATS } from "./formatValidator.js";

/**
 * Error thrown when ZIP extraction fails.
 */
export class ZipExtractionError extends Error {
	/**
	 * @param {string} message - Error message
	 * @param {string} [reason] - Reason for the failure
	 */
	constructor(message, reason) {
		super(message);
		this.name = "ZipExtractionError";
		this.reason = reason || null;
	}
}

/**
 * Validate that a file is a supported ZIP-based format.
 * @param {string} filePath - Path to the file
 * @returns {{ valid: boolean, format?: string, error?: string }}
 */
export function validateZip(filePath) {
	const ext = getExtension(filePath);

	if (!ext) {
		return {
			valid: false,
			error: `No file extension found in path: ${filePath}`,
		};
	}

	if (!ZIP_FORMATS.has(ext)) {
		return {
			valid: false,
			error: `Unsupported format: .${ext}. ZIP extraction supports: ${[...ZIP_FORMATS].sort().join(", ")}`,
		};
	}

	return { valid: true, format: ext };
}

/**
 * Get the list of file names inside a ZIP archive.
 * @param {string} filePath - Path to the ZIP file
 * @returns {Promise<string[]>} Array of file names in the archive
 */
export async function getZipFileNames(filePath) {
	try {
		const zip = new AdmZip(filePath);
		return zip.getEntries().map((entry) => entry.entryName);
	} catch (err) {
		if (err.message && err.message.toLowerCase().includes("password")) {
			throw new ZipExtractionError("Archive is password-protected", "password-protected");
		}
		throw new ZipExtractionError(`Failed to read ZIP: ${err.message}`, "extraction-failed");
	}
}

/**
 * Extract all XML content from a ZIP archive.
 * @param {string} filePath - Path to the ZIP file
 * @returns {Promise<Map<string, string>>} Map of filename to content
 */
export async function extractZipXml(filePath) {
	const result = new Map();

	try {
		const zip = new AdmZip(filePath);
		const entries = zip.getEntries();

		for (const entry of entries) {
			if (entry.isDirectory) continue;
			const content = entry.getData().toString("utf-8");
			result.set(entry.entryName, content);
		}
	} catch (err) {
		throw new ZipExtractionError(`Failed to extract ZIP: ${err.message}`, "extraction-failed");
	}

	return result;
}

/**
 * Extract a specific file from a ZIP archive.
 * @param {string} filePath - Path to the ZIP file
 * @param {string} internalPath - Internal path within the ZIP (e.g., "word/document.xml")
 * @returns {Promise<string>} File content
 */
export async function extractZipFile(filePath, internalPath) {
	try {
		const zip = new AdmZip(filePath);
		const entry = zip.getEntry(internalPath);

		if (!entry) {
			throw new ZipExtractionError(`File not found in archive: ${internalPath}`, "file-not-found");
		}

		return entry.getData().toString("utf-8");
	} catch (err) {
		if (err instanceof ZipExtractionError) throw err;
		throw new ZipExtractionError(
			`Failed to extract file from ZIP: ${err.message}`,
			"extraction-failed",
		);
	}
}

/**
 * Extract a file matching a glob pattern from a ZIP archive.
 * @param {string} filePath - Path to the ZIP file
 * @param {string} pattern - Glob pattern (e.g., "ppt/slides/slide*.xml")
 * @returns {Promise<Map<string, string>>} Map of filename to content
 */
export async function extractZipGlob(filePath, pattern) {
	const result = new Map();
	const regex = patternToRegex(pattern);

	try {
		const zip = new AdmZip(filePath);
		const entries = zip.getEntries();

		for (const entry of entries) {
			if (entry.isDirectory) continue;
			if (regex.test(entry.entryName)) {
				result.set(entry.entryName, entry.getData().toString("utf-8"));
			}
		}
	} catch (err) {
		throw new ZipExtractionError(`Failed to extract from ZIP: ${err.message}`, "extraction-failed");
	}

	return result;
}

/**
 * Convert a glob pattern to a regex.
 * @param {string} pattern - Glob pattern
 * @returns {RegExp}
 */
function patternToRegex(pattern) {
	const escaped = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".");
	return new RegExp(`^${escaped}$`);
}

/**
 * Extract the file extension from a path.
 * @param {string} filePath - File path
 * @returns {string | null} Lowercase extension or null
 */
function getExtension(filePath) {
	const basename = filePath.split("/").pop() || filePath.split("\\").pop() || "";
	const dotIndex = basename.lastIndexOf(".");
	if (dotIndex <= 0) return null;
	return basename.slice(dotIndex + 1).toLowerCase();
}
