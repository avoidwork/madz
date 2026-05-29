import { createReactAgent as createReactAgentGraph } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

/**
 * Create a ReAct agent from a chat model and optional tools.
 * The agent uses LangGraph under the hood via `@langchain/langgraph/prebuilt`.
 * @param {ChatLanguageModel} model - A chat language model instance (e.g., ChatOpenAI)
 * @param {unknown[]} [tools=[]] - Optional array of LangChain tool definitions
 * @returns {ReturnType<typeof createReactAgentGraph>} A compiled ReAct agent
 */
/* node:coverage ignore next */
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
 * When a callback is provided, the agent runs in streaming mode using
 * LangGraph's event streaming v3 API. The callback receives typed events:
 *   { type: "text", text: string } — accumulated AI text for a message chunk
 *   { type: "tool_start", toolName: string, toolCallId: string } — tool invocation started
 *   { type: "tool_event", toolCallId: string, data: unknown } — intermediate tool output
 *   { type: "tool_end", toolName: string, toolCallId: string, data: unknown } — tool completed
 *   { type: "tool_error", toolName: string, toolCallId: string, error: string } — tool failed
 * @param {ReturnType<typeof createReactAgentGraph>} agent - A compiled ReAct agent
 * @param {string} message - The user message string
 * @param {string} [systemPrompt] - Optional system prompt text prepended before the user message
 * @param {(event: StreamEvent) => void} [callback] - Optional streaming event callback
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
 * Emits a tool event from a tools channel ProtocolEvent.
 * @param {ProtocolEvent} event
 * @param {(event: StreamEvent) => void} callback
 */
function emitToolEvent(event, callback) {
	const { data } = event.params;
	if (!data || typeof data !== "object") return;

	// Normalize tool event names for different LangGraph versions
	const eventName = data.event || data.langgraph_event || "";

	if (eventName === "on_tool_start" || eventName === "tool_called") {
		callback({
			type: "tool_start",
			toolName: data.name || data.tool_name || data.tool || "",
			toolCallId: data.toolCallId || data.tool_call_id,
		});
	} else if (
		eventName === "on_tool_event" ||
		eventName === "partial_result" ||
		eventName === "tool_output"
	) {
		callback({
			type: "tool_event",
			toolCallId: data.toolCallId || data.tool_call_id,
			data: data.data ?? data.output,
		});
	} else if (eventName === "on_tool_end" || eventName === "tool_finished") {
		callback({
			type: "tool_end",
			toolName: data.name || data.tool_name || data.tool || "",
			toolCallId: data.toolCallId || data.tool_call_id,
			data: data.output ?? data.data,
		});
	} else if (
		eventName === "on_tool_error" ||
		eventName === "tool_error" ||
		eventName === "partial_error"
	) {
		const errMsg = data.error || data.message || "Unknown error";
		callback({
			type: "tool_error",
			toolName: data.name || data.tool_name || data.tool || "",
			toolCallId: data.toolCallId || data.tool_call_id,
			error: String(errMsg),
		});
	}
}

/**
 * Run the agent in streaming mode via LangGraph event streaming v3.
 * Iterates the `streamEvents` run stream processing text chunks from
 * the messages projection and tool events from the raw protocol stream.
 * @param {ReturnType<typeof createReactAgentGraph>} agent - A compiled ReAct agent
 * @param {import("@langchain/core/messages").BaseMessage[]} initMessages - Initial messages
 * @param {string} originalMessage - Original user message (fallback)
 * @param {(event: StreamEvent) => void} callback - Event callback function
 * @returns {{ content: string }} The agent's final text response
 */
async function callReactAgentStreaming(agent, initMessages, originalMessage, callback) {
	const stream = await agent.streamEvents({ messages: initMessages }, { version: "v3" });

	let fullContent = "";
	let hasContent = false;

	// Consume text: iterate ChatModelStream instances and collect incremental text deltas
	for await (const chatMessage of stream.messages) {
		try {
			let accumulated = "";
			for await (const delta of chatMessage.text) {
				accumulated += delta;
				const trimmed = accumulated.trim();
				if (trimmed) {
					hasContent = true;
					fullContent = trimmed;
					callback({ type: "text", text: trimmed });
				}
			}
		} catch (_err) {
			// Text projection may throw if the message had no text blocks; skip
		}
	}

	// Consume tool and lifecycle events from the raw ProtocolEvent stream
	for await (const event of stream) {
		if (!event || !event.params) continue;
		if (event.method === "tools") {
			emitToolEvent(event, callback);
		}
	}

	if (hasContent) {
		return { content: fullContent };
	}

	return { content: originalMessage };
}
