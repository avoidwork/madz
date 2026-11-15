import { createHash } from "node:crypto";
import { createMiddleware } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import { logger } from "../shared/logger.js";

/** The literal nudge injected into the model state when a loop is detected. */
const LOOP_NUDGE = "You're looping";

/**
 * Extract the message text and reasoning content from a LangChain message.
 *
 * Mirrors the content-extraction patterns in `src/stream/transformers/turn.js`
 * so message text and reasoning content are captured independently. Returns
 * `{ text, reasoning }` where each is a string (possibly empty).
 *
 * @param {Object} msg - A LangChain message
 * @returns {{ text: string, reasoning: string }} Extracted content
 */
export function extractMessageContent(msg) {
	if (!msg || typeof msg !== "object") return { text: "", reasoning: "" };

	let text = "";
	let reasoning = "";

	// String content is plain text.
	if (typeof msg.content === "string") {
		text = msg.content;
	} else if (Array.isArray(msg.content)) {
		// Content blocks (Responses API / block format).
		for (const block of msg.content) {
			if (typeof block === "string") {
				text += block;
			} else if (block && typeof block === "object") {
				if (block.type === "text") text += block.text ?? "";
				else if (block.type === "reasoning") reasoning += block.reasoning ?? "";
			}
		}
	}

	// Reasoning content in additional_kwargs (Chat Completions API).
	if (msg.additional_kwargs && typeof msg.additional_kwargs === "object") {
		const rc = msg.additional_kwargs.reasoning_content;
		if (typeof rc === "string") reasoning += rc;
	}

	return { text, reasoning };
}

/**
 * Compute a stable sha256 hash of a string. Returns `undefined` for empty or
 * non-string input so empty content is not recorded in the hash window.
 * @param {string} value - The content to hash
 * @returns {string | undefined} The hex hash, or `undefined` when empty
 */
export function hashContent(value) {
	if (typeof value !== "string" || value.length === 0) return undefined;
	return createHash("sha256").update(value).digest("hex");
}

/**
 * Create the `LoopDetection` middleware.
 *
 * Detects when the model repeats the same message text or reasoning content
 * across successive calls. On each `beforeModel` hook, the most recent message
 * content is hashed independently (text and reasoning) and recorded in a
 * per-thread rolling window. When a hash appears more than the configured
 * threshold within the window, the middleware injects a `HumanMessage` with
 * the text "You're looping" so the model observes the nudge on its next turn.
 *
 * If the escalation count of nudges is reached within the escalation window,
 * the middleware invokes the `onCompact` callback (wired to the agent's
 * compaction path) instead of injecting another nudge.
 *
 * Returns `null` when disabled, so unset config is a true no-op.
 *
 * @param {Object} options - Middleware options
 * @param {Object} [options.config] - The resolved `loopDetection` config section
 * @param {Function} [options.onCompact] - Callback invoked on escalation (e.g. `agent.compactContext`)
 * @param {Function} [options.now] - Clock function returning ms (injectable for tests)
 * @returns {Object|null} The middleware, or `null` when disabled
 */
