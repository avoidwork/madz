import { createReactAgent as createReactAgentGraph } from "@langchain/langgraph/prebuilt";

/**
 * Create a ReAct agent from a chat model and optional tools.
 * The agent uses LangGraph under the hood via `@langchain/langgraph/prebuilt`.
 * @param {ChatLanguageModel} model - A chat language model instance (e.g., ChatOpenAI)
 * @param {unknown[]} [tools=[]] - Optional array of LangChain tool definitions
 * @returns {ReturnType<typeof createReactAgentGraph>} A compiled ReAct agent
 */
/* istanbul ignore next */
export function createReactAgent(model, tools = []) {
	return createReactAgentGraph({
		llm: model,
		tools,
	});
}

/**
 * Invoke a ReAct agent with a single user message and return the final response.
 * Errors are re-thrown without modification for propagation to the caller.
 * Searches backwards through the message history to find the last AIMessage
 * with non-empty content (the LLM's final answer). Falls back to the
 * original user message if no valid AI content is found.
 * @param {ReturnType<typeof createReactAgentGraph>} agent - A compiled ReAct agent
 * @param {string} message - The user message string
 * @returns {{ content: string }} The agent's final text response
 */
export function callReactAgent(agent, message) {
	const result = agent.invoke({
		messages: [{ role: "user", content: message }],
	});

	const messages = result.messages || [];
	const msgsArray = Array.isArray(messages) ? messages : [];

	for (let i = msgsArray.length - 1; i >= 0; i--) {
		const msg = msgsArray[i];
		if (msg.type === "ai" && msg.content && msg.content !== "") {
			return { content: msg.content };
		}
	}

	return { content: message };
}
