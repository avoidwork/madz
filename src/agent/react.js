import { createReactAgent as createReactAgentGraph } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage, AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { extractContextLength, isContextLengthError, compactConversation } from "../tools/compactContext.js";

const RECURSION_LIMIT_MESSAGE =
	"I've reached the maximum number of reasoning steps on this thread. Please continue your message and I'll carry on, or start a new conversation if you'd prefer.";

const MAX_COMPACTION_ITERATIONS = 3;
const CONTEXT_TOO_LONG_MESSAGE =
	"The conversation is too long. Please start a new session.";

/**
 * Create a ReAct agent from a chat model and optional tools and checkpointer.
 * The agent uses LangGraph under the hood via `@langchain/langgraph/prebuilt`.
 * @param {ChatLanguageModel} model - A chat language model instance (e.g., ChatOpenAI)
 * @param {unknown[]} [tools=[]] - Optional array of LangChain tool definitions
 * @param {import("@langchain/langgraph").BaseCheckpointSaver | null} [checkpointer=null] - Optional LangGraph checkpointer for persistent conversation memory
 * @param {number} [recursionLimit] - Optional LangGraph recursion limit for the agent graph
 * @returns {ReturnType<typeof createReactAgentGraph>} A compiled ReAct agent
 */
/* node:coverage ignore next */
export function createReactAgent(model, tools = [], checkpointer = null, recursionLimit = null) {
	return createReactAgentGraph({
		llm: model,
		tools,
		...(checkpointer && { checkpointer }),
		...(recursionLimit !== null && { recursionLimit }),
	});
}

/**
 * Invoke a ReAct agent with a single user message and return the final response.
 * On the first call (new thread) the system prompt is prepended. On subsequent
 * calls the checkpointer already carries the system message, so it is skipped.
 *
 * Automatically handles LLM context length errors by compacting the conversation
 * and retrying up to MAX_COMPACTION_ITERATIONS times.
 *
 * @param {ReturnType<typeof createReactAgentGraph>} agent - A compiled ReAct agent
 * @param {string} message - The user message string
 * @param {Object} config - Config object with `configurable: { thread_id }`
 * @param {string} [systemPrompt] - Optional system prompt (prepended only on new threads)
 * @param {(event: StreamEvent) => void} [callback] - Optional streaming event callback
 * @param {Object} [options] - Additional options
 * @param {number} [options.maxContextLength] - Model's max context length (from error detection)
 * @param {number} [options.maxTokens] - Max output tokens from config
 * @param {number} [options.maxCompactionIterations] - Max compaction retry attempts (default: 3)
 * @returns {{ content: string }} The agent's final text response
 */
