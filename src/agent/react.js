import { createReactAgent as createReactAgentGraph } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

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
 * When a callback is provided, the agent runs in streaming mode and the
 * callback is invoked with each new chunk of AIMessage content.
 * @param {ReturnType<typeof createReactAgentGraph>} agent - A compiled ReAct agent
 * @param {string} message - The user message string
 * @param {string} [systemPrompt] - Optional system prompt text prepended before the user message
 * @param {(content: string) => void} [callback] - Optional streaming callback
 * @returns {{ content: string }} The agent's final text response
 */
export function callReactAgent(agent, message, systemPrompt, callback) {
	const initMessages = [
		systemPrompt ? new SystemMessage(systemPrompt) : null,
		new HumanMessage(message),
	].filter(Boolean);

	if (callback) {
		return callReactAgentStreaming(agent, initMessages, message, callback);
	}

	const result = agent.invoke({ messages: initMessages });

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

/**
 * Run the agent in streaming mode, calling `callback` with each new chunk.
 * @param {ReturnType<typeof createReactAgentGraph>} agent - A compiled ReAct agent
 * @param {import("@langchain/core/messages").BaseMessage[]} initMessages - Initial messages
 * @param {string} originalMessage - Original user message (fallback)
 * @param {(content: string) => void} callback - Streaming callback
 * @returns {{ content: string }} The agent's final text response
 */
async function callReactAgentStreaming(agent, initMessages, originalMessage, callback) {
	let lastContent = "";
	let fullContent = "";

	// Collect all events from the stream
	const events = [];
	const stream = await agent.stream({ messages: initMessages }, { streamMode: "updates" });
	for await (const event of stream) {
		events.push(event);
	}

	// Process events: detect new AIMessage content
	for (const event of events) {
		if (!event) {
			continue;
		}
		// streamMode: "updates" returns events keyed by node name.
		// Collect ALL messages from every node in the event, then
		// find the last AIMessage across the union.
		const allMessages = [];
		for (const nodeUpdates of Object.values(event)) {
			if (nodeUpdates && Array.isArray(nodeUpdates.messages)) {
				allMessages.push(...nodeUpdates.messages);
			}
		}
		if (allMessages.length > 0) {
			const lastAI = [...allMessages].reverse().find((msg) => msg instanceof AIMessage);
			if (lastAI && lastAI.content) {
				const content =
					typeof lastAI.content === "string" ? lastAI.content : JSON.stringify(lastAI.content);
				const trimmed = content.trim();
				if (trimmed && trimmed !== lastContent) {
					fullContent = trimmed;
					lastContent = trimmed;
					callback(trimmed);
				}
			}
		}
	}

	if (fullContent) {
		return { content: fullContent };
	}

	return { content: originalMessage };
}
