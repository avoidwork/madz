import { metrics } from "@opentelemetry/api";

const METER_NAME = "madz-harness";

/**
 * Create a token usage counter backed by an OpenTelemetry counter.
 * @returns {{ record: Function, name: string, kind: string }} Counter wrapper
 */
export function createTokenCounter() {
	const name = "llm.usage.tokens";
	const counter = metrics.getMeter(METER_NAME).createCounter(name, { unit: "{token}" });
	return {
		name,
		kind: "counter",
		record: function (inputTokens, outputTokens) {
			if (inputTokens) counter.add(inputTokens, { "llm.token.type": "input" });
			if (outputTokens) counter.add(outputTokens, { "llm.token.type": "output" });
			return {
				inputTokens,
				outputTokens,
				total: (inputTokens || 0) + (outputTokens || 0),
			};
		},
	};
}

/**
 * Create a duration histogram backed by an OpenTelemetry histogram.
 * @returns {{ record: Function, name: string, kind: string }} Histogram wrapper
 */
export function createDurationHistogram() {
	const name = "skill.execution.duration";
	const histogram = metrics.getMeter(METER_NAME).createHistogram(name, { unit: "ms" });
	return {
		name,
		kind: "histogram",
		record: function (durationMs) {
			if (typeof durationMs === "number") histogram.record(durationMs);
			return { duration: durationMs };
		},
	};
}
