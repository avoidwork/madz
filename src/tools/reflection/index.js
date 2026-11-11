import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readFile, readdir, stat } from "node:fs/promises";
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
	} catch (_err) {
		// Try to extract a JSON array from the body if the full parse fails
		const arrayMatch = body.match(/\[[\s\S]*\]/);
		if (arrayMatch) {
			try {
				messages = JSON.parse(arrayMatch[0]);
			} catch (_err2) {
				throw new Error("Invalid JSON body");
			}
		} else {
			throw new Error("Invalid JSON body");
		}
	}

	return { frontmatter, messages, rawBody: body };
}

/**
 * Convert a wildcard pattern (using * as glob wildcard) to a RegExp.
 * @param {string} pattern - Pattern with * as wildcard
 * @returns {RegExp}
 */
function patternToRegExp(pattern) {
	const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regexStr = escaped.replace(/\\\*/g, ".*");
	return new RegExp(regexStr, "i");
}

/**
 * Check if content matches any of the ignore patterns (supports * wildcards).
 * @param {string} content - Content to check (frontmatter + body)
 * @param {string[]} patterns - Patterns to match against (supports * wildcard)
 * @returns {boolean}
 */
function matchesIgnorePatterns(content, patterns) {
	if (!patterns || patterns.length === 0) return false;
	return patterns.some((pattern) => {
		const regex = patternToRegExp(pattern);
		return regex.test(content);
	});
}

/**
 * Core reflection tool logic: read sessions, filter, extract user messages.
 * Processes every session within the date window to find signal — no arbitrary cap.
 * @param {z.infer<typeof ReflectionSchema>} input - The tool input
 * @param {object} options - Runtime options
 * @param {string} [options.sessionsDir] - Path to sessions directory
 * @returns {Promise<{ ok: boolean, results: Array<{ sessionId: string, startedAt: string, userMessages: Array<{ content: string, timestamp: string }> }>, error?: string }>} Structured result object
 */
export async function reflectionImpl(input, options) {
	const { ignorePatterns = [], windowDays = DEFAULT_WINDOW_DAYS } = input;
	const sessionsDir = options.sessionsDir || "memory/sessions/";

	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - windowDays);
	cutoff.setHours(0, 0, 0, 0);

	// Discover session files and their mtimes using the filesystem API.
	// Sorting by mtime (newest first) keeps the most recent sessions first.
	let entries;
	try {
		const names = await readdir(sessionsDir);
		const files = [];
		for (const name of names) {
			if (!name.endsWith(".md")) continue;
			const filePath = join(sessionsDir, name);
			try {
				const info = await stat(filePath);
				if (info.isFile()) {
					files.push({ filePath, mtime: info.mtimeMs });
				}
			} catch (_err) {
				// Skip files that cannot be stat'ed
			}
		}
		entries = files.sort((a, b) => b.mtime - a.mtime);
	} catch (err) {
		return { ok: false, error: `Failed to discover session files: ${err.message}` };
	}

	if (entries.length === 0) return { ok: true, results: [] };

	const results = [];

	for (const { filePath } of entries) {
		let content;
		try {
			content = await readFile(filePath, "utf-8");
		} catch (_err) {
			continue;
		}

		let parsed;
		try {
			parsed = parseSessionFile(content);
		} catch (_err) {
			continue;
		}

		const { frontmatter, messages, rawBody } = parsed;

		// Extract filename from full path for sessionId fallback
		const fileName = filePath.split("/").pop();

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
			sessionId: frontmatter.threadid || fileName.replace(".md", ""),
			startedAt: startedAtStr,
			userMessages,
		});
	}

	return { ok: true, results };
}

/**
 * ReflectionSessions tool: reads session files, filters by date window and ignore patterns,
 * extracts user messages, returns structured JSON data.
 */
export const reflectionSessions = tool(
	(input) =>
		reflectionImpl(input, {
			sessionsDir: "memory/sessions/",
		}),
	{
		name: "reflectionSessions",
		description:
			"Read session files, filter by date window and ignore patterns, extract user messages, return structured data.",
		schema: z.object({
			ignorePatterns: z
				.array(z.string())
				.optional()
				.describe(
					"Patterns to exclude sessions containing. Supports * as a wildcard (e.g., 'Run the * skill'). If a session's content (frontmatter or body) matches any pattern, the session is excluded.",
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
