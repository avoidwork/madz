import {
	StateGraph,
	Command,
	Annotation,
} from "@langchain/langgraph";
import {
	HumanMessage,
	HumanMessageChunk,
	SystemMessage,
	AIMessage,
	AIMessageChunk,
	ToolMessage,
} from "@langchain/core/messages";
import { ToolExecutor } from "@langchain/langgraph/prebuilt";
import {
	extractContextLength,
	isContextLengthError,
	compactConversation,
} from "../tools/compact_context.js";
import { createLlmCache, getCacheKey } from "../cache/llm_cache.js";
import { loadConfig } from "../config/loader.js";

/**
 * Map a LangChain message instance to its corresponding conversation role.
 * Handles all standard message types — HumanMessage, AIMessage, SystemMessage,
 * ToolMessage, and their chunk variants — falling back to "system" for unknown
 * types to avoid silent data loss during compaction.
 * @param {import("@langchain/core/messages").BaseMessage} msg
 * @returns {string}
 */
export function getMessageRole(msg) {
	if (msg instanceof HumanMessage || msg instanceof HumanMessageChunk) return "user";
	if (msg instanceof AIMessage || msg instanceof AIMessageChunk) return "assistant";
	if (msg instanceof ToolMessage) return "tool";
	if (msg instanceof SystemMessage) return "system";
	return "system"; // fallback — shouldn't happen with well-formed conversations
}

/**
 * Lazily initialize the LLM response cache using configured lru.size and lru.ttl.
 * Falls back to defaults (100, 600000) if config is unavailable.
 */
let _cache = null;
function _getCache() {
	if (!_cache) {
		try {
			const config = loadConfig();
			_cache = createLlmCache(config.lru.size, config.lru.ttl);
		} catch {
			// Config unavailable — fall back to defaults
			_cache = createLlmCache(100, 600000);
		}
	}
	return _cache;
}

/**
 * Clear the LLM response cache. Primarily for testing.
 */
export function clearCache() {
	_getCache().clear();
}

/**
 * Return the LLM response cache instance. Primarily for testing.
 * @returns {Object} Cache instance with get, set, and clear methods
 */
export function getCache() {
	return _getCache();
}

const RECURSION_LIMIT_MESSAGE =
	"I've reached the maximum number of reasoning steps on this thread. Please continue your message and I'll carry on, or start a new conversation if you'd prefer.";

const MAX_COMPACTION_ITERATIONS = 3;

/**
 * Simple hash for turn detection — non-cryptographic, fast.
 * @param {string} str
 * @returns {string}
 */
function hashTurn(str) {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0; // Convert to 32-bit integer
	}
	return hash.toString(36);
}

// --- Agent State Schema ---

/**
 * State schema for the custom ReAct agent graph.
 * @type {Annotation.Root}
 */
const AgentState = Annotation.Root({
	/**
	 * Conversation messages.
	 * @type {import("@langchain/core/messages").BaseMessage[]}
	 */
	messages: Annotation({
		reducer: (x, y) => x.concat(y),
		default: () => [],
	}),
	/**
	 * Sliding window of recent turn hashes for loop detection.
	 * @type {Set<string>}
	 */
	turnHashes: Annotation({
		reducer: (_x, y) => y,
		default: () => new Set(),
	}),
	/**
	 * Count of nudge messages injected.
	 * @type {number}
	 */
	nudgeCount: Annotation({
		reducer: (_x, y) => y,
		default: () => 0,
	}),
});

// --- Graph Nodes ---

/**
 * Agent node — calls the LLM with tools bound.
 * Returns the AIMessage response. The graph's conditional edge
 * routes to tool_executor if tool calls are present, or to
 * loop_detector if not.
 * @param {Record<string, unknown>} state - The current graph state
 * @returns {Promise<{ messages: import("@langchain/core/messages").BaseMessage[] }>}
 */
async function agentNode(state) {
	const { messages, llm } = state;
	const response = await llm.invoke(messages);
	return { messages: [response] };
}

