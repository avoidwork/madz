import { flush, logger } from "../shared/logger.js";

/**
 * Handle graceful session shutdown: flush telemetry, close file handles.
 * saveSession is no longer needed here — handleConversation saves after every exchange.
 * @param {Object} [options] - Shutdown configuration
 * @param {Function} [options.flushTelemetry] - Telemetry flush function
 * @param {Function} [options.onShutdown] - Additional cleanup callback
 * @returns {Promise<void>}
 */
export async function handleShutdown(options = {}) {
	const { flushTelemetry, onShutdown } = options;

	try {
		if (flushTelemetry) {
			await flushTelemetry();
		}
	} catch (err) {
		logger.error(`telemetry flush failed: ${err.message}`);
	}

	if (onShutdown) {
		await onShutdown();
	}
}

/**
 * Register global shutdown handlers (SIGTERM, SIGINT/Ctrl+C).
 * @param {Function} handler - Shutdown callback
 * @returns {Function} Cleanup function to remove handlers
 */
export function registerShutdownHandler(handler) {
	const wrapped = async () => {
		await handler();
		await flush();
	};

	process.on("SIGTERM", wrapped);
	process.on("SIGINT", wrapped);

	return function removeHandlers() {
		process.off("SIGTERM", wrapped);
		process.off("SIGINT", wrapped);
	};
}
