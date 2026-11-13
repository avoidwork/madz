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

	try {
		if (onShutdown) {
			await onShutdown();
		}
	} catch (err) {
		logger.error(`shutdown callback failed: ${err.message}`);
	}
}

/**
 * Register global shutdown handlers (SIGTERM, SIGINT/Ctrl+C).
 * The handler runs at most once; the logger is always flushed, then the
 * process exits with the conventional signal code (130 SIGINT, 143 SIGTERM).
 * @param {Function} handler - Shutdown callback
 * @param {Object} [options] - Options
 * @param {Function} [options.exit] - Exit function (injectable for tests, defaults to process.exit)
 * @returns {Function} Cleanup function to remove handlers
 */
export function registerShutdownHandler(handler, { exit = process.exit } = {}) {
	let started = false;
	const makeWrapped = (code) => async () => {
		if (started) return;
		started = true;
		try {
			await handler();
		} catch (err) {
			logger.error(`shutdown handler failed: ${err.message}`);
		} finally {
			try {
				await flush();
			} catch (err) {
				logger.error(`logger flush failed: ${err.message}`);
			}
		}
		exit(code);
	};
	const onTerm = makeWrapped(143);
	const onInt = makeWrapped(130);

	process.on("SIGTERM", onTerm);
	process.on("SIGINT", onInt);

	return function removeHandlers() {
		process.off("SIGTERM", onTerm);
		process.off("SIGINT", onInt);
	};
}
