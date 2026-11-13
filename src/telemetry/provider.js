import { trace } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { TelemetrySchema } from "../config/schemas/telemetry.js";
import { isSchemeAllowed } from "../sandbox/urlFilter.js";
import { LogSpanExporter } from "./logSpanExporter.js";
import { loadSampler } from "./sampler.js";

let sdk = null;

/**
 * Build the OTLP exporters for the configured protocol.
 * @param {{protocol: string, endpoint: string, timeoutMs: number}} exporter - Exporter config
 * @returns {Promise<{spanExporter: Object, metricExporter: Object|null}>} Exporters
 */
async function buildExporters(exporter) {
	if (exporter.protocol === "console") {
		return { spanExporter: new LogSpanExporter(), metricExporter: null };
	}
	if (!isSchemeAllowed(exporter.endpoint)) {
		throw new Error(`telemetry exporter endpoint has a disallowed scheme: ${exporter.endpoint}`);
	}
	const timeoutMillis = exporter.timeoutMs;
	if (exporter.protocol === "grpc") {
		const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-grpc");
		const { OTLPMetricExporter } = await import("@opentelemetry/exporter-metrics-otlp-grpc");
		const options = { url: exporter.endpoint, timeoutMillis };
		return {
			spanExporter: new OTLPTraceExporter(options),
			metricExporter: new OTLPMetricExporter(options),
		};
	}
	const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
	const { OTLPMetricExporter } = await import("@opentelemetry/exporter-metrics-otlp-http");
	const base = exporter.endpoint.replace(/\/+$/, "").replace(/\/v1\/(traces|metrics)$/, "");
	return {
		spanExporter: new OTLPTraceExporter({ url: `${base}/v1/traces`, timeoutMillis }),
		metricExporter: new OTLPMetricExporter({ url: `${base}/v1/metrics`, timeoutMillis }),
	};
}

/**
 * Initialize OpenTelemetry provider with configurable exporter. Idempotent:
 * a second call returns the already-running SDK.
 * @param {Object} config - The telemetry config section from loadConfig()
 * @returns {Promise<NodeSDK | null>} The configured SDK or null if disabled
 */
export async function initTelemetry(config = {}) {
	if (!config || !config.enabled) {
		return null;
	}
	if (sdk) {
		return sdk;
	}

	const parsed = TelemetrySchema.parse(config);
	const { spanExporter, metricExporter } = await buildExporters(parsed.exporter);

	const next = new NodeSDK({
		sampler: loadSampler(parsed),
		spanProcessors: [new BatchSpanProcessor({ exporter: spanExporter })],
		metricReaders: metricExporter
			? [new PeriodicExportingMetricReader({ exporter: metricExporter })]
			: [],
		instrumentations: [getNodeAutoInstrumentations()],
	});

	await next.start();
	sdk = next;
	return sdk;
}

/**
 * Get the OTEL tracer for the harness (no-op tracer until the SDK starts).
 * @returns {import("@opentelemetry/api").Tracer} The tracer
 */
export function getTracer() {
	return trace.getTracer("madz-harness");
}

/**
 * Shut down the telemetry SDK, flushing all pending spans and metrics.
 * @returns {Promise<void>}
 */
export async function shutdownTelemetry() {
	if (!sdk) return;
	const current = sdk;
	sdk = null;
	await current.shutdown();
}

/**
 * Check if telemetry is active.
 * @returns {boolean} True when the SDK is running
 */
export function isTelemetryEnabled() {
	return sdk !== null;
}