/**
 * Tool executor node — executes tool calls from the last AIMessage.
 * Returns the ToolMessages. The graph routes back to agentNode
 * after execution.
 * @param {Record<string, unknown>} state - The current graph state
 * @returns {Promise<{ messages: import("@langchain/core/messages").BaseMessage[] }>}
 */
async function toolExecutorNode(state) {
	const { messages, toolExecutor } = state;
	const lastAIMessage = [...messages].reverse().find(
		(m) => m instanceof AIMessage,
	);
	if (!lastAIMessage?.tool_calls) {
		return { messages: [] };
	}

	const results = await toolExecutor.invoke(lastAIMessage.tool_calls);
	return { messages: results };
}

/**
 * Loop detector node — checks turn hashes and returns a Command
 * to inject a nudge message if a loop is detected.
 * @param {Record<string, unknown>} state - The current graph state
 * @returns {Promise<Command | { messages: never[] }>}
 */
async function loopDetectorNode(state) {
	const { messages, turnHashes, nudgeCount, loopMsg, loopLimit, turnHashWindow } = state;

	const lastMessage = messages[messages.length - 1];
	if (!lastMessage?.content) {
		return { messages: [] };
	}

	const hash = hashTurn(String(lastMessage.content));
	const hashes = new Set(turnHashes);

	if (hashes.has(hash) && nudgeCount < loopLimit) {
		// Loop detected — return Command to actively interrupt and inject nudge
		return new Command({
			update: {
				messages: [new HumanMessage(loopMsg)],
				nudgeCount: nudgeCount + 1,
			},
			goto: "agent",
		});
	}

	// No loop or limit reached — update hash window
	hashes.add(hash);
	if (hashes.size > turnHashWindow) {
		hashes.delete(hashes.keys().next().value);
	}

	return { messages: [], turnHashes: hashes };
}

// --- Graph Builder ---

/**
 * Build the custom ReAct agent graph with Command-based loop detection.
 * @param {import("@langchain/core").BaseLanguageModel} model - The LLM
 * @param {unknown[]} tools - Array of LangChain tools
 * @param {import("@langchain/langgraph").ToolExecutor} toolExecutor - Tool executor
 * @param {Object} config - Agent config with loop detection settings
 * @param {import("@langchain/langgraph").BaseCheckpointSaver | null} [checkpointer=null] - Optional checkpointer
 * @returns {import("@langchain/langgraph").CompiledGraph}
 */
function buildGraph(model, tools, toolExecutor, config, checkpointer = null) {
	const agentConfig = config.agent || {};
	const loopMsg = agentConfig.loopMsg ?? "You are in a repetitive loop. Try a different approach.";
	const loopLimit = agentConfig.loopLimit ?? 5;
	const turnHashWindow = agentConfig.turnHashWindow ?? 20;

	// Bind tools once — avoids allocating a new bound LLM on every node execution
	const boundLlm = model.bindTools(tools);

	const graph = new StateGraph(AgentState)
		.addNode("agent", (state) => agentNode({ ...state, llm: boundLlm }))
		.addNode("tool_executor", (state) => toolExecutorNode({ ...state, toolExecutor }))
		.addNode("loop_detector", (state) =>
			loopDetectorNode({
				...state,
				loopMsg,
				loopLimit,
				turnHashWindow,
			}),
		)
		.addEdge("__start__", "agent")
		.addConditionalEdges(
			"agent",
			(state) => {
				const lastAIMessage = [...state.messages].reverse().find(
					(m) => m instanceof AIMessage,
				);
				return lastAIMessage?.tool_calls?.length > 0
					? "tool_executor"
					: "loop_detector";
			},
			{
				tool_executor: "tool_executor",
				loop_detector: "loop_detector",
			},
		)
		.addEdge("tool_executor", "agent")
		.addEdge("loop_detector", "__end__");

	return graph.compile({ checkpointer });
}

// --- Public API ---

