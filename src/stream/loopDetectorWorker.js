import { checkLoop } from "./loopCheck.js";

/**
 * Piscina worker entry point for loop detection.
 *
 * Runs the check off the main event loop. Stateless: each task carries the
 * recent words, so any worker thread can serve any task.
 *
 * @param {Object} task - The check to run
 * @param {string[]} task.words - Recent completed words
 * @param {number} task.threshold - Occurrences above which a chain is flagged
 * @param {number} [task.minChain=3] - Shortest chain length to detect
 * @param {number} [task.maxChain=4] - Longest chain length to detect
 * @returns {boolean} True when the stream is looping
 */
export default function loopWorker(task) {
	return checkLoop(task);
}
