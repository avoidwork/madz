import { checkLoop } from "./loopCheck.js";

/**
 * Piscina worker entry point for loop detection.
 *
 * Runs the text checks off the main event loop. Stateless: each task carries
 * the text to check, so any worker thread can serve any task.
 *
 * @param {Object} task - The check to run
 * @param {string} task.text - Accumulated stream text
 * @param {number} task.windowSize - Recent completed sentences to compare
 * @param {number} task.threshold - Repeats above which a loop is flagged
 * @returns {boolean} True when the text is looping
 */
export default function loopWorker({ text, windowSize, threshold }) {
	return checkLoop(text, { windowSize, threshold });
}
