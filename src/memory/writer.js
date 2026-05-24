import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const FRONTMATTER_DELIMITER = "---";

/**
 * Write a memory file with YAML frontmatter.
 * Creates a timestamped markdown file in the specified directory.
 * @param {string} directory - The memory directory to write to
 * @param {string} title - A short title for the entry
 * @param {Object} frontmatter - YAML frontmatter metadata
 * @param {string} body - The markdown body content
 * @returns {string} The path of the created file
 */
export function writeMemoryFile(directory, title, frontmatter, body = "") {
	mkdirSync(directory, { recursive: true });
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	const filename = `${timestamp}-${slug || "entry"}.md`;
	const filepath = join(directory, filename);

	const lines = [
		FRONTMATTER_DELIMITER,
		`title: "${title}"`,
		`timestamp: "${timestamp}"`,
		...Object.entries(frontmatter).map(([k, v]) => {
			if (v == null) return `${k}:`;
			if (typeof v === "string") return `${k}: "${v}"`;
			if (typeof v === "boolean") return `${k}: ${v}`;
			if (typeof v === "number") return `${k}: ${v}`;
			return `${k}: ${JSON.stringify(v)}`;
		}),
		FRONTMATTER_DELIMITER,
		"",
		body,
		"",
	];

	const content = lines.join("\n");
	writeFileSync(filepath, content);
	return filepath;
}
