import { checkLoop } from "./loopCheck.js";

/**
 * Piscina worker entry point for loop detection.
 *
 * Runs the check off the main event loop. Stateless: each task carries the
 * recent sentences and words, so any worker thread can serve any task.
 *
 * @param {Object} task - The check to run
 * @param {string[]} task.sentences - Recent completed sentences
 * @param {string[]} task.words - Recent completed words
 * @param {number} task.threshold - Repeats above which a loop is flagged
 * @param {number} [task.similarityThreshold=0.85] - Minimum sentence similarity to count a garbled repeat
 * @param {number} [task.maxLoopSentences=5] - Longest sentence loop to detect, in sentences
 * @returns {boolean} True when the stream is looping
 */
export default function loopWorker(task) {
	return checkLoop(task);
}
