import { trace } from "@opentelemetry/api";
import {
	ATTR_GEN_AI_PROVIDER_NAME,
	ATTR_GEN_AI_REQUEST_MODEL,
	ATTR_GEN_AI_USAGE_INPUT_TOKENS,
	ATTR_GEN_AI_USAGE_OUTPUT_TOKENS,
} from "@opentelemetry/semantic-conventions/incubating";
import { redactAttributes } from "./redaction.js";

/**
 * Record a finished LLM provider call as a span. Attributes are always
 * PII-redacted before being attached.
 * @param {Object} options - Call details
 * @param {string} options.provider - Provider name (e.g., "openai")
 * @param {string} options.model - Model identifier
 * @param {number} [options.inputTokens] - Input token count
 * @param {number} [options.outputTokens] - Output token count
 * @param {number} options.latencyMs - Latency in milliseconds
 * @param {Function} [options.redact] - Extra redaction function applied after the default
 * @param {import("@opentelemetry/api").Tracer} [options.tracer] - Tracer (defaults to harness tracer)
 * @returns {{span: Object, attributes: Object}} The ended span and its attributes
 */
export function instrumentLlmCall(options) {
	const { provider, model, inputTokens, outputTokens, latencyMs, redact } = options;
	const tracer = options.tracer ?? trace.getTracer("madz-harness");

	const attributes = redactAttributes(
		{
			[ATTR_GEN_AI_PROVIDER_NAME]: provider,
			[ATTR_GEN_AI_REQUEST_MODEL]: model,
			[ATTR_GEN_AI_USAGE_INPUT_TOKENS]: inputTokens || 0,
			[ATTR_GEN_AI_USAGE_OUTPUT_TOKENS]: outputTokens || 0,
			"llm.total_tokens": (inputTokens || 0) + (outputTokens || 0),
			"llm.latency_ms": latencyMs,
		},
		redact,
	);

	const end = Date.now();
	const span = tracer.startSpan("llm.call", { startTime: end - (latencyMs || 0), attributes });
	span.end(end);

	return { span, attributes };
}
