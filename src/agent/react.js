import { createReactAgent as createReactAgentGraph } from "@langchain/langgraph/prebuilt";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

export const graphCache = new Map();

/**
 * Create a ReAct agent with SQLite persistence when available,
 * falling back to the standard prebuilt agent.
 * The first invocation initializes the checkpointer; subsequent calls
 * reuse the cached compiled graph keyed by dbPath and model name.
 * @param {import("@langchain/core").BaseChatModel} model - A chat language model instance (e.g., ChatOpenAI)
 * @param {unknown[]} [tools=[]] - Optional array of LangChain tool definitions
 * @param {string} [dbPath] - SQLite database path (default: memory/checkpoints.db)
 * @returns {import("@langchain/langgraph").CompiledStateGraph} A compiled ReAct agent with optional SQLite checkpointer
 */
/* istanbul ignore next */
export function createReactAgent(model, tools = [], dbPath = "memory/checkpoints.db") {
	const key = `${dbPath}:${getModelKey(model)}`;

	if (!graphCache.has(key)) {
		const checkpointer = SqliteSaver.fromConnString(dbPath);
		const compiled = createReactAgentGraph({
			llm: model,
			tools,
			checkpointer,
		});
		graphCache.set(key, compiled);
	}

	return graphCache.get(key);
}

/**
 * Get a stable identifier for a model instance for use in cache keys.
 * @param {import("@langchain/core").BaseChatModel} model
 * @returns {string}
 */
function getModelKey(model) {
	return model.modelName || model._modelType || model.constructor.name;
}

/**
 * Invoke a ReAct agent with a single user message and return the final response.
 * Uses agent.invoke() for reliable checkpointing (streamEvents creates intermediate
 * checkpoints that may not capture the final LLM response).
 * Errors are re-thrown without modification for propagation to the caller.
 * Searches backwards through the message history to find the last AIMessage
 * with non-empty content (the LLM's final answer). Falls back to the
 * original user message if no valid AI content is found.
 * @param {import("@langchain/langgraph").CompiledStateGraph} agent - A compiled ReAct agent
 * @param {string} message - The user message string
 * @param {string} [systemPrompt] - Optional system prompt text prepended before the user message
 * @param {object} [config] - Optional config object (e.g. { configurable: { thread_id: "..." } })
 * @returns {{ content: string }} The agent's final text response
 */
export function callReactAgent(agent, message, systemPrompt, config) {
	const initMessages = [
		systemPrompt ? new SystemMessage(systemPrompt) : null,
		new HumanMessage(message),
	].filter(Boolean);

	const result = agent.invoke({ messages: initMessages }, config);

	// Debug: log result if DEBUG_MADZ env var is set
	if (process.env.DEBUG_MADZ) {
		// oxlint-disable-next-line no-console
		console.error("[callReactAgent] result keys:", Object.keys(result));
		// oxlint-disable-next-line no-console
		console.error("[callReactAgent] result.messages:", result.messages);
	}

	const msgsArray = Array.isArray(result.messages) ? result.messages : [];

	const lastAI = [...msgsArray].reverse().find((msg) => msg instanceof AIMessage);
	if (lastAI && lastAI.content) {
		const content =
			typeof lastAI.content === "string" ? lastAI.content : JSON.stringify(lastAI.content);
		if (content.trim()) {
			return { content: content.trim() };
		}
	}

	return { content: message };
}

// Note: streaming is no longer used. All agent calls use invoke() for reliable checkpointing.
// The streaming callback path was removed because streamEvents() creates intermediate checkpoints
// that capture the initial request state rather than the final LLM response.
