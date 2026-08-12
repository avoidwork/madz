import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_WINDOW_DAYS = 7;

/**
 * Parse YAML frontmatter and JSON body from a session file.
 * @param {string} content - Raw file content
 * @returns {{ frontmatter: Record<string, string>, messages: Array<{role: string, content: string, timestamp: string}>, rawBody: string }}
 */
function parseSessionFile(content) {
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
		if (inFrontmatter) {
			fmLines.push(lines[i]);
		}
	}

	const frontmatter = {};
	for (const line of fmLines) {
		const idx = line.indexOf(":");
		if (idx !== -1) {
			let val = line.slice(idx + 1).trim();
			if (
				(val.startsWith('"') && val.endsWith('"')) ||
				(val.startsWith("'") && val.endsWith("'"))
			) {
				val = val.slice(1, -1);
			}
			frontmatter[line.slice(0, idx).trim().toLowerCase()] = val;
		}
	}

	const body = lines.slice(bodyStart).join("\n").trim();
	let messages = [];
	try {
		messages = JSON.parse(body);
	} catch {
		throw new Error("Invalid JSON body");
	}

	return { frontmatter, messages, rawBody: body };
}

/**
 * Check if content matches any of the ignore patterns.
 * @param {string} content - Content to check (frontmatter + body)
 * @param {string[]} patterns - Patterns to match against
 * @returns {boolean}
 */
function matchesIgnorePatterns(content, patterns) {
	if (!patterns || patterns.length === 0) return false;
	const lowerContent = content.toLowerCase();
	return patterns.some((pattern) => lowerContent.includes(pattern.toLowerCase()));
}

/**
 * Core reflection tool logic: read sessions, filter, extract user messages.
 * @param {z.infer<typeof ReflectionSchema>} input - The tool input
 * @param {object} options - Runtime options
 * @param {string} [options.sessionsDir] - Path to sessions directory
 * @returns {Promise<string>} JSON array of session data
 */
export async function reflectionImpl(input, options) {
	const { ignorePatterns = [], windowDays = DEFAULT_WINDOW_DAYS } = input;
	const sessionsDir = options.sessionsDir || "memory/sessions/";

	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - windowDays);

	let files;
	try {
		files = await readdir(sessionsDir);
	} catch {
		return JSON.stringify([]);
	}

	const results = [];

	for (const file of files) {
		if (!file.endsWith(".md")) continue;

		let content;
		try {
			content = await readFile(join(sessionsDir, file), "utf-8");
		} catch {
			continue;
		}

		let parsed;
		try {
			parsed = parseSessionFile(content);
		} catch {
			continue;
		}

		const { frontmatter, messages, rawBody } = parsed;

		// Parse startedAt from frontmatter
		const startedAtStr = frontmatter.startedat;
		if (!startedAtStr) continue;

		const startedAt = new Date(startedAtStr);
		if (isNaN(startedAt.getTime())) continue;

		// Filter by date window
		if (startedAt < cutoff) continue;

		// Filter by ignore patterns (check both frontmatter and body)
		const frontmatterText = Object.entries(frontmatter)
			.map(([k, v]) => `${k}: ${v}`)
			.join("\n");
		if (matchesIgnorePatterns(frontmatterText + "\n" + rawBody, ignorePatterns)) continue;

		// Extract user messages
		const userMessages = messages
			.filter((msg) => msg && msg.role === "user" && msg.content)
			.map((msg) => ({
				content: msg.content,
				timestamp: msg.timestamp || startedAtStr,
			}));

		results.push({
			sessionId: frontmatter.threadid || file.replace(".md", ""),
			startedAt: startedAtStr,
			userMessages,
		});
	}

	return JSON.stringify(results);
}

/**
 * Reflection tool: reads session files, filters by date window and ignore patterns,
 * extracts user messages, returns structured JSON data.
 */
export const reflection = tool(
	(input) =>
		reflectionImpl(input, {
			sessionsDir: "memory/sessions/",
		}),
	{
		name: "reflection",
		description:
			"Read session files, filter by date window and ignore patterns, extract user messages, return structured data.",
		schema: z.object({
			ignorePatterns: z
				.array(z.string())
				.optional()
				.describe(
					"Patterns to exclude sessions containing. If a session's content (frontmatter or body) contains any of these, the session is excluded.",
				),
			windowDays: z
				.number()
				.int()
				.min(1)
				.optional()
				.describe("How far back to look in days (default 7)"),
		}),
	},
);
