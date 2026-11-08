/**
 * @typedef {Object} Message
 * @property {string} role - "user" | "assistant" | "system"
 * @property {string} content - The message content
 * @property {Array<{type: string, content: string}>} [segments] - Ordered content segments for interleaved rendering
 * @property {Object} [activeToolCall] - {name: string} for assistant when a tool is running
 * @property {string} [toolCallDisplay] - Tool call result strings for assistant messages
 * @property {Array<Object>} [events] - Raw stream events for this message
 * @property {string} [time] - Timestamp
 * @property {boolean} [streaming] - Whether currently streaming
 */

/**
 * Get the display label for a message role.
 * @param {string} role - Message role: "user", "assistant", or "system"
 * @param {string} [assistantName] - Optional custom name for assistant role
 * @returns {string}
 */
export function getRoleLabel(role, assistantName) {
	switch (role) {
		case "user":
			return "You";
		case "assistant":
			return assistantName || "Assistant";
		case "system":
			return "System";
		default:
			return role || "Unknown";
	}
}

/**
 * Normalize completed tool calls into a count map.
 *
 * Accepts either a legacy array of tool names (e.g. `["read_file", "read_file"]`)
 * or a count map (e.g. `{ read_file: 2 }`). Arrays are collapsed into counts so
 * old session transcripts and the live streaming path share one shape. Returns a
 * fresh object; never mutates the input.
 *
 * @param {string[]|Object} [calls] - Completed tool call names or a count map
 * @returns {Object} Count map `{ [name]: count }`
 */
export function normalizeCompletedToolCalls(calls) {
	if (!calls) return {};
	if (Array.isArray(calls)) {
		const map = {};
		for (const name of calls) {
			map[name] = (map[name] || 0) + 1;
		}
		return map;
	}
	return { ...calls };
}

/**
 * Whether there are any completed tool calls to display.
 * @param {string[]|Object} [calls] - Completed tool call names or a count map
 * @returns {boolean} True if at least one call is present
 */
export function hasCompletedToolCalls(calls) {
	return Object.keys(normalizeCompletedToolCalls(calls)).length > 0;
}

/**
 * Format completed tool calls for display.
 *
 * Collapses repeated calls into a `name ×count` form and hides the count for
 * tools called once. Insertion order is preserved (first-call order), so the
 * summary reads as a record of what happened rather than a ranking.
 *
 * @param {string[]|Object} [calls] - Completed tool call names or a count map
 * @returns {{total: number, text: string}} Total call count and display text
 */
export function formatCompletedToolCalls(calls) {
	const map = normalizeCompletedToolCalls(calls);
	const names = Object.keys(map);
	const total = names.reduce((sum, name) => sum + map[name], 0);
	const text = names.map((name) => (map[name] > 1 ? `${name} ×${map[name]}` : name)).join(", ");
	return { total, text };
}

/**
 * Coalesce a new segment into an existing segment list.
 *
 * - `reasoning` segments coalesce by identity. When the new segment carries an
 *   `id`, it appends to the last reasoning segment with the same `id` — a
 *   streamed reasoning block is split across chunks that share an id — and
 *   starts a new block when the id is new or absent. When no `id` is present
 *   (e.g. Chat Completions `reasoning_content`, which is a continuous string
 *   with no block boundaries), it appends to the last reasoning segment,
 *   respecting a grammatical sentence boundary (period/question/exclamation
 *   followed by a capital) so distinct thoughts stay separate.
 * - `message` segments coalesce by identity. When the new segment carries an
 *   `id` (a streamed text block's normalized content-block index), it appends
 *   to the last message segment with the same `id` and starts a new block when
 *   the id is new or absent. Without an `id`, it appends to the last segment
 *   when the type matches, otherwise it starts a new block.
 * - `tool` segments always start a new block (each tool result is its own
 *   block with its own name header).
 *
 * @param {Array<{type: string, content: string, name?: string, id?: string}>} segments - Existing segments.
 * @param {{type: string, content: string, name?: string, id?: string}} newSeg - The new segment to fold in.
 * @returns {Array<{type: string, content: string, name?: string, id?: string}>} The coalesced segments.
 */
export function coalesceSegments(segments, newSeg) {
	const merged = segments.map((s) => ({ ...s }));

	if (newSeg.type === "reasoning") {
		// Find the reasoning segment to append to. Prefer one with the same id
		// (a streamed block shares its id across chunks); fall back to the last
		// reasoning segment when no id is present.
		let target = null;
		if (newSeg.id) {
			for (let i = merged.length - 1; i >= 0; i--) {
				if (merged[i].type === "reasoning" && merged[i].id === newSeg.id) {
					target = merged[i];
					break;
				}
			}
		} else {
			for (let i = merged.length - 1; i >= 0; i--) {
				if (merged[i].type === "reasoning") {
					target = merged[i];
					break;
				}
			}
		}
		// Grammatical sentence boundary: a period followed by a capital letter
		// starts a new block even when no id is present; otherwise coalesce.
		if (
			target &&
			!newSeg.id &&
			(target.content.endsWith(".") ||
				target.content.endsWith("?") ||
				target.content.endsWith("!")) &&
			/^[A-Z]/.test(newSeg.content)
		) {
			merged.push({ ...newSeg });
		} else if (target) {
			target.content += newSeg.content;
		} else {
			merged.push({ ...newSeg });
		}
	} else if (newSeg.type === "tool") {
		// Each tool message gets its own segment so it renders as its own block.
		merged.push({ ...newSeg });
	} else if (newSeg.type === "message") {
		// Message segments coalesce by identity. When the new segment carries an
		// `id` (a streamed text block's normalized content-block index), it
		// appends to the last message segment with the same `id` — a streamed
		// block is split across chunks that share an id — and starts a new block
		// when the id is new or absent. Without an `id`, fall back to a type
		// match on the last segment (a mismatch, e.g. message after reasoning,
		// forces a new block).
		let target = null;
		if (newSeg.id) {
			for (let i = merged.length - 1; i >= 0; i--) {
				if (merged[i].type === "message" && merged[i].id === newSeg.id) {
					target = merged[i];
					break;
				}
			}
		} else {
			const lastSeg = merged[merged.length - 1];
			if (lastSeg && lastSeg.type === "message") {
				target = lastSeg;
			}
		}
		if (target) {
			target.content += newSeg.content;
		} else {
			merged.push({ ...newSeg });
		}
	}

	return merged;
}
