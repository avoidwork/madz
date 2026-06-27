import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";

const FRONTMATTER_DELIMITER = "---";

/**
 * Escape a string value for safe inclusion in a YAML double-quoted scalar.
 * Escapes backslashes first, then double quotes, then newlines.
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
function escapeYamlString(str) {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Write a memory file with YAML frontmatter.
 * Creates a timestamped markdown file in the specified directory,
 * resolved relative to config.cwd.
 * @param {string} subdirectory - The subdirectory relative to config.cwd
 * @param {string} title - A short title for the entry
 * @param {Object} frontmatter - YAML frontmatter metadata
 * @param {string} body - The markdown body content
 * @returns {string} The path of the created file
 */
export function writeMemoryFile(subdirectory, title, frontmatter, body = "") {
	const config = loadConfig();
	const directory = join(config.cwd, subdirectory);
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
		`title: "${escapeYamlString(title)}"`,
		`timestamp: "${escapeYamlString(timestamp)}"`,
		...Object.entries(frontmatter).map(([k, v]) => {
			if (v == null) return `${k}:`;
			if (typeof v === "string") return `${k}: "${escapeYamlString(v)}"`;
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