export function createLoopDetectionMiddleware(options = {}) {
	const config = options.config ?? {};
	if (config.enabled === false) return null;

	const windowSize = config.windowSize ?? 10;
	const ttlMs = config.ttlMs ?? 60000;
	const threshold = config.threshold ?? 2;
	const escalationCount = config.escalationCount ?? 3;
	const escalationWindowMs = config.escalationWindowMs ?? 60000;
	const onCompact = options.onCompact;
	const now = options.now ?? (() => Date.now());

	/** Per-thread state: hash windows (with timestamps) and nudge timestamps. */
	const threadState = new Map();

	/**
	 * Get (or create) the state for a thread.
	 * @param {string} threadKey - The thread_id
	 * @returns {{ messageHashes: {hash: string, ts: number}[], reasoningHashes: {hash: string, ts: number}[], nudges: number[] }} State
	 */
	function getThreadState(threadKey) {
		let state = threadState.get(threadKey);
		if (!state) {
			state = { messageHashes: [], reasoningHashes: [], nudges: [] };
			threadState.set(threadKey, state);
		}
		return state;
	}

	/**
	 * Prune hashes older than the TTL from a window. The window is
	 * insertion-ordered, so the oldest entries are at the front.
	 * @param {{hash: string, ts: number}[]} window - The hash window array
	 * @param {number} nowMs - Current time in ms
	 * @returns {void}
	 */
	function pruneHashes(window, nowMs) {
		while (window.length > 0 && nowMs - window[0].ts > ttlMs) window.shift();
	}

	/**
	 * Clear both hash windows for a thread. Called when a nudge is injected (or
	 * on escalation) so the model gets a fresh slate — otherwise it could repeat
	 * the same phrase on its next turn and immediately re-trigger detection.
	 * @param {{messageHashes: {hash: string, ts: number}[], reasoningHashes: {hash: string, ts: number}[]}} thread - The thread state
	 * @returns {void}
	 */
	function clearHashes(thread) {
		thread.messageHashes = [];
		thread.reasoningHashes = [];
	}

	/**
	 * Record a hash with a timestamp in a bounded rolling window, evicting the
	 * oldest entry when the window exceeds `windowSize` or the TTL.
	 * @param {{hash: string, ts: number}[]} window - The hash window array
	 * @param {string} hash - The hash to record
	 * @param {number} nowMs - Current time in ms
	 * @returns {void}
	 */
	function recordHash(window, hash, nowMs) {
		pruneHashes(window, nowMs);
		window.push({ hash, ts: nowMs });
		while (window.length > windowSize) window.shift();
	}

	/**
	 * Count occurrences of a hash within a window.
	 * @param {{hash: string, ts: number}[]} window - The hash window array
	 * @param {string} hash - The hash to count
	 * @returns {number} Occurrence count
	 */
	function countOccurrences(window, hash) {
		let count = 0;
		for (const entry of window) if (entry.hash === hash) count++;
		return count;
	}

	/**
	 * Decide whether a hash exceeds the loop threshold within its window.
	 * @param {{hash: string, ts: number}[]} window - The hash window array
	 * @param {string} hash - The hash to check
	 * @returns {boolean} True when the hash appears more than `threshold` times
	 */
	function isLooping(window, hash) {
		return countOccurrences(window, hash) > threshold;
	}

	/**
	 * Prune nudge timestamps older than the escalation window.
	 * @param {number[]} nudges - Nudge timestamps
	 * @param {number} nowMs - Current time in ms
	 * @returns {void}
	 */
	function pruneNudges(nudges, nowMs) {
		while (nudges.length > 0 && nowMs - nudges[0] > escalationWindowMs) nudges.shift();
	}

	return createMiddleware({
		name: "LoopDetection",
		beforeModel: {
			canJumpTo: [],
			hook: async (state, runtime) => {
				const messages = state?.messages ?? [];
				if (messages.length === 0) return undefined;

				const threadKey = runtime?.configurable?.thread_id ?? "";
				const thread = getThreadState(threadKey);
				const lastMsg = messages[messages.length - 1];
				const { text, reasoning } = extractMessageContent(lastMsg);

				const nowMs = now();
				const textHash = hashContent(text);
				const reasoningHash = hashContent(reasoning);

				let looped = false;
				if (textHash) {
					recordHash(thread.messageHashes, textHash, nowMs);
					if (isLooping(thread.messageHashes, textHash)) looped = true;
				}
				if (reasoningHash) {
					recordHash(thread.reasoningHashes, reasoningHash, nowMs);
					if (isLooping(thread.reasoningHashes, reasoningHash)) looped = true;
				}

				if (!looped) return undefined;

				pruneNudges(thread.nudges, nowMs);

				// Escalate to compaction when the nudge count reaches the threshold.
				if (thread.nudges.length >= escalationCount) {
					logger.warn(
						{ thread: threadKey, nudges: thread.nudges.length, escalationCount },
						"[loopDetection] escalating to context compaction",
					);
					thread.nudges = [];
					clearHashes(thread);
					if (typeof onCompact === "function") {
						try {
							await onCompact(threadKey);
						} catch (err) {
							logger.warn({ error: err?.message }, "[loopDetection] onCompact callback failed");
						}
					}
					return undefined;
				}

				// Otherwise inject the nudge and record it. Clear the hash windows
				// so the model gets a fresh slate — otherwise it could repeat the
				// same phrase on its next turn and immediately re-trigger.
				thread.nudges.push(nowMs);
				clearHashes(thread);
				logger.warn(
					{ thread: threadKey, nudges: thread.nudges.length },
					"[loopDetection] detected loop; injecting nudge",
				);
				return { messages: [new HumanMessage(LOOP_NUDGE)] };
			},
		},
	});
}
