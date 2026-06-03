import { readdir, readFile, access } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { parseFrontmatter } from "./reader.js";

/**
 * Check if a file path exists.
 * @param {string} filepath - File path to check
 * @returns {Promise<boolean>}
 */
async function fileExists(filepath) {
	try {
		await access(filepath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Parse a single memory entry file into structured metadata and body.
 * @param {string} filepath - Full path to the .md file
 * @returns {Promise<{ metadata: { createdDate: string, updatedDate?: string }, memory: string } | null>}
 */
export async function parseEntryFile(filepath) {
	if (!(await fileExists(filepath))) {
		return null;
	}

	const content = await readFile(filepath, "utf-8");
	const { frontmatter, content: body } = parseFrontmatter(content);

	const metadata = {
		createdDate: frontmatter.createdDate || new Date().toISOString(),
	};
	if (frontmatter.updatedDate) {
		metadata.updatedDate = frontmatter.updatedDate;
	}

	return {
		metadata,
		memory: body.trim(),
	};
}

/**
 * Load all memory entries from a directory, sorted by date descending.
 * @param {string} entriesDir - Path to the memory entries directory
 * @returns {Promise<{ key: string, metadata: { createdDate: string, updatedDate?: string }, memory: string }[]>}
 */
export async function loadMemories(entriesDir = "memory/context/") {
	const fullPath = join(process.cwd(), entriesDir);

	if (!(await fileExists(fullPath))) {
		return [];
	}

	const files = await readdir(fullPath);
	const mdFiles = files.filter((f) => extname(f).toLowerCase() === ".md");

	const entries = [];
	for (const filename of mdFiles) {
		const key = basename(filename, ".md").toLocaleLowerCase();
		const filepath = join(fullPath, filename);
		const entry = await parseEntryFile(filepath);
		if (entry !== null) {
			entries.push({ key, ...entry });
		}
	}

	return entries.sort((a, b) => {
		const aDate = a.metadata.updatedDate || a.metadata.createdDate;
		const bDate = b.metadata.updatedDate || b.metadata.createdDate;
		return bDate.localeCompare(aDate);
	});
}

/**
 * Format memory entries as a markdown string for the system prompt.
 * @param {{ key: string, metadata: { createdDate: string, updatedDate?: string }, memory: string }[]} entries - Memory entries from loadMemories
 * @returns {string} Formatted prompt section
 */
export function formatMemoriesForPrompt(entries) {
	if (entries.length === 0) return "";

	return (
		"The following are important memories for the user:\n\n" +
		entries
			.map((entry) => {
				return `=== ${entry.key} ===\n${entry.memory}`;
			})
			.join("\n\n")
	);
}
