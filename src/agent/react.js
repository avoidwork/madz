import { createReactAgent as createReactAgentGraph } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import fs from "node:fs";

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

	// Normalize tool event names — protocol v3 uses hyphenated names
	// while internal handlers use "on_tool_*" prefixes.
	const eventName = data.event || data.langgraph_event || "";

	// DEBUG (sync, no await)
	try {
		fs.appendFileSync(
			"/tmp/madz_emit.log",
			`[${Date.now()}] emit ${eventName} via ${event.method}\n`,
		);
	} catch {
		/* */
	}

	if (
		eventName === "tool-started" ||
		eventName === "on_tool_start" ||
		eventName === "tool_called"
	) {
		callback({
			type: "tool_start",
			toolName: data.tool_name || data.name || data.tool || "",
			toolCallId: data.tool_call_id || data.toolCallId || "",
		});
	} else if (
		eventName === "tool-output-delta" ||
		eventName === "on_tool_event" ||
		eventName === "partial_result" ||
		eventName === "tool_output"
	) {
		callback({
			type: "tool_event",
			toolCallId: data.tool_call_id || data.toolCallId || "",
			data: data.delta ?? data.data ?? data.output,
		});
	} else if (
		eventName === "tool-finished" ||
		eventName === "on_tool_end" ||
		eventName === "tool_finished"
	) {
		callback({
			type: "tool_end",
			toolName: data.tool_name || data.name || data.tool || "",
			toolCallId: data.tool_call_id || data.toolCallId || "",
			data: data.output ?? data.data,
		});
	} else if (
		eventName === "tool-error" ||
		eventName === "on_tool_error" ||
		eventName === "tool_error" ||
		eventName === "partial_error"
	) {
		const errMsg = data.message || data.error || "Unknown error";
		callback({
			type: "tool_error",
			toolName: data.tool_name || data.name || data.tool || "",
			toolCallId: data.tool_call_id || data.toolCallId || "",
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

	// Collect *all* events from `stream` directly (not `stream.messages`).
	// Tool events → `method: "tools"`, chat model chunks via `method:
	// "messages"` with `data.event`.  Iterating `stream` avoids the
	// ReplayBuffer blocking bug where ChatModelStream.text waits forever
	// when an AI message contains only tool calls.
	for await (const event of stream) {
		// Skip events we can't handle — they won't contain tool or text data.
		if (!event || !event.params || !event.params.data) continue;

		const methodName = event.method || "<unknown>";
		const eventKey =
			event.params.data.event ||
			event.params.data.node ||
			event.params.data.graph_name ||
			"<plain>";

		// DEBUG: log every event to file (Ink TUI swallows console output).
		// Read: tail -50 /tmp/madz_stream.log
		const fs = (await import("node:fs")).default;
		try {
			fs.appendFileSync("/tmp/madz_stream.log", `[${Date.now()}] m=${methodName} e=${eventKey}\n`);
		} catch {
			/* ignore logging errors */
		}

		if (methodName === "tools") {
			try {
				emitToolEvent(event, callback);
			} catch (_err) {
				/* callback error — don't break */
			}
			continue;
		}

		if (methodName === "messages") {
			const { data } = event.params;
			if (data.event !== "content-block-delta") continue;
			const textDelta = data.delta?.text || "";
			if (!textDelta) continue;
			fullContent += textDelta;
			const trimmed = fullContent.trim();
			if (trimmed) {
				callback({ type: "text", text: trimmed });
			}
			continue;
		}
	}

	// Nothing captured from agent — surface a clear error instead of
	// silently echoing the user's message.
	if (fullContent) {
		return { content: fullContent };
	}
	throw new Error("No response from agent — the LLM did not produce any output");
}
