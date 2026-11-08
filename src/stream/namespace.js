/**
 * Decide whether a LangGraph stream namespace belongs to a subagent.
 *
 * With `subgraphs: true`, the orchestrator's own events carry an empty
 * namespace (`[]`), while each subagent run is nested under a `tools:<id>`
 * segment (e.g. `["tools:<id>"]`, or `["tools:<id>", "model_request:<id>"]`
 * for deeper nesting). A namespace is therefore subagent-scoped exactly when
 * any of its segments starts with `tools:`.
 *
 * Do NOT require more than one segment: a subagent's own namespace is a single
 * `tools:` segment, so a length guard misclassifies every subagent event as an
 * orchestrator event.
 *
 * @param {unknown} namespace - The namespace from a `[namespace, mode, payload]` stream tuple.
 * @returns {boolean} True when the namespace is subagent-scoped.
 */
export function isSubagentNamespace(namespace) {
	return (
		Array.isArray(namespace) &&
		namespace.some((part) => typeof part === "string" && part.startsWith("tools:"))
	);
}