export async function callReactAgent(agent, message, config, systemPrompt, callback, options = {}) {
	const {
		maxContextLength,
		maxTokens,
		maxCompactionIterations = MAX_COMPACTION_ITERATIONS,
	} = options;

	let messages = [new HumanMessage(message)];

	if (systemPrompt) {
		const isNewThread = config?.configurable?.isNewThread ?? true;
		if (isNewThread) {
			messages.unshift(new SystemMessage(systemPrompt));
		}
	}

	if (callback) {
		return callReactAgentStreaming(agent, messages, message, config, callback, options);
	}

	let _lastError = null;
	let iteration = 0;
	let effectiveContextLength = maxContextLength;
	let effectiveMaxTokens = maxTokens;

	while (iteration <= maxCompactionIterations) {
		try {
			const result = await agent.invoke({ messages }, config);
			return extractContent(result, message);
		} catch (err) {
			// Handle recursion limit — always return immediately
			if (err instanceof Error && err.name === "GraphRecursionError") {
				return { content: RECURSION_LIMIT_MESSAGE };
			}

			// Check for context length error
			if (isContextLengthError(err)) {
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
				const conversation = messages
					.filter((m) => !(m instanceof SystemMessage))
					.map((m) => ({
						role: m instanceof HumanMessage ? "user" : m instanceof AIMessage ? "assistant" : "system",
						content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
					}));

				const compacted = compactConversation({
					systemPrompt: systemPrompt || "",
					conversation,
					targetTokens,
				});

				if (!compacted.ok || compacted.compactedMessages.length === 0) {
					return { content: CONTEXT_TOO_LONG_MESSAGE };
				}

				// Rebuild messages from compacted result
				messages = compacted.compactedMessages.map((m) => {
					if (m.role === "system") {
						return new SystemMessage(m.content);
					} else if (m.role === "user") {
						return new HumanMessage(m.content);
					}
					return new AIMessage(m.content);
				});

				iteration++;
				_lastError = err;

				if (iteration > maxCompactionIterations) {
					return { content: CONTEXT_TOO_LONG_MESSAGE };
				}

				continue;
			}

			// Non-context-length error — rethrow
			throw err;
		}
	}

	return { content: CONTEXT_TOO_LONG_MESSAGE };
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
 * Run the agent in streaming mode using the `streamEvents` API with v2 protocol.
 * Yields granular events for text streaming, reasoning content, and tool execution.
 *
 * Automatically handles LLM context length errors by compacting the conversation
 * and retrying up to MAX_COMPACTION_ITERATIONS times.
 *
 * @param {ReturnType<typeof createReactAgentGraph>} agent - A compiled ReAct agent
 * @param {import("@langchain/core/messages").BaseMessage[]} initMessages - Initial messages
 * @param {string} originalMessage - Original user message (fallback)
 * @param {Object | null} [config] - Optional config with `configurable: { thread_id }`
 * @param {(event: StreamEvent) => void} callback - Event callback function
 * @param {Object} [options] - Additional options (same as callReactAgent)
 * @returns {{ content: string }} The agent's final text response
 */
async function callReactAgentStreaming(agent, initMessages, originalMessage, config, callback, options = {}) {
	const {
		maxContextLength,
		maxTokens,
		maxCompactionIterations = MAX_COMPACTION_ITERATIONS,
	} = options;

	const streamOptions = {
		configurable: config?.configurable,
	};

	let _lastError = null;
	let iteration = 0;
	let effectiveContextLength = maxContextLength;
	let effectiveMaxTokens = maxTokens;
	let currentMessages = initMessages;

	while (iteration <= maxCompactionIterations) {
		let toolCallSet = new Set();

		try {
			const stream = await agent.streamEvents(
				{ messages: currentMessages },
				{ version: "v2", ...streamOptions },
			);

			for await (const event of stream) {
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
						// For tool-invoking LLM calls, the text might be empty or tool-call-related
						callback({ type: "text", text: textContent });
						// Note: the TUI accumulates text in committedContent for the final response,
						// so we don't need to track it here.
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
					const toolName = input.name || toolCalls[0]?.name || output.tool_calls?.[0]?.name || "tool";
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

			// Success — return originalMessage as fallback
			return { content: originalMessage };
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
						role: m instanceof HumanMessage ? "user" : m instanceof AIMessage ? "assistant" : "system",
						content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
					}));

				const compacted = compactConversation({
					systemPrompt: "",
					conversation,
					targetTokens,
				});

				if (!compacted.ok || compacted.compactedMessages.length === 0) {
					return { content: originalMessage };
				}

				// Rebuild messages from compacted result
				currentMessages = compacted.compactedMessages.map((m) => {
					if (m.role === "system") {
						return new SystemMessage(m.content);
					} else if (m.role === "user") {
						return new HumanMessage(m.content);
					}
					return new AIMessage(m.content);
				});

				iteration++;
				_lastError = err;

				if (iteration > maxCompactionIterations) {
					return { content: originalMessage };
				}

				continue;
			}

			// Non-context-length error — rethrow
			throw err;
		}
	}

	return { content: originalMessage };
}
