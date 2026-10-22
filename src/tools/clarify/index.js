import { z } from "zod";
import { interrupt } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { writeFile, mkdir, readFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { loadConfig } from "../../config/loader.js";

/**
 * Check if a file path is accessible.
 * @param {string} filePath - Path to check
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
 * Core clarification logic: format choices, store question, interrupt the
 * agent to surface the question to the user, and capture the reply.
 *
 * The tool pauses the graph via LangGraph's `interrupt()`, which requires a
 * checkpointer. The interrupt value carries the question (and choices) so the
 * TUI can render a prompt. The graph is resumed with `Command({ resume })`,
 * and the resumed value is the user's answer. Only then is `answered` true.
 *
 * The question is also appended to the clarifications file for session context.
 * @param {z.infer<typeof ClarifySchema>} input - The tool input
 * @param {object} options - Runtime options
 * @param {string} [options.clarificationsFile] - Path to clarifications file (default "memory/tools/clarifications.md")
 * @returns {Promise<string>} Clarification result
 */
export async function clarifyImpl(input, options) {
	const { question, choices } = input;
	const config = loadConfig();
	const toolsDir = config.memory?.toolsDir || "memory/tools/";
	const clarificationsFile =
		options?.clarificationsFile || join(config.cwd, toolsDir, "clarifications.md");

	// Format choices as numbered list if provided
	let choicesFormatted = "";
	if (choices && choices.length > 0) {
		choicesFormatted = "\n\nOptions:\n" + choices.map((c, i) => `${i + 1}. ${c}`).join("\n");
	}

	// Store the question for session context
	const timestamp = new Date().toISOString();
	const entry = `## Clarification: ${question}\n\n- Time: ${timestamp}\n${choicesFormatted ? `\n- Options: ${choicesFormatted.replace(/\n/g, ", ")}` : ""}`;

	// Ensure directory exists
	const dir = dirname(clarificationsFile);
	if (dir && !(await pathExists(dir))) {
		await mkdir(dir, { recursive: true });
	}

	// Append to clarifications file
	const existing = (await pathExists(clarificationsFile))
		? await readFile(clarificationsFile, "utf-8")
		: "";
	await writeFile(clarificationsFile, existing + "\n\n" + entry + "\n", "utf-8");

	// Pause the agent and surface the question to the user. The interrupt value
	// carries the question (and choices) so the TUI can render a prompt. The
	// graph is resumed with `Command({ resume })`, and the resumed value is the
	// user's answer. `interrupt()` returns the resume value when the graph is
	// re-invoked, so `answered` is only true once a real answer is received.
	const answer = interrupt({ question, ...(choices && choices.length > 0 ? { choices } : {}) });

	return JSON.stringify({
		answered: true,
		question,
		...(choices && choices.length > 0 ? { choices } : {}),
		answer,
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
		"Send a clarification question to the user. Supports open-ended questions and choice prompts. Interrupts the agent to surface the question, captures the user's reply, and stores the question for session context in memory/tools/clarifications.md.",
	schema: z.object({
		question: z.string().describe("The clarification question to ask the user"),
		choices: z
			.array(z.string())
			.optional()
			.describe("Numbered choices for the user to select from"),
	}),
});
