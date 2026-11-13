import { ExportResultCode } from "@opentelemetry/core";
import { logger } from "../shared/logger.js";
import { redactAttributes } from "./redaction.js";

/**
 * Span exporter that writes redacted span summaries to the structured logger
 * instead of stdout (which would corrupt the TUI).
 */
export class LogSpanExporter {
	/**
	 * Log each span.
	 * @param {Array<Object>} spans - Finished spans
	 * @param {Function} resultCallback - Receives { code }
	 * @returns {void}
	 */
	export(spans, resultCallback) {
		for (const span of spans) {
			logger.debug(`span ${span.name}`, {
				traceId: span.spanContext().traceId,
				durationMs: span.duration[0] * 1e3 + span.duration[1] / 1e6,
				attributes: redactAttributes(span.attributes),
			});
		}
		resultCallback({ code: ExportResultCode.SUCCESS });
	}

	/**
	 * Nothing to release.
	 * @returns {Promise<void>}
	 */
	async shutdown() {}

	/**
	 * Nothing buffered.
	 * @returns {Promise<void>}
	 */
	async forceFlush() {}
}
