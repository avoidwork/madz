import { z } from "zod";
import { interrupt } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { appendFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { loadConfig } from "../../config/loader.js";
import { logger } from "../../shared/logger.js";
import { normalizeChoices, resolveChoice } from "../../shared/clarifyPrompt.js";

/**
 * Input schema for the `clarify` tool.
 */
export const ClarifySchema = z.object({
	question: z.string().trim().min(1).describe("The clarification question to ask the user"),
	choices: z
		.array(z.string().trim().min(1))
		.refine((items) => new Set(items).size === items.length, "Choices must be unique")
		.optional()
		.describe(
			"Options for the user to choose from. Do not number them: they are numbered for the user, who can reply with a number.",
		),
});

/**
 * Collapse a value to a single line so it cannot break the markdown structure
 * of the clarifications file.
 * @param {unknown} value - The value to flatten
 * @returns {string} The value on one line
 */
function oneLine(value) {
	return String(value)
		.replace(/\s*\n\s*/g, " ")
		.trim();
}

/**
 * Append a question and its answer to the clarifications file for session
 * context. Best effort: a failure is logged and never stops the agent.
 * @param {string} [file] - Path to the clarifications file (default `<memory.toolsDir>/clarifications.md`)
 * @param {{ question: string, choices: string[], answer: unknown }} entry - What to record
 * @returns {Promise<void>}
 */
async function recordClarification(file, { question, choices, answer }) {
	try {
		const config = loadConfig();
		const toolsDir = config.memory?.toolsDir || "memory/tools/";
		const target = file || join(config.cwd, toolsDir, "clarifications.md");
		const lines = [
			`## Clarification: ${oneLine(question)}`,
			"",
			`- Time: ${new Date().toISOString()}`,
		];
		if (choices.length > 0) {
			lines.push(`- Options: ${choices.map((c, i) => `${i + 1}. ${oneLine(c)}`).join(", ")}`);
		}
		lines.push(`- Answer: ${oneLine(answer)}`);
		await mkdir(dirname(target), { recursive: true });
		await appendFile(target, `\n\n${lines.join("\n")}\n`, "utf-8");
	} catch (error) {
		logger.warn(`clarify: could not record clarification: ${error.message}`);
	}
}

/**
 * Core clarification logic: pause the agent to ask the user, then resolve and
 * record the reply.
 *
 * The tool pauses the graph via LangGraph's `interrupt()`, which requires a
 * checkpointer. The interrupt value carries the question (and choices) so the
 * TUI can render a prompt. The graph is resumed with `Command({ resume })`, and
 * the resumed value is the user's answer. When the node is resumed LangGraph
 * runs it again from the top, so everything before `interrupt()` runs twice and
 * everything after it runs once. The answer is recorded after it for that reason.
 *
 * A reply that is a number in range (`2`, `2.`, `2)`) is resolved to that
 * choice, with the original kept as `raw`.
 * @param {z.infer<typeof ClarifySchema>} input - The tool input
 * @param {object} [options] - Runtime options
 * @param {string} [options.clarificationsFile] - Path to the clarifications file (default `<memory.toolsDir>/clarifications.md`)
 * @returns {Promise<object>} Structured result object
 */
export async function clarifyImpl(input, options) {
	let question;
	let choices;
	try {
		({ question } = input);
		choices = normalizeChoices(input.choices);
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}

	// `interrupt()` throws a `GraphInterrupt` control-flow signal that must
	// propagate to the graph, so it stays outside any try/catch. It returns the
	// resume value once the graph is re-invoked, so `answered` is only true once
	// a real answer is received.
	const reply = interrupt({ question, ...(choices.length > 0 ? { choices } : {}) });
	const answer = resolveChoice(reply, choices);

	await recordClarification(options?.clarificationsFile, { question, choices, answer });

	return {
		ok: true,
		answered: true,
		question,
		...(choices.length > 0 ? { choices } : {}),
		answer,
		...(answer !== reply ? { raw: reply } : {}),
		source: choices.length > 0 ? "choices" : "open_ended",
	};
}

/**
 * @param {z.infer<typeof ClarifySchema>} input - The tool input
 * @param {object} [options] - Runtime options
 * @returns {Promise<object>} Structured result object
 */
export const clarify = tool(clarifyImpl, {
	name: "clarify",
	description:
		"Ask the user a clarification question. Supports open-ended questions and choice prompts: " +
		"choices are shown as a numbered list and the user can reply with a number, which is " +
		"returned as the chosen option. Interrupts the agent to surface the question, captures the " +
		"user's reply, and records the question and answer in memory/tools/clarifications.md.",
	schema: ClarifySchema,
});
