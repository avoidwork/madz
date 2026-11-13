import { ParentBasedSampler, TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace";

const DEFAULT_RATIO = 0.1;

/**
 * Resolve the sampling ratio from telemetry config. A ratio of 0 is honoured.
 * @param {Object} [config] - Telemetry config with sampling.ratio
 * @returns {number} Ratio clamped to [0, 1]
 */
export function resolveSamplingRatio(config) {
	const ratio = config?.sampling?.ratio ?? DEFAULT_RATIO;
	return Math.max(0, Math.min(1, ratio));
}

/**
 * Create an OpenTelemetry sampler that honours the parent decision and
 * samples root spans by trace-id ratio.
 * @param {number} [ratio] - Sampling ratio (0.0 to 1.0)
 * @returns {import("@opentelemetry/sdk-trace").Sampler} The sampler
 */
export function createSampler(ratio = DEFAULT_RATIO) {
	return new ParentBasedSampler({
		root: new TraceIdRatioBasedSampler(resolveSamplingRatio({ sampling: { ratio } })),
	});
}

/**
 * Load a sampler from telemetry config.
 * @param {Object} [config] - Telemetry config with sampling.ratio
 * @returns {import("@opentelemetry/sdk-trace").Sampler} The sampler
 */
export function loadSampler(config) {
	return createSampler(resolveSamplingRatio(config));
}
