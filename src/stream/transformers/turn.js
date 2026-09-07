import { StreamChannel } from "@langchain/langgraph";

/**
 * @typedef {Object} TurnEvent
 * @property {"turn:start" | "turn:end"} type - The turn boundary event type
 * @property {number} timestamp - When the event was emitted
 * @property {string} [messageId] - The ID of the triggering message (turn:start) or
 *   the resulting AI message (turn:end)
 */

/**
 * @typedef {Object} TurnProjection
 * @property {import("@langchain/langgraph").StreamChannel<TurnEvent>} turns - Channel
 *   yielding turn boundary events
 */

/**
 * Create a StreamTransformer that emits turn:start and turn:end events.
 *
 * Watches the `updates`/`values` channel for new HumanMessage entries and
 * the `tools` channel for tool call lifecycle events. Emits `turn:start`
 * when a new HumanMessage enters state and `turn:end` when the agent
 * produces a complete AIMessage with content and no pending tool calls remain.
 *
 * @returns {import("@langchain/langgraph").StreamTransformer<TurnProjection>}
 */
export function createTurnTransformer() {
	/** @type {import("@langchain/langgraph").StreamChannel<TurnEvent>} */
	const turns = StreamChannel.local();

	/** Track pending tool calls by their ID */
	const pendingToolCalls = new Map();

	/** Track the last seen message IDs per namespace to detect new messages */
	const lastSeenMessageIds = new Set();

	/** Whether we're inside a turn (between turn:start and turn:end) */
	let inTurn = false;

	/** Re-entrant guard */
	let inSelfEmit = false;

	/** @type {import("@langchain/langgraph").StreamEmitter | null} */
	let _emitter = null;

	/**
	 * Check if a message is a HumanMessage.
	 * @param {unknown} msg
	 * @returns {msg is { _getType(): string } | { type: string }}
	 */
	function isHumanMessage(msg) {
		if (!msg || typeof msg !== "object") return false;
		// LangChain messages have _getType() method
		if (typeof msg._getType === "function") return msg._getType() === "human";
		// Plain objects use type field
		if (typeof msg.type === "string") return msg.type === "human";
		return false;
	}

	/**
	 * Check if a message is an AIMessage.
	 * @param {unknown} msg
	 * @returns {msg is { _getType(): string } | { type: string, content?: string, additional_kwargs?: Record<string, unknown> }}
	 */
	function isAIMessage(msg) {
		if (!msg || typeof msg !== "object") return false;
		if (typeof msg._getType === "function") return msg._getType() === "ai";
		if (typeof msg.type === "string") return msg.type === "ai";
		return false;
	}

	/**
	 * Check if an AIMessage has content (text or tool calls).
	 * @param {unknown} msg
	 * @returns {boolean}
	 */
	function hasContent(msg) {
		if (!msg || typeof msg !== "object") return false;
		// Check for text content
		if (typeof msg.content === "string" && msg.content.length > 0) return true;
		// Check for tool calls in additional_kwargs
		if (msg.additional_kwargs && typeof msg.additional_kwargs === "object") {
			const tc = msg.additional_kwargs.tool_calls;
			if (Array.isArray(tc) && tc.length > 0) return true;
		}
		// Check for tool_calls directly on the message (LangChain v0.3+)
		if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) return true;
		// Check for invalid_tool_calls
		if (Array.isArray(msg.invalid_tool_calls) && msg.invalid_tool_calls.length > 0) return true;
		return false;
	}

	/**
	 * Extract message ID from a message object.
	 * @param {unknown} msg
	 * @returns {string | undefined}
	 */
	function getMessageId(msg) {
		if (!msg || typeof msg !== "object") return undefined;
		if (typeof msg.id === "string") return msg.id;
		if (typeof msg.lc_id === "string") return msg.lc_id;
		return undefined;
	}

	/**
	 * Extract messages array from a ProtocolEvent's data.
	 * The `updates` channel carries state deltas with a `values` field.
	 * The `values` channel carries full state snapshots.
	 * @param {import("@langchain/langgraph").ProtocolEvent} event
	 * @returns {Array<unknown> | null}
	 */
	function extractMessages(event) {
		const data = event.params.data;
		if (!data || typeof data !== "object") return null;

		// updates channel: data.values.messages
		if (data.values && typeof data.values === "object" && Array.isArray(data.values.messages)) {
			return data.values.messages;
		}

		// values channel: data.messages directly
		if (Array.isArray(data.messages)) {
			return data.messages;
		}

		return null;
	}

	/**
	 * Check if the last message in the array is an AIMessage with content
	 * and no pending tool calls remain.
	 * @param {Array<unknown>} messages
	 * @returns {boolean}
	 */
	function isTerminalState(messages) {
		if (messages.length === 0) return false;
		const lastMsg = messages[messages.length - 1];
		if (!isAIMessage(lastMsg)) return false;
		if (!hasContent(lastMsg)) return false;
		if (pendingToolCalls.size > 0) return false;
		return true;
	}

	/**
	 * Check if a new HumanMessage has appeared in the messages array
	 * that we haven't seen before.
	 * @param {Array<unknown>} messages
	 * @returns {{ found: boolean, messageId?: string }}
	 */
	function findNewHumanMessage(messages) {
		for (const msg of messages) {
			if (isHumanMessage(msg)) {
				const id = getMessageId(msg);
				if (id && !lastSeenMessageIds.has(id)) {
					return { found: true, messageId: id };
				}
			}
		}
		return { found: false };
	}

	/**
	 * Record all message IDs from the messages array into the seen set.
	 * @param {Array<unknown>} messages
	 */
	function recordSeenMessages(messages) {
		for (const msg of messages) {
			const id = getMessageId(msg);
			if (id) lastSeenMessageIds.add(id);
		}
	}

	return {
		init() {
			return { turns };
		},

		onRegister(emitterHandle) {
			_emitter = emitterHandle;
		},

		/**
		 * Process each protocol event.
		 * @param {import("@langchain/langgraph").ProtocolEvent} event
		 * @returns {boolean}
		 */
		process(event) {
			// Guard against re-entrant self-processing
			if (inSelfEmit) return true;

			const method = event.method;

			// Handle tools channel — track tool call lifecycle
			if (method === "tools") {
				const data = /** @type {any} */ (event.params.data);
				if (data && typeof data === "object") {
					if (data.event === "tool-started" && typeof data.tool_call_id === "string") {
						pendingToolCalls.set(data.tool_call_id, true);
					} else if (data.event === "tool-finished" && typeof data.tool_call_id === "string") {
						pendingToolCalls.delete(data.tool_call_id);
					} else if (data.event === "tool-error" && typeof data.tool_call_id === "string") {
						pendingToolCalls.delete(data.tool_call_id);
					}
				}
				return true;
			}

			// Handle updates/values channel — detect turn boundaries
			if (method === "updates" || method === "values") {
				const messages = extractMessages(event);
				if (!messages || messages.length === 0) return true;

				// Detect new HumanMessage → turn:start (check BEFORE recording seen IDs)
				const { found: foundHuman, messageId: humanMsgId } = findNewHumanMessage(messages);

				// Record all seen message IDs for dedup (after checking for new ones)
				recordSeenMessages(messages);
				if (foundHuman && !inTurn) {
					inTurn = true;
					inSelfEmit = true;
					try {
						turns.push({
							type: "turn:start",
							timestamp: event.params.timestamp,
							messageId: humanMsgId,
						});
					} finally {
						inSelfEmit = false;
					}
				}

				// Detect terminal state → turn:end
				if (inTurn && isTerminalState(messages)) {
					const lastMsg = messages[messages.length - 1];
					inTurn = false;
					inSelfEmit = true;
					try {
						turns.push({
							type: "turn:end",
							timestamp: event.params.timestamp,
							messageId: getMessageId(lastMsg),
						});
					} finally {
						inSelfEmit = false;
					}
				}

				return true;
			}

			return true;
		},

		finalize() {
			// If we're still in a turn when the run completes, emit a final turn:end
			if (inTurn) {
				inTurn = false;
				turns.push({
					type: "turn:end",
					timestamp: Date.now(),
				});
			}
		},

		fail(_err) {
			// Clean up on failure — emit turn:end if we were in a turn
			if (inTurn) {
				inTurn = false;
				turns.push({
					type: "turn:end",
					timestamp: Date.now(),
				});
			}
		},
	};
}
