/**
 * Create a token usage counter for LLM token metrics.
 * @returns {{ record: Function, name: string }}
 */
export function createTokenCounter() {
	return {
		name: "llm.usage.tokens",
		kind: "counter",
		record: function (inputTokens, outputTokens) {
			return {
				inputTokens,
				outputTokens,
				total: (inputTokens || 0) + (outputTokens || 0),
			};
		},
	};
}

/**
 * Create a duration histogram for skill execution metrics.
 * @returns {{ record: Function, name: string }}
 */
export function createDurationHistogram() {
	return {
		name: "skill.execution.duration",
		kind: "histogram",
		record: function (durationMs) {
			return {
				duration: durationMs,
			};
		},
	};
}
