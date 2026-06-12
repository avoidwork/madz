const WARNED_KEY = Symbol.for("madz.gc.warned");
const gcCalls = [];

import { logger } from "../logger.js";

/**
 * Check whether V8's garbage collector is exposed via global.gc.
 * @returns {boolean} True if --expose-gc flag is active
 */
export function isAvailable() {
	return typeof global.gc === "function";
}

/**
 * Trigger V8 garbage collection. Returns a result object indicating
 * whether the collection was performed, when it ran, and how many
 * GC calls have been made in the current hour window.
 * @param {number} maxGcPerHour - Maximum allowed GC calls per hour
 * @returns {{ triggered: boolean, reason?: string, hourCalls: number, lastRun?: number }}
 */
export function gc(maxGcPerHour = 4) {
	const now = Date.now();
	const windowStart = now - 60 * 60 * 1000;

	// Prune calls outside the current hour window
	for (let i = gcCalls.length - 1; i >= 0; i--) {
		if (gcCalls[i] < windowStart) {
			gcCalls.splice(i, 1);
		} else {
			break;
		}
	}

	// Check rate limit
	const hourCalls = gcCalls.length;
	if (hourCalls >= maxGcPerHour) {
		return { triggered: false, reason: "rate limited", hourCalls: maxGcPerHour };
	}

	// Check availability
	if (!isAvailable()) {
		if (!process[WARNED_KEY]) {
			process[WARNED_KEY] = true;
			logger.warn("[gc] V8 GC not available. Start with --expose-gc flag.");
		}
		return { triggered: false, reason: "gc not available", hourCalls };
	}

	// Prune one more time after window edge case
	const effectiveWindowStart = now - 60 * 60 * 1000;
	for (let i = gcCalls.length - 1; i >= 0; i--) {
		if (gcCalls[i] < effectiveWindowStart) {
			gcCalls.splice(i, 1);
		} else {
			break;
		}
	}

	global.gc();
	const lastRun = Date.now();
	gcCalls.push(lastRun);

	return { triggered: true, hourCalls: gcCalls.length, lastRun };
}

/**
 * Initialize the GC manager with an idle timer. Calls the provided
 * idle callback after the configured timeout. The timer resets on
 * every call to onActivity().
 *
 * @param {Object} opts
 * @param {number} opts.idleTimeoutMs - Milliseconds before idle GC triggers
 * @param {number} opts.maxGcPerHour - Max GC calls per hour
 * @param {(args: { triggered: boolean; reason?: string; hourCalls: number }) => void} opts.onIdle - Called when idle timeout fires
 * @returns {{ stop: () => void, onActivity: () => void }} Controller with stop() and onActivity() methods
 */
export function initGC({ idleTimeoutMs, maxGcPerHour, onIdle }) {
	let timerId = null;

	function clearTimer() {
		if (timerId !== null) {
			clearTimeout(timerId);
			timerId = null;
		}
	}

	function startTimer() {
		clearTimer();
		timerId = setTimeout(() => {
			timerId = null;
			onIdle(gc(maxGcPerHour));
		}, idleTimeoutMs);
	}

	startTimer();

	const controller = {
		/**
		 * Signal user activity, resetting the idle timer.
		 */
		onActivity() {
			startTimer();
		},

		/**
		 * Stop the GC manager and clear the idle timer.
		 */
		stop() {
			clearTimer();
		},
	};

	return controller;
}

/**
 * Get all GC calls made in the current hour window.
 * @returns {number[]} Timestamps of GC calls within the last hour
 */
export function getGcCalls() {
	const now = Date.now();
	const windowStart = now - 60 * 60 * 1000;
	return gcCalls.filter((t) => t >= windowStart);
}

/**
 * Reset the gcCalls array (for testing).
 * @ignore
 */
export function _resetGcCalls() {
	gcCalls.length = 0;
}

/**
 * Inject timestamps into gcCalls for testing edge cases.
 * @param {number[]} timestamps - Timestamps to inject
 * @ignore
 */
export function _setGcCalls(timestamps) {
	gcCalls.length = 0;
	gcCalls.push(...timestamps);
}
