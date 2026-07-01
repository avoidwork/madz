import { createDeepAgent } from "deepagents";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
	extractContextLength,
	isContextLengthError,
	compactConversation,
} from "../tools/compact_context.js";
import { createLlmCache, getCacheKey } from "../cache/llm_cache.js";
import { loadConfig } from "../config/loader.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let _cache = null;
function _getCache() {
	if (!_cache) {
		try {
			const config = loadConfig();
			_cache = createLlmCache(config.lru.size, config.lru.ttl);
		} catch {
			_cache = createLlmCache(100, 600000);
		}
	}
	return _cache;
}

export function clearCache() {
	_getCache().clear();
}

export function getCache() {
	return _getCache();
}

const RECURSION_LIMIT_MESSAGE =
	"I've reached the maximum number of reasoning steps on this thread. Please continue your message and I'll carry on, or start a new conversation if you'd prefer.";

const MAX_COMPACTION_ITERATIONS = 3;

function loadSubAgentPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return readFileSync(join(dir, "prompts", "SUB_AGENT.md"), "utf-8");
	} catch {
		return "";
	}
}

/**
 * Create a Deep Agents orchestrator with coding and utility sub-agents.
 * @param {object} model - A chat language model instance
 * @param {unknown[]} tools - Array of LangChain tool definitions
 * @param {string} systemPrompt - The main system prompt
 * @param {import("@langchain/langgraph").BaseCheckpointSaver | null} [checkpointer=null] - Optional checkpointer
 * @returns {Object} Deep Agents orchestrator instance
 */
export function createDeepAgentsOrchestrator(
	model,
	tools = [],
	systemPrompt = "",
	checkpointer = null,
) {
	const subAgentPrompt = loadSubAgentPrompt();

	return createDeepAgent({
		model,
		systemPrompt,
		tools,
		subagents: [
			{
				name: "coding-agent",
				description:
					"Specialized agent for code-related tasks including file editing, debugging, implementation, and code review.",
				systemPrompt: subAgentPrompt
					? `${subAgentPrompt}\n\nYou are the coding specialist sub-agent. Focus on code-related tasks.`
					: "You are a coding specialist. Handle all code-related tasks.",
			},
			{
				name: "utility-agent",
				description:
					"General-purpose agent for research, file search, multi-step tasks, skill execution, and non-code work.",
				systemPrompt: subAgentPrompt
					? `${subAgentPrompt}\n\nYou are the general-purpose utility sub-agent. Handle research, file search, multi-step tasks, and general assistance.`
					: "You are a general-purpose utility agent. Handle research, file search, multi-step tasks, and general assistance.",
			},
		],
		...(checkpointer && { checkpointer }),
	});
}

/**
 * Invoke the Deep Agents orchestrator with streaming support.
 * @param {Object} orchestrator - A Deep Agents orchestrator instance
 * @param {string} message - The user message
 * @param {Object} config - Config with `configurable: { thread_id }`
 * @param {string} [systemPrompt] - System prompt (prepended on new threads)
 * @param {(event: StreamEvent) => void} [callback] - Streaming event callback
 * @param {Object} [options] - Additional options
 * @returns {{ content: string }} Final response
 */
export async function invokeAgent(
	orchestrator,
	message,
	config,
	systemPrompt,
	callback,
	options = {},
) {
	let messages = [new HumanMessage(message)];

	if (systemPrompt) {
		const isNewThread = config?.configurable?.isNewThread ?? true;
		if (isNewThread) {
			messages.unshift(new SystemMessage(systemPrompt));
		}
	}

	return streamAgent(
		orchestrator,
		messages,
		message,
		config,
		callback,
		options,
		systemPrompt,
		options.recursionLimit,
	);
}

/**
 * Stream the orchestrator using Deep Agents' native stream API.
 */