/**
 * Create a ReAct agent with Command-based loop detection.
 * Uses a custom StateGraph instead of the prebuilt agent, enabling
 * active interruption via LangGraph Command when a loop is detected.
 * @param {import("@langchain/core").BaseLanguageModel} model - A chat language model instance
 * @param {unknown[]} [tools=[]] - Optional array of LangChain tool definitions
 * @param {import("@langchain/langgraph").BaseCheckpointSaver | null} [checkpointer=null] - Optional checkpointer
 * @param {number} [recursionLimit] - Optional LangGraph recursion limit
 * @param {number} [timeout] - Optional timeout in milliseconds (default: 600000)
 * @returns {import("@langchain/langgraph").CompiledGraph} A compiled ReAct agent graph
 */
/* node:coverage ignore next */
export function createReactAgent(
	model,
	tools = [],
	checkpointer = null,
	_recursionLimit = null,
	_timeout = 600000,
) {
	// Build the custom graph with optional checkpointer
	const toolExecutor = new ToolExecutor({ tools });
	const graph = buildGraph(model, tools, toolExecutor, { agent: {} }, checkpointer);

	return graph;
}

/**
 * Create a default stdout callback for non-TUI invocations.
 * Writes text chunks to stdout and loop_detected events to stderr.
 * Non-text events (tool_start, tool_end, reasoning, compaction) are silently ignored.
 * @returns {(event: StreamEvent) => void}
 */
export function createStdoutCallback() {
	return (event) => {
		switch (event.type) {
			case "text":
				process.stdout.write(event.text);
				break;
			case "loop_detected":
				process.stderr.write("[loop detected] Agent may be in a repetitive loop\n");
				break;
			// Other event types are TUI-specific — silently ignored in non-TUI mode
		}
	};
}

/**
 * Invoke a ReAct agent with a single user message and return the final response.
 * On the first call (new thread) the system prompt is prepended. On subsequent
 * calls the checkpointer already carries the system message, so it is skipped.
 *
 * Always uses the streaming pipeline. When no user-provided callback is supplied,
 * a default stdout callback is used for real-time output and loop detection.
 *
 * Automatically handles LLM context length errors by compacting the conversation
 * and retrying up to MAX_COMPACTION_ITERATIONS times.
 *
 * @param {import("@langchain/langgraph").CompiledGraph} agent - A compiled ReAct agent graph
 * @param {string} message - The user message string
 * @param {Object} config - Config object with `configurable: { thread_id }`
 * @param {string} [systemPrompt] - Optional system prompt (prepended only on new threads)
 * @param {(event: StreamEvent) => void} [callback] - Optional streaming event callback (TUI mode)
 * @param {Object} [options] - Additional options
 * @param {number} [options.maxContextLength] - Model's max context length (from error detection)
 * @param {number} [options.maxTokens] - Max output tokens from config
 * @param {number} [options.maxCompactionIterations] - Max compaction retry attempts (default: 3)
 * @param {number} [options.turnHashWindow] - Size of the sliding window for turn-level loop detection (default: 20)
 * @param {number} [options.turnBufferMax] - Maximum text buffer size per turn before hashing (default: 64)
 * @returns {{ content: string }} The agent's final text response
 */
export async function callReactAgent(agent, message, config, systemPrompt, callback, options = {}) {
	const { recursionLimit } = options;

	let messages = [new HumanMessage(message)];

	if (systemPrompt) {
		const isNewThread = config?.configurable?.isNewThread ?? true;
		if (isNewThread) {
			messages.unshift(new SystemMessage(systemPrompt));
		}
	}

	// Always use streaming — use user-provided callback (TUI) or default stdout callback (non-TUI)
	// null explicitly means "no callback" — undefined falls through to default stdout
	const effectiveCallback =
		callback !== undefined && callback !== null ? callback : createStdoutCallback();
	return callReactAgentStreaming(
		agent,
		messages,
		message,
		config,
		effectiveCallback,
		options,
		systemPrompt,
		recursionLimit,
	);
}

