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
 * @param {string} options.sessionsDir - Path to sessions directory
 * @returns {Promise<string>} Search results or conversation content
 */
export async function sessionSearchImpl(input, options) {
	const sessionsDir = join(cwd, options.sessionsDir || "memory/sessions/");

	if (input.conversationId) {
		return getFullConversation(sessionsDir, input.conversationId);
	}

	if (input.query) {
		return searchConversations(sessionsDir, input.query, input.limit || 10);
	}

	return browseConversations(sessionsDir);
}

export const session_search = tool(sessionSearchImpl, {
	name: "sessionSearch",
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
 * @param {string} sessionsDir - Sessions directory
 * @param {string} conversationId - Session/ID to find
 * @returns {Promise<string>} Full conversation content
 */
async function getFullConversation(sessionsDir, conversationId) {
	if (!(await exists(sessionsDir))) {
		return `No conversations directory found: ${sessionsDir}`;
	}

	const files = (await readdir(sessionsDir)).filter((f) => f.endsWith(".md"));
	for (const file of files) {
		const filepath = join(sessionsDir, file);
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
 * Wrap `execFile` in a Promise for async/await usage.
 * @param {string} cmd - Command to execute
 * @param {string[]} args - Arguments array
 * @param {object} opts - execFile options (timeout, encoding)
 * @returns {Promise<{ stdout: string, stderr: string }>}
 * @private
 */
async function runCmd(cmd, args, opts) {
	return new Promise((resolve, reject) => {
		import("node:child_process").then(({ execFile }) => {
			execFile(cmd, args, opts, (err, stdout, stderr) => {
				if (err) reject(err);
				else resolve({ stdout, stderr });
			});
		});
	});
}

/**
 * Search conversations by query using shell grep.
 * @param {string} sessionsDir - Sessions directory
 * @param {string} query - Search keyword
 * @param {number} limit - Max results
 * @returns {Promise<string>} Search results
 */
async function searchConversations(sessionsDir, query, limit) {
	if (!(await exists(sessionsDir))) {
		return `No conversations directory found: ${sessionsDir}`;
	}

	// grep -rniIn: recursive, fixed-string, case-insensitive, numbered, skip binary
	let { stdout } = await runCmd("grep", ["-rI", "-niIn", query, sessionsDir], {
		timeout: 10000,
		encoding: "utf-8",
	}).catch((err) => {
		// exit code 1 = no match (not an error)
		if (err.code === 1 || err.status === 1) return { stdout: "" };
		return { stdout: "", stderr: err.message };
	});

	const output = stdout?.trim() ?? stdout;
	if (!output) {
		return `No conversations matched query "${query}"`;
	}

	// Parse grep output: "filepath:lineNum:content"
	const matches = output.split("\n");
	const byFile = new Map();
	for (const line of matches) {
		const idx = line.indexOf(":");
		const numIdx = idx >= 0 ? line.indexOf(":", idx + 1) : -1;
		if (idx < 0 || numIdx < 0) continue;
		const file = line.slice(0, idx);
		const lineNum = parseInt(line.slice(idx + 1, numIdx), 10);
		const content = line.slice(numIdx + 1);
		const arr = byFile.get(file) || [];
		arr.push({ lineNum, content });
		byFile.set(file, arr);
	}

	// For each file, use sed to extract context lines (±2)
	const results = [];
	for (const [file, lineMatches] of byFile) {
		const startLine = Math.max(1, lineMatches[0].lineNum - 2);
		const endLine = Math.max(lineMatches[lineMatches.length - 1].lineNum + 2, startLine);
		const { stdout: sedOutput } = await runCmd(
			"sh",
			["-c", `sed -n '${startLine},${endLine}p' "$1"`, "_", file],
			{ timeout: 5000, encoding: "utf-8" },
		).catch(() => ({ stdout: "" }));

		const sedLines = sedOutput.split("\n");
		const matchLineSet = new Set(lineMatches.map((m) => m.lineNum));
		for (const m of lineMatches) {
			if (results.length >= limit) break;

			const context = sedLines
				.filter((_, i) => i < sedLines.length - 1) // skip trailing empty
				.map((l, i) => {
					const actualLine = startLine + i;
					if (actualLine === m.lineNum) return `>> ${l}`;
					if (matchLineSet.has(actualLine)) return `+  ${l}`;
					return `   ${l}`;
				})
				.join("\n");
			results.push(`File: ${file} (line ${m.lineNum})\n${context}`);
		}
	}

	if (results.length === 0) {
		return `No conversations matched query "${query}"`;
	}

	return `Found ${results.length} matching snippets:\n\n${results.join("\n---\n")}`;
}

/**
 * Browse and list available conversations.
 * @param {string} sessionsDir - Sessions directory
 * @returns {Promise<string>} List of conversations with metadata
 */
async function browseConversations(sessionsDir) {
	const conversations = [];

	if (!(await exists(sessionsDir))) {
		return `No conversations directory found: ${sessionsDir}`;
	}

	const files = (await readdir(sessionsDir)).filter((f) => f.endsWith(".md"));
	for (const file of files) {
		const filepath = join(sessionsDir, file);
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
		name: "sessionSearch",
		description:
			"Search past conversations. Use query for keyword search, conversationId for full retrieval, or call without arguments to browse available conversations.",
		schema: z.object({
			query: z.string().optional().describe("Search query to find matching conversations"),
			conversationId: z.string().optional().describe("Get full conversation by ID"),
			limit: z.number().int().positive().default(10).describe("Maximum number of search results"),
		}),
	});
}
().int().positive().default(10).describe("Maximum number of search results"),
		}),
	});
}
