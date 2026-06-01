import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readdir, readFile, access, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "../memory/reader.js";

const FS = Object.freeze({ MODE_RDONLY: 0 });

/**
 * Check if a path exists.
 * @param {string} path - Filesystem path
 * @returns {Promise<boolean>}
 */
async function exists(path) {
	try {
		await access(path, FS.MODE_RDONLY);
		return true;
	} catch {
		return false;
	}
}

/**
 * Search past conversations. Supports query keyword search,
 * full conversation retrieval by ID, or browsing all sessions.
 * @param {z.infer<typeof SessionSearchSchema>} input - The tool input
 * @param {object} options - Runtime options
 * @param {string} options.conversationsDir - Path to conversations directory
 * @returns {Promise<string>} Search results or conversation content
 */
export async function sessionSearchImpl(input, options) {
	const conversationsDir = join(process.cwd(), options.conversationsDir || "memory/sessions/");

	if (input.conversationId) {
		return getFullConversation(conversationsDir, input.conversationId);
	}

	if (input.query) {
		return searchConversations(conversationsDir, input.query, input.limit || 10);
	}

	return browseConversations(conversationsDir);
}

export const session_search = tool(sessionSearchImpl, {
	name: "session_search",
	description:
		"Search past conversations. Use query for keyword search, conversationId for full retrieval, or call without arguments to browse available conversations.",
	schema: z.object({
		query: z.string().optional().describe("Search query to find matching conversations"),
		conversationId: z.string().optional().describe("Get full conversation by ID"),
		limit: z.number().int().positive().default(10).describe("Maximum number of search results"),
	}),
});

/**
 * Get full conversation by ID.
 * @param {string} conversationsDir - Conversations directory
 * @param {string} conversationId - Session/ID to find
 * @returns {Promise<string>} Full conversation content
 */
async function getFullConversation(conversationsDir, conversationId) {
	if (!(await exists(conversationsDir))) {
		return `No conversations directory found: ${conversationsDir}`;
	}

	const files = (await readdir(conversationsDir)).filter((f) => f.endsWith(".md"));
	for (const file of files) {
		const filepath = join(conversationsDir, file);
		const content = await readFile(filepath, "utf-8");
		const { frontmatter } = parseFrontmatter(content);

		const sessionId =
			frontmatter.sessionId || file.replace(/\.md$/, "").replace(/-[0-9T:._-]+/, "");
		if (sessionId === conversationId || file.includes(conversationId)) {
			const { content: body } = parseFrontmatter(content);
			return `Conversation (${file}):\n\n${body}`;
		}
	}
	return `Conversation not found: ${conversationId}`;
}

/**
 * Search conversations by query.
 * @param {string} conversationsDir - Conversations directory
 * @param {string} query - Search keyword
 * @param {number} limit - Max results
 * @returns {Promise<string>} Search results
 */
async function searchConversations(conversationsDir, query, limit) {
	const results = [];
	const regex = new RegExp(query, "i");

	if (!(await exists(conversationsDir))) {
		return `No conversations directory found: ${conversationsDir}`;
	}

	const files = (await readdir(conversationsDir)).filter((f) => f.endsWith(".md"));
	for (const file of files) {
		if (results.length >= limit) break;

		const filepath = join(conversationsDir, file);
		const content = await readFile(filepath, "utf-8");
		const { content: body } = parseFrontmatter(content);

		const lines = body.split("\n");
		const matchingLines = [];

		for (let i = 0; i < lines.length; i++) {
			if (regex.test(lines[i])) {
				const start = Math.max(0, i - 2);
				const end = Math.min(lines.length, i + 3);
				const context = lines
					.slice(start, end)
					.map((l) => `  ${l}`)
					.join("\n");
				matchingLines.push(`File: ${file} (line ${i + 1})\n${context}`);
			}
		}

		if (matchingLines.length > 0) {
			results.push(...matchingLines.slice(0, 3));
		}
	}

	if (results.length === 0) {
		return `No conversations matched query "${query}"`;
	}

	return `Found ${results.length} matching snippets:\n\n${results.join("\n---\n")}`;
}

/**
 * Browse and list available conversations.
 * @param {string} conversationsDir - Conversations directory
 * @returns {Promise<string>} List of conversations with metadata
 */
async function browseConversations(conversationsDir) {
	const conversations = [];

	if (!(await exists(conversationsDir))) {
		return `No conversations directory found: ${conversationsDir}`;
	}

	const files = (await readdir(conversationsDir)).filter((f) => f.endsWith(".md"));
	for (const file of files) {
		const filepath = join(conversationsDir, file);
		const fileStat = await stat(filepath);
		const content = await readFile(filepath, "utf-8");
		const { frontmatter, content: body } = parseFrontmatter(content);

		let preview = "";
		try {
			const parsed = JSON.parse(body);
			if (Array.isArray(parsed) && parsed.length > 0) {
				preview = parsed[0].content?.toString().slice(0, 100) || "Empty";
			}
		} catch {
			preview = body.slice(0, 100).replace(/\n/g, " ");
		}

		conversations.push({
			file,
			date: fileStat.mtime.toISOString().split("T")[0],
			sessionId: frontmatter.sessionId || "unknown",
			preview,
		});
	}

	if (conversations.length === 0) {
		return "No conversations found";
	}

	return JSON.stringify(
		conversations.map((c) => ({
			file: c.file,
			date: c.date,
			sessionId: c.sessionId,
			preview: c.preview,
		})),
		null,
		0,
	);
}

// --- Factory functions for creating tools with runtime options ---

/**
 * Create a session_search tool with runtime options
 * @param {object} options - Runtime options
 * @returns {object} LangChain Tool instance
 */
export function createSessionSearchTool(options) {
	return tool((input) => sessionSearchImpl(input, options), {
		name: "session_search",
		description:
			"Search past conversations. Use query for keyword search, conversationId for full retrieval, or call without arguments to browse available conversations.",
		schema: z.object({
			query: z.string().optional().describe("Search query to find matching conversations"),
			conversationId: z.string().optional().describe("Get full conversation by ID"),
			limit: z.number().int().positive().default(10).describe("Maximum number of search results"),
		}),
	});
}
