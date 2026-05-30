import { createReactAgent as createReactAgentGraph } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage, AIMessage, AIMessageChunk } from "@langchain/core/messages";

/**
 * Create a ReAct agent from a chat model and optional tools and checkpointer.
 * The agent uses LangGraph under the hood via `@langchain/langgraph/prebuilt`.
 * @param {ChatLanguageModel} model - A chat language model instance (e.g., ChatOpenAI)
 * @param {unknown[]} [tools=[]] - Optional array of LangChain tool definitions
 * @param {import("@langchain/langgraph").BaseCheckpointSaver | null} [checkpointer=null] - Optional LangGraph checkpointer for persistent conversation memory
 * @returns {ReturnType<typeof createReactAgentGraph>} A compiled ReAct agent
 */
/* node:coverage ignore next */
export function createReactAgent(model, tools = [], checkpointer = null) {
	return createReactAgentGraph({
		llm: model,
		tools,
		...(checkpointer && { checkpointer }),
	});
}

/**
 * Invoke a ReAct agent with a single user message and return the final response.
 * On the first call (new thread) the system prompt is prepended. On subsequent
 * calls the checkpointer already carries the system message, so it is skipped.
 * @param {ReturnType<typeof createReactAgentGraph>} agent - A compiled ReAct agent
 * @param {string} message - The user message string
 * @param {Object} config - Config object with `configurable: { thread_id }`
 * @param {string} [systemPrompt] - Optional system prompt (prepended only on new threads)
 * @param {(event: StreamEvent) => void} [callback] - Optional streaming event callback
 * @returns {{ content: string }} The agent's final text response
 */
export function callReactAgent(agent, message, config, systemPrompt, callback) {
	let messages = [new HumanMessage(message)];

	if (systemPrompt) {
		const isNewThread = config?.configurable?.isNewThread ?? true;
		if (isNewThread) {
			messages.unshift(new SystemMessage(systemPrompt));
		}
	}

	if (callback) {
		return callReactAgentStreaming(agent, messages, message, config, callback);
	}

	const result = agent.invoke({ messages, ...config });
	return extractContent(result, message);
}

/**
 * Extract response content from an agent invoke result.
 * @param {Object} result - Agent invoke result with `messages` field
 * @param {string} fallback - Fallback content when no AI message found
 * @returns {{ content: string }}
 */
function extractContent(result, fallback) {
	const msgsArray = Array.isArray(result.messages) ? result.messages : [];

	const lastAI = [...msgsArray]
		.reverse()
		.find((msg) => msg instanceof AIMessage || msg instanceof AIMessageChunk);
	if (lastAI && lastAI.content) {
		const content =
			typeof lastAI.content === "string" ? lastAI.content : JSON.stringify(lastAI.content);
		const trimmed = content.trim();
		if (trimmed && trimmed !== "[]" && trimmed !== "{}") {
			return { content: trimmed };
		}
	}

	return { content: fallback };
}

/**
 * Run the agent in streaming mode using state updates. Yields state snapshots
 * after each step, extracting tool calls and final text from the messages array.
 * @param {ReturnType<typeof createReactAgentGraph>} agent - A compiled ReAct agent
 * @param {import("@langchain/core/messages").BaseMessage[]} initMessages - Initial messages
 * @param {string} originalMessage - Original user message (fallback)
 * @param {Object | null} [config] - Optional config with `configurable: { thread_id }`
 * @param {(event: StreamEvent) => void} callback - Event callback function
 * @returns {{ content: string }} The agent's final text response
 */
async function callReactAgentStreaming(agent, initMessages, originalMessage, config, callback) {
	const stream = await agent.stream(
		{ messages: initMessages },
		{
			streamMode: "values",
			...(config?.configurable && { configurable: config.configurable }),
		},
	);

	let toolCallSet = new Set();
	let lastText = "";

	for await (const chunk of stream) {
		const msgs = chunk?.messages;
		if (!Array.isArray(msgs)) continue;

		for (const msg of msgs) {
			if (!(msg instanceof AIMessage || msg instanceof AIMessageChunk)) continue;

			// Check for tool calls
			const toolCalls = msg.tool_calls || [];
			for (const tc of toolCalls) {
				const key = tc.name + "|" + tc.id;
				if (!toolCallSet.has(key)) {
					toolCallSet.add(key);
					callback({ type: "tool_start", toolName: tc.name, toolCallId: tc.id });
				}
			}

			// Extract text content from the message
			let text = "";
			if (typeof msg.content === "string") {
				text = msg.content;
			} else if (
				typeof msg.content === "object" &&
				msg.content !== null &&
				typeof msg.content.text === "string"
			) {
				text = msg.content.text;
			}
			if (text.trim()) {
				lastText = text.trim();
				callback({ type: "text", text: lastText });
			}
		}
	}

	// Emit tool_end for any pending tool calls
	for (const key of toolCallSet) {
		const [name] = key.split("|");
		callback({ type: "tool_end", toolName: name });
	}

	if (lastText) {
		return { content: lastText };
	}
	return { content: originalMessage };
}
