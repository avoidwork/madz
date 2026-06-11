import { enforceMaxEntries } from "./retention.js";

/**
 * Garbage collect the TUI messages array, trimming to the configured window.
 * @param {Array} messages - The messages array to trim
 * @param {number} messageWindow - Maximum number of messages to retain
 * @returns {{ trimmed: boolean, removedCount: number }} Result of trimming
 */
function trimMessages(messages, messageWindow) {
	if (!Array.isArray(messages) || messages.length <= messageWindow) {
		return { trimmed: false, removedCount: 0 };
	}
	const removedCount = messages.length - messageWindow;
	return { trimmed: true, removedCount };
}

/**
 * Garbage collect memory context entries, enforcing the configured maximum.
 * @param {string} contextDir - Path to the memory context directory
 * @param {number} maxContextEntries - Maximum number of entries to retain
 * @returns {{ trimmed: boolean, removedCount: number }} Result of trimming
 */
function trimMemoryContext(contextDir, maxContextEntries) {
	const removedCount = enforceMaxEntries(contextDir, maxContextEntries);
	return { trimmed: removedCount > 0, removedCount };
}

/**
 * Perform garbage collection on messages and memory context.
 * Returns a summary of what was trimmed.
 * @param {Object} config - The full application config (must contain memory.gc)
 * @param {Array} [messages] - Optional TUI messages array to trim
 * @returns {{ messagesTrimmed: boolean, messagesRemoved: number, contextTrimmed: boolean, contextRemoved: number }}
 */
export function gcCollect(config, messages) {
	const gcConfig = config?.memory?.gc || {};
	const messageWindow = gcConfig.messageWindow ?? 100;
	const maxContextEntries = gcConfig.maxContextEntries ?? 100;
	const contextDir = config?.memory?.contextDir ?? "memory/context/";

	const messageResult = trimMessages(messages, messageWindow);
	const contextResult = trimMemoryContext(contextDir, maxContextEntries);

	return {
		messagesTrimmed: messageResult.trimmed,
		messagesRemoved: messageResult.removedCount,
		contextTrimmed: contextResult.trimmed,
		contextRemoved: contextResult.removedCount,
	};
}

/**
 * Trim a messages array in-place to the configured window.
 * Mutates the array by splicing off the oldest entries.
 * @param {Array} messages - The messages array to trim (mutated in-place)
 * @param {number} messageWindow - Maximum number of messages to retain
 * @returns {number} Number of messages removed
 */
export function trimMessagesInPlace(messages, messageWindow) {
	if (!Array.isArray(messages) || messages.length <= messageWindow) {
		return 0;
	}
	const removed = messages.length - messageWindow;
	messages.splice(0, removed);
	return removed;
}
