import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { mkdir, writeFile, readFile, readdir, unlink, access } from "node:fs/promises";
import { join, basename } from "node:path";

const DEFAULT_MAX_ENTRIES = 100;

/**
 * Check if a file path exists.
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>}
 */
async function pathExists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Parse entry content by extracting frontmatter and body text.
 * @param {string} content - Raw file content
 * @returns {{ frontmatter: Record<string, string>, body: string }}
 */
function parseEntryContent(content) {
	const lines = content.split("\n");
	const fmLines = [];
	let inFrontmatter = false;
	let bodyStart = 0;

	for (let i = 0; i < lines.length; i++) {
		if (lines[i].trim() === "---" && !inFrontmatter) {
			inFrontmatter = true;
			continue;
		}
		if (lines[i].trim() === "---" && inFrontmatter) {
			bodyStart = i + 1;
			break;
		}
		if (inFrontmatter) fmLines.push(lines[i]);
	}

	const frontmatter = {};
	for (const line of fmLines) {
		const i = line.indexOf(":");
		if (i !== -1) {
			let val = line.slice(i + 1).trim();
			if (
				(val.startsWith('"') && val.endsWith('"')) ||
				(val.startsWith("'") && val.endsWith("'"))
			) {
				val = val.slice(1, -1);
			}
			frontmatter[line.slice(0, i).trim().toLowerCase()] = val;
		}
	}

	return { frontmatter, body: lines.slice(bodyStart).join("\n").trim() };
}

/**
 * Sanitize a key to lowercase snake_case for use as a filename.
 * @param {string} key - The raw key string
 * @returns {string} Sanitized filename stem
 */
export function sanitizeKey(key) {
	const stem = key
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.toLocaleLowerCase()
		.replace(/\.md$/i, "")
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
	return stem || "unnamed_entry";
}

/**
 * Get the full file path for a given key.
 * @param {string} key - Entry key
 * @returns {string} Full path to the entry file
 */
function getEntryPath(key, contextDir) {
	return join(process.cwd(), contextDir, sanitizeKey(key) + ".md");
}

/**
 * Get the list of entry files in the entries directory.
 * @returns {Promise<string[]>} List of entry filenames
 */
async function getEntryFiles(contextDir) {
	try {
		return (await readdir(contextDir)).filter((f) => f.endsWith(".md"));
	} catch {
		return [];
	}
}

/**
 * Count the number of entry files in the directory.
 * @returns {Promise<number>} Number of entry files
 */
async function countEntries(contextDir) {
	try {
		return (await readdir(contextDir)).filter((f) => f.endsWith(".md")).length;
	} catch {
		return 0;
	}
}

/**
 * Validate the entry count against the maximum limit.
 * @param {number} maxEntries - Maximum allowed entries
 * @returns {Promise<void>}
 * @throws {Error} When limit would be exceeded
 */
async function validateMaxEntries(maxEntries, contextDir) {
	const count = await countEntries(contextDir);
	if (count >= maxEntries) {
		throw new Error(`Memory entries (${count}) exceed maximum (${maxEntries})`);
	}
}

/**
 * Load a single entry by key.
 * @param {string} key - Entry key
 * @returns {Promise<{ found: boolean, value: string, createdDate: string, updatedDate: string } | null>}
 */
async function loadEntry(key, contextDir) {
	const filePath = getEntryPath(key, contextDir);
	try {
		const content = await readFile(filePath, "utf-8");
		const { frontmatter, body } = parseEntryContent(content);
		const created = frontmatter.createddate || new Date().toISOString();
		return {
			found: true,
			value: body,
			createdDate: created,
			updatedDate: frontmatter.updateddate || created,
		};
	} catch {
		return null;
	}
}

/**
 * Save a single entry to its file.
 * @param {string} key - Entry key
 * @param {string} value - Entry value/body
 * @param {string} [createdDate] - Optional preserved creation date (omit for new entries)
 * @returns {Promise<void>}
 */
async function saveEntry(key, value, createdDate, contextDir) {
	const filePath = getEntryPath(key, contextDir);
	const now = new Date().toISOString();
	const created = createdDate || now;
	await mkdir(process.cwd() + "/" + contextDir, { recursive: true });
	await writeFile(
		filePath,
		`---\ncreatedDate: "${created}"\nupdatedDate: "${now}"\n---\n\n${value}\n`,
		"utf-8",
	);
}

/**
 * Delete a single entry by key.
 * @param {string} key - Entry key
 * @returns {Promise<boolean>} Whether the entry was deleted
 */
async function deleteEntry(key, contextDir) {
	const filePath = getEntryPath(key, contextDir);
	if (!(await pathExists(filePath))) return false;
	await unlink(filePath);
	return true;
}

/**
 * Core memory implementation with create, read, update, delete, and list actions.
 * @param {z.infer<typeof MemorySchema>} input - The tool input
 * @param {object} options - Runtime options
 * @param {number} options.maxEntries - Maximum memory entries (default 100)
 * @returns {Promise<string>} Result of the operation
 */
