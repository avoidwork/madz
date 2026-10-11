/**
 * Subagent store — accumulates subagent reasoning/message segments and tool
 * calls keyed by stream namespace.
 *
 * The orchestrator's `callProvider` emits `subagent_*` events carrying a
 * namespace (e.g. `["task:<uuid>"]`) for each subagent subgraph. This module
 * provides pure functions to fold those events into a store that the
 * SUBAGENTS panel renders. Keeping the logic pure makes it trivially testable
 * without a React render.
 */

/**
 * Create an empty subagent store.
 * @returns {Object} An empty store keyed by namespace string.
 */
export function createSubagentStore() {
	return {};
}

/**
 * Get the namespace key for a subagent event.
 * @param {string[]} namespace - The stream namespace array (e.g. `["task:<uuid>"]`)
 * @returns {string} The namespace joined into a stable key.
 */
export function namespaceKey(namespace) {
	return Array.isArray(namespace) ? namespace.join("/") : "";
}

/**
 * Ensure a subagent entry exists for the given namespace.
 * @param {Object} store - The subagent store.
 * @param {string} key - The namespace key.
 * @returns {Object} The subagent entry (created if absent).
 */
function ensureEntry(store, key) {
	if (!store[key]) {
		store[key] = {
			namespace: key,
			segments: [],
			toolCalls: [],
		};
	}
	return store[key];
}

/**
 * Fold a single subagent event into the store. Returns a new store object so
 * React state updates are immutable.
 * @param {Object} store - The current subagent store.
 * @param {Object} event - A `subagent_*` event from `callProvider`.
 * @returns {Object} The updated store.
 */
export function updateSubagentStore(store, event) {
	const key = namespaceKey(event.namespace);
	if (!key) return store;

	const next = { ...store };
	const entry = ensureEntry(next, key);
	const segments = [...entry.segments];
	const toolCalls = [...entry.toolCalls];

	switch (event.type) {
		case "subagent_message": {
			const text = event.data?.text || event.text || "";
			if (text) {
				segments.push({ type: "message", content: text });
			}
			break;
		}
		case "subagent_reasoning": {
			const text = event.data?.text || event.text || "";
			if (text) {
				segments.push({ type: "reasoning", content: text });
			}
			break;
		}
		case "subagent_tool": {
			const text = event.data?.text || event.text || "";
			const name = event.data?.name || event.name || "";
			if (text) {
				segments.push({ type: "tool", content: text, name });
			}
			break;
		}
		case "subagent_tool_start": {
			toolCalls.push({
				name: event.name,
				input: event.data?.input,
				status: "running",
			});
			break;
		}
		case "subagent_tool_end": {
			const last = toolCalls[toolCalls.length - 1];
			if (last && last.status === "running") {
				toolCalls[toolCalls.length - 1] = {
					...last,
					output: event.data?.output,
					status: "done",
				};
			} else {
				toolCalls.push({
					name: event.name,
					output: event.data?.output,
					status: "done",
				});
			}
			break;
		}
		default:
			break;
	}

	next[key] = { ...entry, segments, toolCalls };
	return next;
}
