import { tool } from "@langchain/core/tools";
import { z } from "zod";

const DEFAULT_TIMEOUT = 30000;

/**
 * Permissive schema for a single decision question.
 * The `questions` object is dynamic — named questions, each with a different
 * `type` (`choice`, `noul`, or `score`). We validate only the common shape and
 * pass the rest through to Ollama.
 */
const QuestionSchema = z.object({
	type: z.enum(["choice", "noul", "score"]),
	instructions: z.string(),
	criteria: z.union([z.record(z.string()), z.array(z.string())]).optional(),
});

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
 * Call Ollama's `/v1/systemone` endpoint for fast, structured classification.
 * @param {object} config - Decision config ({ baseUrl, model, temperature })
 * @param {object} input - Tool input ({ state, questions })
 * @param {number} timeout - Request timeout in ms
 * @returns {Promise<{ ok: boolean, answers?: object, error?: string }>}
 */
async function callSystemOne(config, input, timeout) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const resp = await fetch(`${config.baseUrl}/v1/systemone`, {
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
			return { ok: false, error: `Ollama systemone error (${resp.status}): ${text.slice(0, 200)}` };
		}

		const data = await resp.json();
		if (!data.answers || typeof data.answers !== "object") {
			return { ok: false, error: "Ollama systemone response missing answers" };
		}

		return { ok: true, answers: data.answers };
	} catch (err) {
		clearTimeout(timeoutId);
		return { ok: false, error: `Ollama systemone request failed: ${err.message}` };
	}
}

/**
 * Decision tool — wraps Ollama's `/v1/systemone` endpoint for fast, structured
 * classification (routing, policy checks, rubric scoring).
 * @param {z.infer<typeof DecisionToolSchema>} input - Tool input
 * @param {object} [options] - Runtime options
 * @param {object} [options.decisionConfig] - Decision config ({ baseUrl, model, temperature })
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
	if (state === undefined || state === null || state === "") {
		return { ok: false, error: "state is required and must be a non-empty string or object" };
	}
	if (!questions || typeof questions !== "object" || Object.keys(questions).length === 0) {
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
		"Make fast, structured decisions using a local decision model via Ollama's /v1/systemone endpoint. Accepts a state (string or JSON object/array) and a questions record, where each question has a type (choice, noul, or score), instructions, and usually criteria. Returns the structured answers from the model. Config-gated: only registered when agent.decision.baseUrl is set.",
	schema: DecisionToolSchema,
});