export async function memoryImpl(input, options) {
	const maxEntries = options.maxEntries || DEFAULT_MAX_ENTRIES;
	const contextDir = options.contextDir || "memory/context/";
	const { action } = input;
	const actions = ["create", "read", "update", "delete", "list"];

	if (!actions.includes(action)) {
		return JSON.stringify({
			ok: false,
			error: `Unknown action: "${action}". Valid actions: ${actions.join(", ")}`,
		});
	}

	try {
		switch (action) {
			case "create": {
				if (!input.key || input.value === undefined) {
					return JSON.stringify({ ok: false, error: "create requires: key and value" });
				}
				const cleanedKey = sanitizeKey(input.key);
				await validateMaxEntries(maxEntries, contextDir);
				await saveEntry(cleanedKey, String(input.value), undefined, contextDir);
				return JSON.stringify({ ok: true, message: `Memory created: "${cleanedKey}"` });
			}

			case "read": {
				if (!input.key) {
					return JSON.stringify({ ok: false, error: "read requires: key" });
				}
				const entry = await loadEntry(input.key, contextDir);
				if (!entry || !entry.found) {
					return JSON.stringify({
						ok: false,
						error: `Memory not found: "${sanitizeKey(input.key)}"`,
					});
				}
				return JSON.stringify({
					ok: true,
					key: sanitizeKey(input.key),
					value: entry.value,
					createdDate: entry.createdDate,
					updatedDate: entry.updatedDate,
				});
			}

			case "update": {
				if (!input.key || input.value === undefined) {
					return JSON.stringify({ ok: false, error: "update requires: key and value" });
				}
				const cleanedKey = sanitizeKey(input.key);
				const existing = await loadEntry(cleanedKey, contextDir);
				if (!existing || !existing.found) {
					return JSON.stringify({
						ok: false,
						error: `Memory not found: "${cleanedKey}". Use "create" to add it.`,
					});
				}
				await saveEntry(cleanedKey, String(input.value), existing.createdDate, contextDir);
				return JSON.stringify({ ok: true, message: `Memory updated: "${cleanedKey}"` });
			}

			case "delete": {
				if (!input.key) {
					return JSON.stringify({ ok: false, error: "delete requires: key" });
				}
				const cleanedKey = sanitizeKey(input.key);
				const deleted = await deleteEntry(cleanedKey, contextDir);
				if (!deleted) {
					return JSON.stringify({ ok: false, error: `Memory not found: "${cleanedKey}"` });
				}
				return JSON.stringify({ ok: true, message: `Memory deleted: "${cleanedKey}"` });
			}

			case "list": {
				const files = await getEntryFiles(contextDir);
				const query = input.query || "";
				const entries = [];

				for (const file of files) {
					const content = await readFile(join(contextDir, file), "utf-8");
					const { frontmatter, body } = parseEntryContent(content);
					const stem = basename(file, ".md").toLocaleLowerCase();
					if (query && ![stem, body].join(" ").toLowerCase().includes(query.toLowerCase()))
						continue;
					const created = frontmatter.createddate || new Date().toISOString();
					entries.push({
						key: stem,
						value: body,
						createdDate: created,
						updatedDate: frontmatter.updateddate || created,
					});
				}

				entries.sort((a, b) =>
					(b.updatedDate || b.createdDate || "").localeCompare(
						a.updatedDate || a.createdDate || "",
					),
				);
				return JSON.stringify({ ok: true, total: entries.length, entries });
			}
		}
	} catch (err) {
		return JSON.stringify({ ok: false, error: `Memory error: ${err.message}` });
	}
}

/**
 * Memory tool for individual file-based entry persistence.
 */
export const memory = tool(memoryImpl, {
	name: "memory",
	description:
		"Memory tool for individual key-value entry storage. Each entry is persisted as a separate .md file in memory/context/entries/ with createdDate and updatedDate metadata. Actions: create (new entry), read (get by key), update (modify by key), delete (remove by key), list (all entries, optional query filter).",
	schema: z.object({
		action: z.enum(["create", "read", "update", "delete", "list"]).describe("Action to perform"),
		key: z
			.string()
			.optional()
			.describe("Entry key/identifier (required for create, read, update, delete)"),
		value: z.unknown().optional().describe("Entry value (required for create, update)"),
		query: z.string().optional().describe("Search query to filter list results"),
	}),
});

// --- Factory functions for creating tools with runtime options ---

/**
 * Create a memory tool with runtime options
 * @param {object} options - Runtime options
 * @param {number} [options.maxEntries] - Maximum memory entries (default 100)
 * @returns {object} LangChain tool instance
 */
export function createMemoryTool(options = {}) {
	return tool((input) => memoryImpl(input, options), {
		name: "memory",
		description:
			"Memory tool for individual key-value entry storage. Each entry is persisted as a separate .md file in memory/context/entries/ with createdDate and updatedDate metadata. Actions: create, read, update, delete, list.",
		schema: z.object({
			action: z.enum(["create", "read", "update", "delete", "list"]).describe("Action to perform"),
			key: z
				.string()
				.optional()
				.describe("Entry key/identifier (required for create, read, update, delete)"),
			value: z.unknown().optional().describe("Entry value (required for create, update)"),
			query: z.string().optional().describe("Search query to filter list results"),
		}),
	});
}
