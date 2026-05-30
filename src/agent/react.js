import { createReactAgent as createReactAgentGraph } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

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

	const lastAI = [...msgsArray].reverse().find((msg) => msg instanceof AIMessage);
	if (lastAI && lastAI.content) {
		const content =
			typeof lastAI.content === "string" ? lastAI.content : JSON.stringify(lastAI.content);
		if (content.trim()) {
			return { content: content.trim() };
		}
	}

	return { content: fallback };
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

	let fullContent = "";
	let hasContent = false;

	// Collect text chunks while processing tool and other events in a single pass.
	// This avoids blocking on `stream.messages` when the LLM produces an AIMessage
	// with tool calls but no text — the ReplayBuffer inside ChatModelStream would
	// wait forever for a message-finish that never arrives.  By iterating the raw
	// stream and extracting text directly from event chunks we process everything
	// (tool calls and text) without any blocking iterators.
	for await (const event of stream) {
		if (!event || !event.params) continue;

		// Tool events are always emitted with method: "tools"
		if (event.method === "tools") {
			try {
				emitToolEvent(event, callback);
			} catch (_err) {
				// Callback error — don't break the streaming loop
			}
			continue;
		}

		// Extract streaming text from ChatModelStream chunk events
		const { data, chunk } = event.params;
		if (!data || !chunk) continue;

		let textDelta = "";
		if (data.event === "content-block-start") {
			const block = data.content?.[chunk.index] || {};
			textDelta = block.text || "";
		} else if (data.event === "content-block-delta") {
			textDelta = data.delta?.text || "";
		}

		if (textDelta) {
			const accumulated = fullContent + textDelta;
			const trimmed = accumulated.trim();
			if (trimmed) {
				hasContent = true;
				fullContent = accumulated;
				callback({ type: "text", text: trimmed });
			}
		}
	}

	if (hasContent) {
		return { content: fullContent };
	}

	return { content: originalMessage };
}
