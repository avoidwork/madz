import { SemanticAttributes } from "@opentelemetry/semantic-conventions";

/**
 * Create an LLM span for a provider call.
 * @param {Object} options - Required: tracer, config, redact
 * @param {string} options.provider - Provider name (e.g., "openai")
 * @param {string} options.model - Model identifier
 * @param {number} options.inputTokens - Input token count
 * @param {number} options.outputTokens - Output token count
 * @param {number} options.latencyMs - Latency in milliseconds
 * @param {Function} [options.redact] - Redaction function
 * @returns {Object} Span context
 */
export async function instrumentLlmCall(options) {
	const { provider, model, inputTokens, outputTokens, latencyMs, redact } = options;

	const attributes = {
		[SemanticAttributes.ML_SYSTEM]: provider,
		[SemanticAttributes.ML_REQUEST_MODEL_NAME]: model,
		"llm.input_tokens": inputTokens || 0,
		"llm.output_tokens": outputTokens || 0,
		"llm.total_tokens": (inputTokens || 0) + (outputTokens || 0),
		"llm.latency_ms": latencyMs,
	};

	const redactedAttributes = redact ? redact(attributes) : attributes;

	return {
		spans: [],
		attributes: redactedAttributes,
	};
}
