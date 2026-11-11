import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { filterUrl } from "../../sandbox/urlFilter.js";

const DEFAULT_TIMEOUT = 30000;

/**
 * Schema for a `choice` question — 2–26 named options with descriptions.
 */
const ChoiceQuestionSchema = z.object({
	type: z.literal("choice").describe("Choose one of several named options"),
	instructions: z.string().describe("What to decide"),
	criteria: z
		.record(z.string())
		.describe("Named options with descriptions (2-26)")
		.refine((c) => Object.keys(c).length >= 2 && Object.keys(c).length <= 26, {
			message: "choice criteria must have 2-26 named options",
		}),
});

/**
 * Schema for a `noul` (yes/no) question — optional descriptions for false/true.
 */
const NoulQuestionSchema = z.object({
	type: z.literal("noul").describe("Yes/no probability question"),
	instructions: z.string().describe("What to decide"),
	criteria: z
		.record(z.string())
		.describe("Optional descriptions for 'false' and 'true'")
		.optional(),
});

/**
 * Schema for a `score` question — 2–10 ordered descriptions, lowest to highest.
 */
const ScoreQuestionSchema = z.object({
	type: z.literal("score").describe("Score against ordered criteria"),
	instructions: z.string().describe("What to decide"),
	criteria: z
		.array(z.string())
		.describe("Ordered levels, lowest to highest (2-10)")
		.refine((c) => c.length >= 2 && c.length <= 10, {
			message: "score criteria must have 2-10 ordered levels",
		}),
});

/**
 * Schema for a single decision question, discriminated by `type`.
 * Each type enforces its own criteria shape per the SystemOne decision guide.
 */
const QuestionSchema = z.discriminatedUnion("type", [
	ChoiceQuestionSchema,
	NoulQuestionSchema,
	ScoreQuestionSchema,
]);

/**
 * Permissive schema for the decision tool input.
 * `state` may be a string or a JSON object/array; `questions` is a record of
 * named questions, each with a different `type`.
 */
export const DecisionToolSchema = z.object({
	state: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
	questions: z.record(QuestionSchema),
});

/**
 * Call the SystemOne `/v1/systemone` endpoint for fast, structured classification.
 * @param {object} config - Decision config ({ baseUrl, model })
 * @param {object} input - Tool input ({ state, questions })
 * @param {number} timeout - Request timeout in ms
 * @returns {Promise<{ ok: boolean, answers?: object, error?: string }>}
 */
async function callSystemOne(config, input, timeout) {
	const baseUrl = config.baseUrl.replace(/\/+$/, "");
	const url = `${baseUrl}/v1/systemone`;

	const urlCheck = filterUrl(url);
	if (!urlCheck.allowed) {
		return { ok: false, error: `Invalid decision baseUrl: ${urlCheck.reason}` };
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const resp = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: config.model,
				state: input.state,
				questions: input.questions,
			}),
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return { ok: false, error: `SystemOne error (${resp.status}): ${text.slice(0, 200)}` };
		}

		const data = await resp.json();
		if (!data.answers || typeof data.answers !== "object" || Array.isArray(data.answers)) {
			return { ok: false, error: "SystemOne response missing answers" };
		}

		return { ok: true, answers: data.answers };
	} catch (err) {
		clearTimeout(timeoutId);
		return { ok: false, error: `SystemOne request failed: ${err.message}` };
	}
}

/**
 * Decision tool — wraps the SystemOne `/v1/systemone` endpoint for fast, structured
 * classification (routing, policy checks, rubric scoring).
 * @param {z.infer<typeof DecisionToolSchema>} input - Tool input
 * @param {object} [options] - Runtime options
 * @param {object} [options.decisionConfig] - Decision config ({ baseUrl, model })
 * @returns {Promise<object>} Result object with structured answers
 */
export async function decisionImpl(input, options = {}) {
	const config = options.decisionConfig;
	if (!config?.baseUrl) {
		return {
			ok: false,
			error: "Decision tool is not configured (agent.decision.baseUrl is empty)",
		};
	}

	const { state, questions } = input;
	const isEmptyState =
		state === undefined ||
		state === null ||
		state === "" ||
		(typeof state === "object" && Object.keys(state).length === 0);
	if (isEmptyState) {
		return { ok: false, error: "state is required and must be a non-empty string or object" };
	}
	if (
		!questions ||
		typeof questions !== "object" ||
		Array.isArray(questions) ||
		Object.keys(questions).length === 0
	) {
		return { ok: false, error: "questions is required and must be a non-empty record" };
	}

	const timeoutMs = config.timeout || DEFAULT_TIMEOUT;
	const result = await callSystemOne(config, { state, questions }, timeoutMs);
	if (!result.ok) {
		return { ok: false, error: result.error };
	}

	return { ok: true, answers: result.answers };
}

/**
 * Decision tool instance.
 */
export const decision = tool(decisionImpl, {
	name: "decision",
	description:
		"Make fast, structured decisions using a local decision model via the SystemOne /v1/systemone endpoint. Accepts a state (string or JSON object/array) and a questions record, where each question has a type (choice, noul, or score), instructions, and usually criteria. Returns the structured answers from the model. Config-gated: only registered when agent.decision.baseUrl is set.",
	schema: DecisionToolSchema,
});
