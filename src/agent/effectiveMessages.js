/**
 * Resolve the messages the model actually sees for a graph state.
 *
 * deepagents' summarization middleware never rewrites `state.messages`.
 * It records a `_summarizationEvent` (`{ cutoffIndex, summaryMessage }`) and
 * rebuilds the window on every model call as
 * `[summaryMessage, ...messages.slice(cutoffIndex)]`. The checkpointer
 * therefore always holds the full, uncompacted history, so anything that
 * needs "the current context window" must apply the event the same way.
 *
 * @param {Object} [values] - Graph state values (`agent.getState(...).values`)
 * @returns {Array} The current (effective) context window
 */
export function getEffectiveMessages(values) {
	const messages = values?.messages ?? [];
	const event = values?._summarizationEvent;
	if (!event?.summaryMessage) return messages;
	return [event.summaryMessage, ...messages.slice(event.cutoffIndex)];
}
