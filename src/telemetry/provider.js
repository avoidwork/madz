import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ConsoleSpanExporter } from "@opentelemetry/exporter-trace-otlp-http";

let sdk = null;

/**
 * Initialize OpenTelemetry provider with configurable exporter.
 * @param {Object} config - The telemetry config section from loadConfig()
 * @returns {Promise<NodeSDK | null>} The configured SDK or null if disabled
 */
export async function initTelemetry(config = {}) {
	if (!config || !config.enabled) {
		return null;
	}

	const exporterConfig = config.exporter || {};
	let traceExporter;

	if (exporterConfig.protocol === "http" || exporterConfig.protocol === "grpc") {
		traceExporter = new OTLPTraceExporter({
			url: exporterConfig.endpoint || "http://localhost:4318/v1/traces",
		});
	} else {
		traceExporter = new ConsoleSpanExporter();
	}

	const ratio = (config.sampling && config.sampling.ratio) || 0.1;

	sdk = new NodeSDK({
		traceExporter,
		sampling: {
			strategy: "probability",
			probability: ratio,
		},
		instrumentations: [getNodeAutoInstrumentations()],
	});

	await sdk.start();
	return sdk;
}

/**
 * Get the current OTEL tracer for the harness.
 * @returns {Promise<import("@opentelemetry/api").Tracer>}
 */
export async function getTracer() {
	const api = await import("@opentelemetry/api");
	return api.trace.getTracer("madz-harness");
}

/**
 * Check if telemetry is initialized.
 * @returns {boolean}
 */
export function isTelemetryReady() {
	return sdk !== null;
}

/**
 * Shut down the telemetry SDK, flushing all pending spans.
 * @returns {Promise<void>}
 */
export async function shutdownTelemetry() {
	if (!sdk) return;
	await sdk.shutdown();
	sdk = null;
}

/**
 * Check if telemetry is active.
 * @returns {boolean}
 */
export function isTelemetryEnabled() {
	return sdk !== null;
}