async function streamAgent(
	orchestrator,
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

	if (signal) {
		signal.throwIfAborted();
		streamOptions.signal = signal;
	}

	const threadId = config?.configurable?.thread_id;
	const cacheKey = threadId ? getCacheKey(threadId, originalMessage) : null;
	if (cacheKey) {
		const cached = getCache().get(cacheKey);
		if (cached) {
			callback({ type: "text", text: cached });
			return { content: cached };
		}
	}

	let iteration = 0;
	let effectiveContextLength = maxContextLength;
	let effectiveMaxTokens = maxTokens;
	let currentMessages = initMessages;
	let compactionActive = false;
	let aggregatedText = "";

	while (iteration <= maxCompactionIterations) {
		try {
			const stream = await orchestrator.stream(
				{ messages: currentMessages },
				{ streamMode: "updates", subgraphs: true, ...streamOptions },
			);

			for await (const [, chunk] of stream) {
				if (signal && signal.aborted) {
					if (compactionActive && callback) callback({ type: "compaction_end" });
					return { content: originalMessage };
				}

				// Text from model
				if (chunk?.type === "text" || typeof chunk?.text === "string") {
					const text = typeof chunk === "string" ? chunk : chunk.text;
					if (text) {
						callback({ type: "text", text });
						aggregatedText += text;
					}
				}

				// Message chunks
				if (chunk?.type === "message" || chunk?.message) {
					const msg = chunk.message || chunk;
					if (msg?.content) {
						const text =
							typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
						if (text) {
							callback({ type: "text", text });
							aggregatedText += text;
						}
					}
				}

				// Tool events
				if (chunk?.type === "tool_start" || chunk?.event === "on_tool_start") {
					callback({ type: "tool_start", toolName: chunk?.name || "unknown" });
				}
				if (chunk?.type === "tool_end" || chunk?.event === "on_tool_end") {
					const output = chunk?.output || chunk?.result;
					callback({
						type: "tool_end",
						toolName: chunk?.name || "unknown",
						data: typeof output === "string" ? output.slice(0, 500) : output,
					});
				}
				if (chunk?.type === "tool_error" || chunk?.event === "on_tool_error") {
					callback({
						type: "tool_error",
						toolName: chunk?.name || "unknown",
						error: chunk?.error || chunk?.message,
					});
				}

				// Reasoning
				if (chunk?.type === "reasoning" || chunk?.reasoning) {
					const text = typeof chunk === "string" ? chunk : chunk.reasoning;
					if (text) callback({ type: "reasoning", text });
				}

				// Loop detection
				if (chunk?.type === "loop_detected" || chunk?.loop_detected) {
					callback({ type: "loop_detected" });
				}
			}

			if (cacheKey && aggregatedText) getCache().set(cacheKey, aggregatedText);
			if (compactionActive && callback) callback({ type: "compaction_end" });
			return { content: aggregatedText || originalMessage };
		} catch (err) {
			if (err instanceof Error && err.name === "GraphRecursionError") {
				return { content: RECURSION_LIMIT_MESSAGE };
			}

			if (isContextLengthError(err)) {
				if (!compactionActive && callback) {
					compactionActive = true;
					callback({ type: "compaction_start" });
				}

				if (!effectiveContextLength) {
					effectiveContextLength = extractContextLength(err.message);
				}

				const targetTokens =
					effectiveContextLength && effectiveMaxTokens
						? effectiveContextLength - effectiveMaxTokens
						: 50000;

				const conversation = currentMessages
					.filter((m) => !(m instanceof SystemMessage))
					.map((m) => ({
						role:
							m._getType() === "system"
								? "system"
								: m._getType() === "human"
									? "user"
									: m._getType() === "ai"
										? "assistant"
										: "tool",
						content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
					}));

				const compacted = compactConversation({ systemPrompt, conversation, targetTokens });

				if (!compacted.ok || compacted.compactedMessages.length === 0) {
					if (compactionActive && callback) callback({ type: "compaction_end" });
					return { content: originalMessage };
				}

				currentMessages = compacted.compactedMessages.map((m) => {
					if (m.role === "system") return new SystemMessage(m.content);
					if (m.role === "user") return new HumanMessage(m.content);
					return new SystemMessage(m.content);
				});

				iteration++;

				if (iteration > maxCompactionIterations) {
					if (compactionActive && callback) callback({ type: "compaction_end" });
					return { content: originalMessage };
				}
				continue;
			}

			throw err;
		}
	}

	if (compactionActive && callback) callback({ type: "compaction_end" });
	return { content: aggregatedText || originalMessage };
}
