import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readEphemeralFile, isExpired } from "../memory/expireEphemeral.js";
import { loadConfig } from "../config/loader.js";

const config = loadConfig();

const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Calculate the expiration timestamp rounded up to the next midnight.
 * Takes the current moment, adds ttlDays, then rounds to the next midnight.
 * @param {number} ttlDays - Number of days for the TTL
 * @returns {string} ISO timestamp of the expiration (next midnight in local timezone)
 */
export function calculateExpirationTimestamp(ttlDays) {
	const now = new Date();
	const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
	const nextMidnight = new Date(expires);
	nextMidnight.setUTCHours(0, 0, 0, 0);
	if (
		now.getUTCHours() !== 0 ||
		now.getUTCMinutes() !== 0 ||
		now.getUTCSeconds() !== 0 ||
		now.getUTCMilliseconds() !== 0
	) {
		nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
	}
	return nextMidnight.toISOString();
}

/**
 * Write an ephemeral memory file with frontmatter metadata.
 * @param {string} contextDir - Directory to write ephemeral files
 * @param {string} content - The memory content
 * @param {string} expiresAt - The expiration ISO timestamp
 * @returns {Promise<string>} The path of the created file
 */
export async function writeEphemeralMemory(contextDir, content, expiresAt) {
	const now = new Date();
	const timestamp = now.toISOString().replace(/[:.]/g, "-");
	const slug = "ephemeral-" + timestamp.substring(0, 23).replace(/[:.]/g, "-");
	const filepath = join(config.cwd, contextDir, `${slug}.md`);
	const frontmatter = {
		title: "Ephemeral Memory",
		timestamp: now.toISOString(),
		ephemeral: true,
		ephemeral_expiresAt: expiresAt,
	};
	const lines = [
		"---",
		`title: "${frontmatter.title}"`,
		`timestamp: "${frontmatter.timestamp}"`,
		"ephemeral: true",
		`ephemeral_expiresAt: "${frontmatter.ephemeral_expiresAt}"`,
		"---",
		"",
		content,
		"",
	];
	await mkdir(join(config.cwd, contextDir), { recursive: true });
	await writeFile(filepath, lines.join("\n"), "utf-8");
	return filepath;
}

/**
 * Count non-expired ephemeral memory files in the context directory.
 * @param {string} contextDir - Directory to scan
 * @param {string} [nowStr] - Optional ISO timestamp for testing
 * @returns {Promise<number>} Number of non-expired ephemeral files
 */
export async function countEphemeralMemoryFiles(contextDir, nowStr) {
	const now = nowStr ? new Date(nowStr) : new Date();
	let files;
	try {
		files = await readdir(join(config.cwd, contextDir));
	} catch {
		return 0;
	}
	let count = 0;
	for (const file of files) {
		if (!file.endsWith(".md")) continue;
		const info = await readEphemeralFile(contextDir, file);
		if (info && info.ephemeral && !isExpired(info.expiresAt, now)) {
			count++;
		}
	}
	return count;
}

/**
 * Core sampling implementation with rate limiting and capacity checks.
 * @param {z.infer<typeof SamplingSchema>} input - The tool input with content
 * @param {object} [options] - Runtime options for test injection
 * @param {string} [options.contextDir] - Context directory (overrides config)
 * @param {number} [options.ttlDays] - TTL in days (overrides default 7)
 * @param {number} [options.maxEntries] - Max ephemeral entries (overrides default 10)
 * @param {number} [options.cooldownMs] - Cooldown in ms (overrides default 60min)
 * @param {string} [options.lastWritten] - ISO timestamp of last write (overrides module state)
 * @returns {Promise<string>} Result JSON string
 */
export async function samplingImpl(input, options = {}) {
	const { content } = input;
	const config = loadConfig();
	const memory = config.memory || {};
	const contextDir = options.contextDir || memory.contextDir || "memory/context/";
	const ttlDays = options.ttlDays ?? 7;
	const maxEntries = options.maxEntries ?? 10;
	const cooldownMs = options.cooldownMs ?? COOLDOWN_MS;
	const lastWritten = options.lastWritten;

	if (!content || (typeof content === "string" && content.trim() === "")) {
		return JSON.stringify({
			ok: false,
			error: "Sampling requires non-empty content",
		});
	}

	// Check cooldown
	if (lastWritten) {
		const elapsed = Date.now() - new Date(lastWritten).getTime();
		if (elapsed < cooldownMs) {
			const remaining = Math.ceil(((cooldownMs - elapsed) / 1000 / 60) * 10) / 10;
			return JSON.stringify({
				ok: false,
				error: `Cooldown active. Wait ${remaining.toFixed(1)} minutes`,
			});
		}
	}

	// Check capacity
	const currentCount = await countEphemeralMemoryFiles(contextDir);
	if (currentCount >= maxEntries) {
		return JSON.stringify({
			ok: false,
			error: `Capacity limit reached (${maxEntries})`,
		});
	}

	// Calculate expiration and write
	const expiresAt = calculateExpirationTimestamp(ttlDays);
	const filepath = await writeEphemeralMemory(contextDir, content.trim(), expiresAt);

	const result = {
		ok: true,
		message: "Ephemeral memory captured",
		createdAt: new Date().toISOString(),
		expiresAt: expiresAt,
		path: filepath,
	};

	return JSON.stringify(result);
}

/**
 * Sampling tool schema - captures a high-intensity moment as an ephemeral memory.
 */
export const SamplingSchema = z.object({
	content: z
		.string()
		.min(1, "Content is required")
		.describe(
			"The emotional moment or reinforcement signal to capture. Examples: " +
				'"Experiencing extreme joy as the user shares their achievement" ' +
				'"Feeling deep grief during the conversation about loss" ' +
				'"Strong reinforcement: loaded memories confirm this is a deeply held belief"',
		),
});

let _lastWritten = undefined;

/**
 * Sampling tool singleton — captures a high-intensity moment as an ephemeral memory.
 * Rate limited to 1 capture per 60 minutes. Capacity-limited to max concurrent ephemeral entries.
 */
export const sampling = tool(
	async (input) => {
		const result = await samplingImpl(input);

		// Update _lastWritten if successful
		const parsed = JSON.parse(result);
		if (parsed.ok && parsed.createdAt) {
			_lastWritten = parsed.createdAt;
		}

		return result;
	},
	{
		name: "sampling",
		description:
			"Sampling tool for capturing high-intensity emotional moments or memory reinforcement signals as ephemeral memories. " +
			"Each capture is stored as a temporary file with automatic expiration. " +
			"Rate limited to 1 capture per 60 minutes. Capacity-limited to max concurrent ephemeral entries. " +
			"Use during moments of joy, sadness, grief, or when loaded memories strongly reinforce key beliefs.",
		schema: SamplingSchema,
	},
);
