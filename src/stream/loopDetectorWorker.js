import { checkLoop } from "./loopCheck.js";

/**
 * Piscina worker entry point for loop detection.
 *
 * Runs the check off the main event loop. Stateless: each task carries the
 * recent words, so any worker thread can serve any task.
 *
 * @param {Object} task - The check to run
 * @param {string[]} task.words - Recent completed words
 * @param {number} task.threshold - Occurrences above which a loop is flagged
 * @param {number} [task.minChain=5] - Shortest recurring chain length to detect
 * @param {number} [task.maxChain=8] - Longest recurring chain length to detect
 * @param {number} [task.maxRun=50] - Longest repeated run unit, in words, to detect
 * @returns {boolean} True when the stream is looping
 */
export default function loopWorker(task) {
	return checkLoop(task);
}
