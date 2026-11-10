import { INTERRUPT } from "@langchain/langgraph";

/**
 * Detect a human-in-the-loop interrupt (e.g. the `clarify` tool calling
 * `interrupt()`) in a `values` stream chunk and surface it to the TUI as a
 * `clarify` event. The interrupt arrives as an `__interrupt__` array on the
 * chunk. Clarify is asked one question at a time, so only the first interrupt
 * is surfaced.
 * @param {string} mode - The stream mode of the chunk
 * @param {Object} payload - The stream chunk payload
 * @param {Function} [streamingCallback] - Callback for streamed chunks
 * @returns {boolean} True if the chunk was an interrupt (the agent is paused)
 */
export function surfaceInterrupt(mode, payload, streamingCallback) {
	if (mode !== "values" || !payload || !Array.isArray(payload[INTERRUPT])) return false;
	const first = payload[INTERRUPT][0];
	const value = first?.value;
	if (value && streamingCallback) {
		streamingCallback({
			type: "clarify",
			question: value.question,
			choices: value.choices,
			interruptId: first?.id,
		});
	}
	return true;
}
