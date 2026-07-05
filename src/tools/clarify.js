import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { writeFile, mkdir, readFile, access } from "node:fs/promises";

/**
 * Check if a file path is accessible.
 * @param {string} filePath - Path to check
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
 * Core clarification logic: format choices, store question, append to file.
 * @param {z.infer<typeof ClarifySchema>} input - The tool input
 * @param {object} options - Runtime options
 * @param {string} [options.clarificationsFile] - Path to clarifications file (default "memory/context/clarifications.md")
 * @returns {Promise<string>} Clarification result
 */
export async function clarifyImpl(input, options) {
	const { question, choices } = input;
	const clarificationsFile = options?.clarificationsFile || "memory/context/clarifications.md";

	// Format choices as numbered list if provided
	let choicesFormatted = "";
	if (choices && choices.length > 0) {
		choicesFormatted = "\n\nOptions:\n" + choices.map((c, i) => `${i + 1}. ${c}`).join("\n");
	}

	// Store the question for session context
	const timestamp = new Date().toISOString();
	const entry = `## Clarification: ${question}\n\n- Time: ${timestamp}\n${choicesFormatted ? `\n- Options: ${choicesFormatted.replace(/\n/g, ", ")}` : ""}`;

	// Ensure directory exists
	const dir = clarificationsFile.split("/").slice(0, -1).join("/");
	if (dir && !(await pathExists("./" + dir))) {
		await mkdir("./" + dir, { recursive: true });
	}

	// Append to clarifications file
	const filePath = "./" + clarificationsFile;
	const existing = (await pathExists(filePath)) ? await readFile(filePath, "utf-8") : "";
	await writeFile(filePath, existing + "\n\n" + entry + "\n", "utf-8");

	// Since TUI is terminal-based, return as answered with placeholder
	// The actual answer comes via the next agent interaction's conversation history
	return JSON.stringify({
		answered: true,
		answer: "(user_reply_pending)",
		source: choices && choices.length > 0 ? "choices" : "open_ended",
	});
}

/**
 * @param {z.infer<typeof ClarifySchema>} input
 * @param {object} _options - Runtime options
 * @returns {string}
 */
export const clarify = tool(clarifyImpl, {
	name: "clarify",
	description:
		"Send a clarification question to the user. Supports open-ended questions and choice prompts. Stores the question for session context in memory/context/clarifications.md.",
	schema: z.object({
		question: z.string().describe("The clarification question to ask the user"),
		choices: z
			.array(z.string())
			.optional()
			.describe("Numbered choices for the user to select from"),
	}),
});