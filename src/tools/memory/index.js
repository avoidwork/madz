import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { mkdir, writeFile, readFile, readdir, unlink, access } from "node:fs/promises";
import { join, basename } from "node:path";
import { loadConfig } from "../../config/loader.js";

const config = loadConfig();
const cwd = config.cwd;

const DEFAULT_MAX_ENTRIES = 100;

/**
 * Resolve the entries directory against the project root.
 * @param {string} contextDir - Relative or absolute entries directory
 * @param {string} [cwdParam] - Project root (defaults to config.cwd)
 * @returns {string} Absolute path to the entries directory
 */
function resolveContextDir(contextDir, cwdParam = cwd) {
	return join(cwdParam, contextDir);
}

/**
 * Check if a file path exists.
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>}
 */
async function pathExists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch (_err) {
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
			if (val.startsWith('"') && val.endsWith('"')) {
				val = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
			} else if (val.startsWith("'") && val.endsWith("'")) {
				val = val.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
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
function getEntryPath(key, contextDir, cwdParam = cwd) {
	return join(cwdParam, contextDir, sanitizeKey(key) + ".md");
}

/**
 * Get the list of entry files in the entries directory.
 * @returns {Promise<string[]>} List of entry filenames
 */
async function getEntryFiles(contextDir, cwdParam = cwd) {
	try {
		return (await readdir(resolveContextDir(contextDir, cwdParam))).filter((f) =>
			f.endsWith(".md"),
		);
	} catch (_err) {
		return [];
	}
}

/**
 * Load a single entry by key.
 * @param {string} key - Entry key
 * @returns {Promise<{ found: boolean, value: string, createdDate: string, updatedDate: string, key?: string } | null>}
 */
async function loadEntry(key, contextDir, cwdParam = cwd) {
	const filePath = getEntryPath(key, contextDir, cwdParam);
	try {
		const content = await readFile(filePath, "utf-8");
		const { frontmatter, body } = parseEntryContent(content);
		const created = frontmatter.createddate || new Date().toISOString();
		return {
			found: true,
			value: body,
			createdDate: created,
			updatedDate: frontmatter.updateddate || created,
			key: frontmatter.key,
		};
	} catch (_err) {
		return null;
	}
}

/**
 * Serialize a value for storage. Strings are stored verbatim; structured
 * values are JSON-encoded so their shape survives a round-trip.
 * @param {unknown} value - The value to serialize
 * @returns {string} String representation for storage
 */
function serializeValue(value) {
	if (typeof value === "string") return value;
	return JSON.stringify(value, null, 2);
}

/**
 * Save a single entry to its file.
 * @param {string} key - Entry key (original, stored in frontmatter)
 * @param {string} value - Entry value/body
 * @param {string} [createdDate] - Optional preserved creation date (omit for new entries)
 * @returns {Promise<void>}
 */
async function saveEntry(key, value, createdDate, contextDir, cwdParam = cwd) {
	const filePath = getEntryPath(key, contextDir, cwdParam);
	const now = new Date().toISOString();
	const created = createdDate || now;
	await mkdir(resolveContextDir(contextDir, cwdParam), { recursive: true });
	await writeFile(
		filePath,
		`---\ncreatedDate: "${created}"\nupdatedDate: "${now}"\nkey: ${JSON.stringify(key)}\n---\n\n${value}\n`,
		"utf-8",
	);
}

/**
 * Delete a single entry by key.
 * @param {string} key - Entry key
 * @returns {Promise<boolean>} Whether the entry was deleted
 */
async function deleteEntry(key, contextDir, cwdParam = cwd) {
	const filePath = getEntryPath(key, contextDir, cwdParam);
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
				const existing = await loadEntry(cleanedKey, contextDir, cwd);
				if (existing && existing.found && existing.key && existing.key !== input.key) {
					return JSON.stringify({
						ok: false,
						error: `Key collision: "${input.key}" maps to existing entry "${existing.key}"`,
					});
				}
				await saveEntry(input.key, serializeValue(input.value), undefined, contextDir, cwd);
				return JSON.stringify({ ok: true, message: `Memory created: "${cleanedKey}"` });
			}

			case "read": {
				if (!input.key) {
					return JSON.stringify({ ok: false, error: "read requires: key" });
				}
				const entry = await loadEntry(input.key, contextDir, cwd);
				if (!entry || !entry.found) {
					return JSON.stringify({
						ok: false,
						error: `Memory not found: "${sanitizeKey(input.key)}"`,
					});
				}
				return JSON.stringify({
					ok: true,
					key: entry.key || sanitizeKey(input.key),
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
				const existing = await loadEntry(cleanedKey, contextDir, cwd);
				if (!existing || !existing.found) {
					return JSON.stringify({
						ok: false,
						error: `Memory not found: "${cleanedKey}". Use "create" to add it.`,
					});
				}
				if (existing.key && existing.key !== input.key) {
					return JSON.stringify({
						ok: false,
						error: `Key collision: "${input.key}" maps to existing entry "${existing.key}"`,
					});
				}
				await saveEntry(
					input.key,
					serializeValue(input.value),
					existing.createdDate,
					contextDir,
					cwd,
				);
				return JSON.stringify({ ok: true, message: `Memory updated: "${cleanedKey}"` });
			}

			case "delete": {
				if (!input.key) {
					return JSON.stringify({ ok: false, error: "delete requires: key" });
				}
				const cleanedKey = sanitizeKey(input.key);
				const deleted = await deleteEntry(cleanedKey, contextDir, cwd);
				if (!deleted) {
					return JSON.stringify({ ok: false, error: `Memory not found: "${cleanedKey}"` });
				}
				return JSON.stringify({ ok: true, message: `Memory deleted: "${cleanedKey}"` });
			}

			case "list": {
				const files = await getEntryFiles(contextDir, cwd);
				const query = input.query || "";
				const entries = [];

				for (const file of files) {
					const content = await readFile(join(resolveContextDir(contextDir, cwd), file), "utf-8");
					const { frontmatter, body } = parseEntryContent(content);
					const stem = basename(file, ".md").toLocaleLowerCase();
					if (query && ![stem, body].join(" ").toLowerCase().includes(query.toLowerCase()))
						continue;
					const created = frontmatter.createddate || new Date().toISOString();
					entries.push({
						key: frontmatter.key || stem,
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
				const limited = entries.slice(0, maxEntries);
				return JSON.stringify({ ok: true, total: entries.length, entries: limited });
			}
		}
	} catch (err) {
		return JSON.stringify({ ok: false, error: `Memory error: ${err.message}` });
	}
}

/**
 * Memory tool for individual file-based entry persistence.
 */
export const memory = tool(
	(input) =>
		memoryImpl(input, {
			maxEntries: config.memory.maxEntries || 100,
			contextDir: config.memory.contextDir,
		}),
	{
		name: "memory",
		description:
			"Memory tool for individual key-value entry storage. Each entry is persisted as a separate .md file in memory/context/ with createdDate and updatedDate metadata. Actions: create (new entry), read (get by key), update (modify by key), delete (remove by key), list (all entries, optional query filter).",
		schema: z.object({
			action: z.enum(["create", "read", "update", "delete", "list"]).describe("Action to perform"),
			key: z
				.string()
				.optional()
				.describe("Entry key/identifier (required for create, read, update, delete)"),
			value: z.unknown().optional().describe("Entry value (required for create, update)"),
			query: z.string().optional().describe("Search query to filter list results"),
		}),
	},
);
