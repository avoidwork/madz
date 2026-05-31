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
 * Run the agent in streaming mode via LangGraph event streaming v3.
 * Uses a single loop over protocol events to decouple text streaming from tool execution.
 * Text is extracted from content-block-delta messages while tool events are emitted
 * from the tools channel, both concurrently in one pass, so text renders
 * as it arrives regardless of tool call status.
 * @param {ReturnType<typeof createReactAgentGraph>} agent - A compiled ReAct agent
 * @param {import("@langchain/core/messages").BaseMessage[]} initMessages - Initial messages
 * @param {string} originalMessage - Original user message (fallback)
 * @param {Object | null} [config] - Optional config with `configurable: { thread_id }`
 * @param {(event: StreamEvent) => void} callback - Event callback function
 * @returns {{ content: string }} The agent's final text response
 */
async function callReactAgentStreaming(agent, initMessages, originalMessage, config, callback) {
	const streamOptions = {
		version: "v3",
		...(config?.configurable && { configurable: config.configurable }),
	};
	const stream = await agent.streamEvents({ messages: initMessages }, streamOptions);

	let lastText = "";
	const toolCallSet = new Set();

	for await (const event of stream) {
		if (!event || !event.params || !event.params.data) continue;

		const data = event.params.data;
		const eventName = data.event || data.langgraph_event || "";

		// Handle text: accumulate from content-block-delta events in the messages channel
		if (event.method === "messages" && eventName === "content-block-delta") {
			let text = "";
			if (typeof data.delta === "string") {
				text = data.delta;
			} else if (
				typeof data.delta === "object" &&
				data.delta !== null &&
				typeof data.delta.text === "string"
			) {
				text = data.delta.text;
			}
			if (text) {
				lastText += text;
				callback({ type: "text", text: lastText });
			}
		}

		// Handle tools: emit lifecycle events from the tools channel
		// tool_start is emitted here; tool_end is emitted at the end of the stream
		// to avoid duplicates when multiple event types fire for the same tool.
		if (event.method === "tools") {
			const toolName = data.tool_name || data.name || data.tool || data.toolCall?.name || "";
			const toolCallId =
				data.tool_call_id || data.toolCallId || data.tool_call?.id || data.toolCall?.id || "";

			if (eventName === "tool-started" || eventName === "tool-called") {
				const key = toolName + "|" + toolCallId;
				if (toolName && !toolCallSet.has(key)) {
					toolCallSet.add(key);
					callback({
						type: "tool_start",
						toolName,
						toolCallId,
					});
				}
			} else if (eventName === "tool-error") {
				const errMsg = data.error || data.message || "Unknown error";
				const toolNameErr =
					data.tool_name || data.name || data.tool || data.toolCall?.name || toolName;
				const toolCallIdErr =
					data.tool_call_id ||
					data.toolCallId ||
					data.tool_call?.id ||
					data.toolCall?.id ||
					toolCallId;
				callback({
					type: "tool_error",
					toolName: toolNameErr,
					toolCallId: toolCallIdErr,
					error: String(errMsg),
				});
			} else if (
				eventName === "tool-output-delta" ||
				eventName === "on_tool_event" ||
				eventName === "partial_result"
			) {
				callback({
					type: "tool_event",
					toolCallId: data.tool_call_id || data.toolCallId || toolCallId,
					data: data.data,
				});
			}
		}
	}

	// Emit tool_end for any tracked tool calls not already closed
	for (const key of toolCallSet) {
		const [name] = key.split("|");
		callback({ type: "tool_end", toolName: name });
	}

	if (lastText) {
		return { content: lastText };
	}
	return { content: originalMessage };
}
