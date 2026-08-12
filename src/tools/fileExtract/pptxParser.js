/**
 * PPTX to Markdown parser.
 * Converts PowerPoint presentations to structured markdown.
 * @module fileExtract/pptxParser
 */

import { extractZipXml } from "./zipExtractor.js";
import { parseStringPromise } from "xml2js";

/**
 * Convert PPTX to markdown.
 * @param {Map<string, string>} zipContent - Map of internal path → content
 * @returns {string} Markdown string
 */
export function pptxToMarkdown(zipContent) {
	let markdown = "";
	let slideIndex = 0;

	// Find all slide files
	const slideFiles = [];
	for (const path of zipContent.keys()) {
		if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) {
			slideFiles.push(path);
		}
	}
	slideFiles.sort();

	for (const slidePath of slideFiles) {
		const slideXml = zipContent.get(slidePath);
		if (!slideXml) continue;

		slideIndex++;
		markdown += `---\n\n`;

		try {
			const parsed = parseStringPromise(slideXml, {
				mergeAttrs: true,
				explicitArray: false,
			});

			const spTree = parsed?.p?.slide?.[0]?.["p:spTree"] || parsed?.p?.slide?.["p:spTree"];
			if (!spTree) continue;

			const shapes = spTree["p:sp"] || [];
			const shapeArray = Array.isArray(shapes) ? shapes : [shapes];

			let titleFound = false;

			for (const shape of shapeArray) {
				const nm = shape?.$?.name;
				if (nm === "title") {
					const text = extractShapeText(shape);
					if (text) {
						markdown += `# ${text}\n\n`;
						titleFound = true;
					}
				} else {
					const text = extractShapeText(shape);
					if (text) {
						markdown += `- ${text}\n`;
					}
				}
			}

			// Extract speaker notes if available
			const notesPath = slidePath.replace("slides/slide", "slideNotesSlides/notesSlide");
			const notesXml = zipContent.get(notesPath);
			if (notesXml) {
				try {
					const notesParsed = parseStringPromise(notesXml, {
						mergeAttrs: true,
						explicitArray: false,
					});
					const notesBody = notesParsed?.p?.notesSlide?.[0]?.["p:spTree"] || notesParsed?.p?.notesSlide?.["p:spTree"];
					if (notesBody) {
						const notesShapes = notesBody["p:sp"] || [];
						const notesArray = Array.isArray(notesShapes) ? notesShapes : [notesShapes];
						for (const shape of notesArray) {
							const text = extractShapeText(shape);
							if (text) {
								markdown += `\n> **Speaker Notes:** ${text}\n`;
							}
						}
					}
				} catch {
					// Skip notes on parse error
				}
			}

			if (!titleFound) {
				markdown = markdown.replace(`---\n\n`, `---\n\n`);
			}
		} catch {
			markdown += `## Slide ${slideIndex} (parse error)\n\n`;
		}
	}

	return markdown.trim();
}

/**
 * Extract text content from a shape element.
 * @param {object} shape - Parsed shape XML object
 * @returns {string} Text content
 */
function extractShapeText(shape) {
	const body = shape?.txBody || shape?.["p:txBody"];
	if (!body) return "";

	const paragraphs = body["a:p"] || [];
	const paraArray = Array.isArray(paragraphs) ? paragraphs : [paragraphs];

	let text = "";
	for (const para of paraArray) {
		const runs = para["a:r"] || [];
		const runArray = Array.isArray(runs) ? runs : [runs];

		for (const run of runArray) {
			const t = run["a:t"];
			if (t && typeof t === "string") {
				text += t;
			}
		}
	}

	return text.trim();
}
