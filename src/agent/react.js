import { createReactAgent as createReactAgentGraph } from "@langchain/langgraph/prebuilt";
import { AIMessage, AIMessageChunk, HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * Check if a message is an AI message (AIMessage or AIMessageChunk).
 * @param {import("@langchain/core/messages").BaseMessage} msg - Message to check
 * @returns {boolean}
 */
function isAIMessage(msg) {
	return msg instanceof AIMessage || msg instanceof AIMessageChunk;
}

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

	const lastAI = [...msgsArray].reverse().find((msg) => isAIMessage(msg));
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
 * Find the last AIMessage content from a streamMode: "updates" event object.
 * @param {Record<string, { messages: import("@langchain/core/messages").BaseMessage[] }>} event - Stream event
 * @returns {string} The trimmed content of the last AIMessage, or empty string
 */
function findLastAIMessageContent(event) {
	if (!event) {
		return "";
	}
	const allMessages = [];
	for (const nodeUpdates of Object.values(event)) {
		if (nodeUpdates && Array.isArray(nodeUpdates.messages)) {
			allMessages.push(...nodeUpdates.messages);
		}
	}
	if (allMessages.length > 0) {
		const lastAI = [...allMessages].reverse().find((msg) => isAIMessage(msg));
		if (lastAI?.content) {
			const content =
				typeof lastAI.content === "string" ? lastAI.content : JSON.stringify(lastAI.content);
			return content.trim();
		}
	}
	return "";
}

/**
 * Run the agent in streaming mode, calling `callback` incrementally with each new chunk.
 * @param {ReturnType<typeof createReactAgentGraph>} agent - A compiled ReAct agent
 * @param {import("@langchain/core/messages").BaseMessage[]} initMessages - Initial messages
 * @param {string} originalMessage - Original user message (fallback)
 * @param {(content: string) => void} callback - Streaming callback
 * @returns {{ content: string }} The agent's final text response
 */
async function callReactAgentStreaming(agent, initMessages, originalMessage, callback) {
	let lastContent = "";
	let fullContent = "";

	const stream = await agent.stream({ messages: initMessages }, { streamMode: "updates" });
	for await (const event of stream) {
		const trimmed = findLastAIMessageContent(event);
		if (trimmed && trimmed !== lastContent) {
			fullContent = trimmed;
			lastContent = trimmed;
			callback(trimmed);
		}
	}

	if (fullContent) {
		return { content: fullContent };
	}

	return { content: originalMessage };
}
