import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { parseFrontmatter } from "../memory/reader.js";

const MEMORY_FILE = "memory/context/session_memory.md";
const DEFAULT_MAX_ENTRIES = 100;

/**
 * Check if a file path exists.
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>}
 */
async function checkPathExists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Load current session memory entries from frontmatter.
 * @param {string} [filePath=MEMORY_FILE] - Path to the memory file
 * @returns {Promise<Object<string, string>>} Key-value map of entries
 */
async function loadMemoryEntries(filePath = MEMORY_FILE) {
	if (!(await checkPathExists(filePath))) {
		return {};
	}
	const content = await readFile(filePath, "utf-8");
	const { frontmatter } = parseFrontmatter(content);
	const entries = frontmatter.entries || [];
	const map = {};
	for (const entry of entries) {
		if (entry.key && entry.value !== undefined) {
			map[entry.key] = entry.value;
		}
	}
	return map;
}

/**
 * Save memory entries to file in frontmatter markdown format.
 * @param {string} [filePath=MEMORY_FILE] - Path to the memory file
 * @param {Object<string, string>} entries - Key-value entries to save
 * @param {number} [maxEntries=100] - Maximum number of entries allowed
 * @returns {Promise<void>}
 */
async function saveMemoryEntries(
	filePath = MEMORY_FILE,
	entries,
	maxEntries = DEFAULT_MAX_ENTRIES,
) {
	const keys = Object.keys(entries);
	if (keys.length > maxEntries) {
		throw new Error(`Memory entries (${keys.length}) exceed maximum (${maxEntries})`);
	}

	const entryList = keys.map((key) => ({ key, value: entries[key] }));

	// Build existing body from file
	let body = "";
	if (await checkPathExists(filePath)) {
		const content = await readFile(filePath, "utf-8");
		const parsed = parseFrontmatter(content);
		body = parsed.content || "";
	}

	const fmLines = ["---"];
	for (const entry of entryList) {
		if (typeof entry.value === "string" || typeof entry.value === "number") {
			fmLines.push(`${entry.key}: ${entry.value}`);
		} else {
			fmLines.push(`${entry.key}: ${JSON.stringify(entry.value)}`);
		}
	}
	fmLines.push("---");

	const content = [...fmLines, "", body, ""].join("\n");

	const dir = filePath.split("/").slice(0, -1).join("/");
	if (dir) {
		await mkdir(dir, { recursive: true });
	}
	await writeFile(filePath, content, "utf-8");
}

/**
 * Core memory implementation: load entries, add new ones, deduplicate, save.
 * @param {z.infer<typeof MemorySchema>} input - The tool input
 * @param {object} options - Runtime options
 * @param {number} options.maxEntries - Maximum memory entries (default 100)
 * @returns {Promise<string>} Result of the operation
 */
export async function memoryImpl(input, options) {
	const maxEntries = options.maxEntries || DEFAULT_MAX_ENTRIES;
	const existing = await loadMemoryEntries();
	const keys = [];

	for (const entry of input.entries) {
		existing[entry.key] = entry.value;
		keys.push(entry.key);
	}

	// Remove duplicates (later values override earlier)
	const deduped = {};
	for (const key of keys) {
		deduped[key] = existing[key];
	}

	await saveMemoryEntries(MEMORY_FILE, deduped, maxEntries);
	return JSON.stringify({ saved: keys.length, keys });
}

/**
 * Memory tool for key-value entry persistence with deduplication.
 */
export const memory = tool(memoryImpl, {
	name: "memory",
	description:
		"Memory tool for key-value entry storage. Supports writing entries with deduplication by key. Persists to memory/context/session_memory.md with markdown frontmatter format.",
	schema: z.object({
		entries: z
			.array(
				z.object({
					key: z.string().describe("Entry key (used for deduplication)"),
					value: z.unknown().describe("Entry value (any type)"),
				}),
			)
			.describe("Key-value entries to save"),
	}),
});
