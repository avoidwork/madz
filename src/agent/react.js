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
 * @param {ReturnType<typeof createReactAgentGraph>} agent - A compiled ReAct agent
 * @param {string} message - The user message string
 * @returns {{ content: string }} The agent's final text response
 */
export function callReactAgent(agent, message) {
	const result = agent.invoke({
		messages: [{ role: "user", content: message }],
	});

	const finalMessages = result.messages;
	const lastMessage = finalMessages[finalMessages.length - 1];
	return { content: lastMessage.content };
}