/**
 * Run the agent in streaming mode using the `streamEvents` API with v2 protocol.
 * Yields granular events for text streaming, reasoning content, and tool execution.
 *
 * Automatically handles LLM context length errors by compacting the conversation
 * and retrying up to MAX_COMPACTION_ITERATIONS times.
 *
 * @param {import("@langchain/langgraph").CompiledGraph} agent - A compiled ReAct agent graph
 * @param {import("@langchain/core/messages").BaseMessage[]} initMessages - Initial messages
 * @param {string} originalMessage - Original user message (fallback)
 * @param {Object | null} [config] - Optional config with `configurable: { thread_id }`
 * @param {(event: StreamEvent) => void} callback - Event callback function
 * @param {Object} [options] - Additional options (same as callReactAgent)
 * @param {AbortSignal} [options.signal] - Optional abort signal to interrupt the stream
 * @returns {{ content: string }} The agent's final text response
 */
async function callReactAgentStreaming(
	agent,
	initMessages,
	originalMessage,
	config,
	callback,
	options = {},
	systemPrompt = "",
	recursionLimit = null,
) {
	const {
		maxContextLength,
		maxTokens,
		maxCompactionIterations = MAX_COMPACTION_ITERATIONS,
		signal,
	} = options;

	const streamOptions = {
		configurable: config?.configurable,
		...(recursionLimit !== null && { recursionLimit }),
	};

	// If an abort signal is provided, listen for it and break the stream loop
	if (signal) {
		signal.throwIfAborted();
		streamOptions.signal = signal;
	}

	// Cache-aside: extract thread_id and check cache before streaming
	const threadId = config?.configurable?.thread_id;
	const cacheKey = threadId ? getCacheKey(threadId, originalMessage) : null;
	if (cacheKey) {
		const cached = getCache().get(cacheKey);
		if (cached) {
			// Emit cached content as text events
			callback({ type: "text", text: cached });
			return { content: cached };
		}
	}

	let _lastError = null;
	let iteration = 0;
	let effectiveContextLength = maxContextLength;
	let effectiveMaxTokens = maxTokens;
	let currentMessages = initMessages;
	let compactionActive = false;

	// Aggregate text chunks for caching (only cache on successful completion)
	let aggregatedText = "";

	while (iteration <= maxCompactionIterations) {
		let toolCallSet = new Set();

		try {
			const stream = await agent.streamEvents(
				{ messages: currentMessages },
				{ version: "v2", ...streamOptions },
			);

			for await (const event of stream) {
				// Check for abort signal on each event
				if (signal && signal.aborted) {
					// Do NOT cache on abort
					// Emit tool_end for any tool_start that didn't get a corresponding tool_end
					for (const key of toolCallSet) {
						const [name] = key.split("|");
						callback({ type: "tool_end", toolName: name });
					}
					if (compactionActive && callback) {
						callback({ type: "compaction_end" });
					}
					return { content: originalMessage };
				}
				// Chat model text/reasoning streaming events
				if (event.event === "on_chat_model_stream") {
					const chunk = event.data?.chunk;
					if (!chunk) continue;

					// Track final text content from chat model stream
					let textContent = "";
					if (typeof chunk.content === "string") {
						textContent = chunk.content;
					} else if (
						typeof chunk.content === "object" &&
						chunk.content !== null &&
						!Array.isArray(chunk.content) &&
						chunk.content.text
					) {
						textContent = chunk.content.text;
					}

					// Emit text content deltas
					if (Array.isArray(chunk.content)) {
						for (const block of chunk.content) {
							if (block.type === "text" && block.text && block.text.length > 0) {
								textContent = block.text;
							}
						}
					}
					if (textContent.length > 0) {
						// Emit text content deltas
						callback({ type: "text", text: textContent });
						// Aggregate text for caching
						aggregatedText += textContent;
					}

					// Emit reasoning/thinking content
					if (chunk.reasoning) {
						callback({ type: "reasoning", text: chunk.reasoning });
					}
				}

				// Tool execution start
				if (event.event === "on_tool_start" && event.name === "tool") {
					const input = event.data?.input || {};
					const toolCalls = Array.isArray(input.tool_calls) ? input.tool_calls : [];
					for (const tc of toolCalls) {
						const key = tc.name + "|" + tc.id;
						if (!toolCallSet.has(key)) {
							toolCallSet.add(key);
							callback({
								type: "tool_start",
								toolName: tc.name || input.name || "unknown",
								toolCallId: tc.id,
							});
						}
					}
				}

				// Tool execution end with result
				if (event.event === "on_tool_end" && event.name === "tool") {
					const output = event.data?.output || {};
					const input = event.data?.input || {};
					const toolCalls = Array.isArray(input.tool_calls) ? input.tool_calls : [];
					const toolName =
						input.name || toolCalls[0]?.name || output.tool_calls?.[0]?.name || "tool";
					const toolCallId = toolCalls[0]?.id || "";
					const resultData =
						output.content || toolCalls[0]?.output || output.tool_calls?.[0]?.output || "";

					callback({
						type: "tool_end",
						toolName,
						toolCallId,
						data: typeof resultData === "string" ? resultData.slice(0, 500) : resultData,
					});
				}

				// Tool execution error
				if (event.event === "on_tool_error" && event.name === "tool") {
					const input = event.data?.input || {};
					const toolCalls = Array.isArray(input.tool_calls) ? input.tool_calls : [];
					const toolName = input.name || toolCalls[0]?.name || "unknown";
					const toolCallId = toolCalls[0]?.id || "";
					callback({
						type: "tool_error",
						toolName,
						toolCallId,
						error: event.data?.error,
					});
				}
			}

			// Emit tool_end for any tool_start that didn't get a corresponding tool_end
			for (const key of toolCallSet) {
				const [name] = key.split("|");
				callback({ type: "tool_end", toolName: name });
			}

			// Cache the aggregated response on successful completion (only if no tools were used)
			if (cacheKey && aggregatedText && toolCallSet.size === 0) {
				getCache().set(cacheKey, aggregatedText);
			}

			// Success — emit compaction_end if compaction was active, then return
			if (compactionActive && callback) {
				callback({ type: "compaction_end" });
			}
			return { content: aggregatedText || originalMessage };
		} catch (err) {
			// Handle recursion limit — always return immediately
			if (err instanceof Error && err.name === "GraphRecursionError") {
				return { content: RECURSION_LIMIT_MESSAGE };
			}

			// Emit tool_end for any tool_start that didn't get a corresponding tool_end
			for (const key of toolCallSet) {
				const [name] = key.split("|");
				callback({ type: "tool_end", toolName: name });
			}

			// Check for context length error
			if (isContextLengthError(err)) {
				// Emit compaction_start on first detection
				if (!compactionActive && callback) {
					compactionActive = true;
					callback({ type: "compaction_start" });
				}

				// Extract max context length from error if not already known
				if (!effectiveContextLength) {
					effectiveContextLength = extractContextLength(err.message);
				}

				// Calculate target tokens
				const targetTokens =
					effectiveContextLength && effectiveMaxTokens
						? effectiveContextLength - effectiveMaxTokens
						: 50000;

				// Compact the messages (strip system message, keep conversation)
				const conversation = currentMessages
					.filter((m) => !(m instanceof SystemMessage))
					.map((m) => ({
						role: getMessageRole(m),
						content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
					}));

				const compacted = compactConversation({
					systemPrompt,
					conversation,
					targetTokens,
				});

				if (!compacted.ok || compacted.compactedMessages.length === 0) {
					// Emit compaction_end before early return
					if (compactionActive && callback) {
						callback({ type: "compaction_end" });
					}
					return { content: originalMessage };
				}

				// Rebuild messages from compacted result
				currentMessages = compacted.compactedMessages.map((m) => {
					if (m.role === "system") {
						return new SystemMessage(m.content);
					} else if (m.role === "user") {
						return new HumanMessage(m.content);
					} else if (m.role === "tool") {
						return new ToolMessage(m.content);
					}
					return new AIMessage(m.content);
				});

				iteration++;
				_lastError = err;

				if (iteration > maxCompactionIterations) {
					// Emit compaction_end before early return
					if (compactionActive && callback) {
						callback({ type: "compaction_end" });
					}
					return { content: originalMessage };
				}

				continue;
			}

			// Non-context-length error — rethrow
			throw err;
		}
	}

	// Emit compaction_end when exiting the compaction loop
	if (compactionActive && callback) {
		callback({ type: "compaction_end" });
	}

	return { content: aggregatedText || originalMessage };
}