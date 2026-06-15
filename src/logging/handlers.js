import { logger } from "./config.js";

// ---------------------------------------------------------------------------
// Section 1: Truncation utilities
// ---------------------------------------------------------------------------

/**
 * Truncate a string to the specified max length.
 * @param {string} str - String to truncate
 * @param {number} [maxLen=200] - Maximum length
 * @returns {string} Truncated string
 */
function truncate(str, maxLen = 200) {
	if (!str) return "";
	const s = typeof str === "string" ? str : JSON.stringify(str);
	return s.length > maxLen ? s.slice(0, maxLen) + "..." : s;
}

/**
 * Safely extract a string from a value (string or object).
 * @param {unknown} value - Value to extract string from
 * @returns {string} String representation
 */
function toString(value) {
	if (typeof value === "string") return value;
	if (typeof value === "object" && value !== null) {
		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}
	return String(value || "");
}

// ---------------------------------------------------------------------------
// Section 2: Tool call duration tracker
// ---------------------------------------------------------------------------

/**
 * Track tool call start timestamps for duration calculation.
 * @type {Map<string, number>}
 */
const toolStartTimes = new Map();

/**
 * Record a tool call start time.
 * @param {string} toolCallId - The tool call ID
 */
export function recordToolStart(toolCallId) {
	toolStartTimes.set(toolCallId, Date.now());
}

/**
 * Get the duration since a tool call started.
 * @param {string} toolCallId - The tool call ID
 * @returns {number} Duration in milliseconds, or 0 if not found
 */
export function getToolDuration(toolCallId) {
	const start = toolStartTimes.get(toolCallId);
	if (!start) return 0;
	const duration = Date.now() - start;
	toolStartTimes.delete(toolCallId);
	return duration;
}

// ---------------------------------------------------------------------------
// Section 3: Event handler factory
// ---------------------------------------------------------------------------

/**
 * Create event handlers for LangGraph stream events.
 * Produces callbacks compatible with the `callback` parameter in `callReactAgentStreaming()`.
 * Each handler logs structured entries with a `type` field.
 * @param {object} [options] - Handler options
 * @param {boolean} [options.logResponses] - Whether to log LLM responses (default: true)
 * @param {boolean} [options.logCompaction] - Whether to log compaction events (default: true)
 * @returns {object} Handler functions keyed by event type
 */
export function createEventHandlers(options = {}) {
	const { logResponses = true, logCompaction = true } = options;

	return {
		/**
		 * Handle tool_start events.
		 * @param {object} event - The event data
		 * @param {string} event.toolName - Tool name
		 * @param {string} event.toolCallId - Tool call ID
		 * @param {string} [event.input] - Tool input (truncated to 200 chars)
		 */
		tool_start(event) {
			const { toolName, toolCallId, input } = event;
			logger.info({
				type: "tool_start",
				toolName,
				toolCallId,
				input: truncate(input, 200),
			});
			if (toolCallId) {
				recordToolStart(toolCallId);
			}
		},

		/**
		 * Handle tool_end events.
		 * @param {object} event - The event data
		 * @param {string} event.toolName - Tool name
		 * @param {string} event.toolCallId - Tool call ID
		 * @param {string} [event.data] - Tool result (truncated to 200 chars)
		 */
		tool_end(event) {
			const { toolName, toolCallId, data } = event;
			const duration = getToolDuration(toolCallId);
			logger.info({
				type: "tool_end",
				toolName,
				toolCallId,
				data: truncate(data, 200),
				durationMs: duration,
			});
		},

		/**
		 * Handle tool_error events.
		 * @param {object} event - The event data
		 * @param {string} event.toolName - Tool name
		 * @param {string} event.toolCallId - Tool call ID
		 * @param {string} [event.error] - Error message
		 */
		tool_error(event) {
			const { toolName, toolCallId, error } = event;
			logger.error({
				type: "tool_error",
				toolName,
				toolCallId,
				error: toString(error),
			});
		},

		/**
		 * Handle LLM response events.
		 * @param {object} event - The event data
		 * @param {string} [event.model] - Model name (if available)
		 * @param {number} [event.tokens] - Token count (if available)
		 * @param {string} [event.content] - Response content (truncated to 200 chars)
		 */
		llm_response(event) {
			if (!logResponses) return;
			const { model, tokens, content } = event;
			logger.info({
				type: "llm_response",
				model,
				tokens,
				content: truncate(content, 200),
			});
		},

		/**
		 * Handle LLM error events.
		 * @param {object} event - The event data
		 * @param {string} [event.model] - Model name
		 * @param {string} event.error - Error message
		 * @param {number} [event.retry] - Retry count
		 */
		llm_error(event) {
			const { model, error, retry } = event;
			logger.error({
				type: "llm_error",
				model,
				error: toString(error),
				retry,
			});
		},

		/**
		 * Handle compaction events.
		 * @param {object} event - The event data
		 * @param {"start"|"end"} event.action - Compaction action
		 * @param {number} [event.messageCount] - Number of messages
		 * @param {number} [event.targetTokens] - Target token count
		 */
		compaction(event) {
			if (!logCompaction) return;
			const { action, messageCount, targetTokens } = event;
			logger.info({
				type: "compaction",
				action,
				messageCount,
				targetTokens,
			});
		},
	};
}

// ---------------------------------------------------------------------------
// Section 4: Callback wrapper
// ---------------------------------------------------------------------------

/**
 * Wrap a user callback with structured logging.
 * The event handlers log first, then pass events to the user's callback.
 * Errors from the user callback are re-thrown.
 * @param {function} userCallback - The user's event callback
 * @param {object} [handlers] - Event handlers (created by createEventHandlers)
 * @returns {function} Wrapped callback
 */
export function wrapCallback(userCallback, handlers = createEventHandlers()) {
	return (event) => {
		// Log the event
		const eventType = event.type;
		if (handlers[eventType]) {
			try {
				handlers[eventType](event);
			} catch {
				// Logging should never break the app
			}
		}

		// Pass to user callback (re-throw errors)
		if (userCallback && typeof userCallback === "function") {
			userCallback(event);
		}
	};
}
