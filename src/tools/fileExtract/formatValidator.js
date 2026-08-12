/**
 * File format validation utility.
 * Validates that a file is a supported ZIP-based format before extraction.
 * @module fileExtract/formatValidator
 */

/**
 * Supported ZIP-based file extensions.
 */
export const ZIP_FORMATS = new Set(["docx", "pptx", "xlsx", "odt", "ods", "odp", "epub"]);

/**
 * Supported PDF file extension.
 */
export const PDF_FORMATS = new Set(["pdf"]);

/**
 * All supported file extensions.
 */
export const SUPPORTED_FORMATS = new Set([...ZIP_FORMATS, ...PDF_FORMATS]);

/**
 * ZIP-based formats that use shared XML extraction.
 */
export const ZIP_XML_FORMATS = new Set(["docx", "pptx", "xlsx", "odt", "ods", "odp"]);

/**
 * Internal XML paths for ZIP-based formats.
 * Maps format → array of internal XML paths to extract.
 */
export const INTERNAL_XML_PATHS = {
	docx: ["word/document.xml", "word/styles.xml", "word/numbering.xml"],
	pptx: [
		"ppt/slides/slide*.xml",
		"ppt/slideLayouts/slideLayout*.xml",
		"ppt/slideMasters/slideMaster*.xml",
		"ppt/presentation.xml",
		"ppt/presentationNotesSlides/notesSlide*.xml",
	],
	xlsx: ["xl/workbook.xml", "xl/worksheets/sheet*.xml", "xl/sharedStrings.xml"],
	odt: ["content.xml", "styles.xml"],
	ods: ["content.xml", "styles.xml"],
	odp: ["content.xml", "styles.xml", "meta.xml"],
	epub: ["OEBPS/content.opf", "OEBPS/toc.ncx"],
};

/**
 * Validate that a file path has a supported extension.
 * @param {string} filePath - Path to the file
 * @returns {{ valid: boolean, format?: string, error?: string }}
 */
export function validateFormat(filePath) {
	const ext = getExtension(filePath);

	if (!ext) {
		return {
			valid: false,
			error: `No file extension found in path: ${filePath}`,
		};
	}

	if (!SUPPORTED_FORMATS.has(ext)) {
		return {
			valid: false,
			error: `Unsupported format: .${ext}. Supported formats: ${[...SUPPORTED_FORMATS].sort().join(", ")}`,
		};
	}

	return { valid: true, format: ext };
}

/**
 * Check if a format is ZIP-based.
 * @param {string} format - File extension (lowercase)
 * @returns {boolean}
 */
export function isZipFormat(format) {
	return ZIP_FORMATS.has(format);
}

/**
 * Check if a format uses shared XML extraction.
 * @param {string} format - File extension (lowercase)
 * @returns {boolean}
 */
export function usesXmlExtraction(format) {
	return ZIP_XML_FORMATS.has(format);
}

/**
 * Get the internal XML paths for a ZIP-based format.
 * @param {string} format - File extension (lowercase)
 * @returns {string[] | null} Array of internal paths or null if not a ZIP format
 */
export function getInternalPaths(format) {
	return INTERNAL_XML_PATHS[format] || null;
}

/**
 * Extract the file extension from a path.
 * @param {string} filePath - File path
 * @returns {string | null} Lowercase extension or null
 */
export function getExtension(filePath) {
	const basename = filePath.split("/").pop() || filePath.split("\\").pop() || "";
	const dotIndex = basename.lastIndexOf(".");
	if (dotIndex <= 0) return null;
	return basename.slice(dotIndex + 1).toLowerCase();
}
