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
		const checkpointer = new SqliteSaver(dbPath);
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
 * Supports a configurable langGraph config (e.g. configurable: { thread_id })
 * for checkpointing. Errors are re-thrown without modification for propagation
 * to the caller.
 * @param {import("@langchain/langgraph").CompiledStateGraph} agent - A compiled ReAct agent
 * @param {string} message - The user message string
 * @param {string} [systemPrompt] - Optional system prompt text prepended before the user message
 * @param {(object|((event: StreamEvent) => void))} [configOrCallback] - Optional callback function or config object
 * @param {((event: StreamEvent) => void)} [callback] - Optional callback when configOrCallback is an object
 * @returns {{ content: string }} The agent's final text response
 */
export function callReactAgent(agent, message, systemPrompt, configOrCallback, callback) {
	const initMessages = [
		systemPrompt ? new SystemMessage(systemPrompt) : null,
		new HumanMessage(message),
	].filter(Boolean);

	let langGraphConfig = null;
	let isStreaming = false;

	if (typeof configOrCallback === "function") {
		isStreaming = true;
	} else if (typeof configOrCallback === "object" && configOrCallback !== null) {
		langGraphConfig = configOrCallback;
		if (typeof callback === "function") {
			isStreaming = true;
		}
	}

	if (isStreaming) {
		return callReactAgentStreaming(agent, initMessages, message, langGraphConfig, configOrCallback);
	}

	const result = agent.invoke({ messages: initMessages }, langGraphConfig);

	const msgsArray = Array.isArray(result.messages)
		? result.messages
		: result.lc_events === undefined
			? []
			: [];

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
 * Emits a tool event from a tools channels ProtocolEvent.
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
 * Supports an optional langGraph config for checkpointing.
 * @param {import("@langchain/langgraph").CompiledStateGraph} agent - A compiled ReAct agent
 * @param {import("@langchain/core/messages").BaseMessage[]} initMessages - Initial messages
 * @param {string} originalMessage - Original user message (fallback)
 * @param {object} [langGraphConfig] - LangGraph config (e.g. configurable: { thread_id })
 * @param {(event: StreamEvent) => void} callback - Event callback function
 * @returns {{ content: string }} The agent's final text response
 */
async function callReactAgentStreaming(
	agent,
	initMessages,
	originalMessage,
	langGraphConfig,
	callback,
) {
	const streamOptions = { version: "v3" };
	if (langGraphConfig) {
		streamOptions.configurable = langGraphConfig.configurable;
	}
	const stream = await agent.streamEvents({ messages: initMessages }, streamOptions);

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
