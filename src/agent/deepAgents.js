import { createDeepAgent } from "deepagents";
import { createFilesystemMiddleware } from "deepagents";
import { createMemoryMiddleware } from "deepagents";
import { createSkillsMiddleware } from "deepagents";
import { createSummarizationMiddleware } from "deepagents";
import { HumanMessage } from "@langchain/core/messages";
import { loadConfig } from "../config/loader.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FileBackend } from "./fileBackend.js";

const RECURSION_LIMIT_MESSAGE =
	"I've reached the maximum number of reasoning steps on this thread. Please continue your message and I'll carry on, or start a new conversation if you'd prefer.";

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
 * Uses deepagents middleware for filesystem, memory, skills, and summarization.
 * @param {object} model - A chat language model instance
 * @param {unknown[]} tools - Array of LangChain tool definitions (non-overlapping tools)
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
	const config = loadConfig();
	const memoryDir = join(config.cwd, config.memory?.contextDir || "memory/context/");
	const allowedPaths = config.sandbox?.paths || ["./"];

	// Create file-based backend for deepagents middleware
	const fileBackend = new FileBackend(memoryDir, {
		allowedPaths: allowedPaths.map((p) => join(config.cwd, p)),
		maxReadSize: config.sandbox?.maxReadSize || "1mb",
	});

	// Build middleware array
	const middleware = [
		// Filesystem middleware — replaces readFile, writeFile, patch, searchFiles
		createFilesystemMiddleware({
			backend: fileBackend,
			permissions: allowedPaths,
		}),
		// Memory middleware — replaces memory tool
		createMemoryMiddleware({
			backend: fileBackend,
			sources: [memoryDir],
		}),
		// Skills middleware — replaces skillView, createSkill
		createSkillsMiddleware({
			backend: fileBackend,
		}),
		// Summarization middleware — replaces compactContext, compaction
		createSummarizationMiddleware({
			backend: fileBackend,
		}),
	];

	return createDeepAgent({
		model,
		systemPrompt,
		tools,
		middleware,
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
 * @param {string} [systemPrompt] - System prompt (handled by agent instance)
 * @param {(event: StreamEvent) => void} [callback] - Streaming event callback
 * @param {Object} [options] - Additional options
 * @returns {{ content: string }} Final response
 */
export async function invokeAgent(
	orchestrator,
	message,
	config,
	_systemPrompt,
	callback,
	options = {},
) {
	let messages = [new HumanMessage(message)];

	return streamAgent(
		orchestrator,
		messages,
		message,
		config,
		callback,
		options,
		"",
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
	const { signal } = options;

	const streamOptions = {
		configurable: config?.configurable,
		...(recursionLimit !== null && { recursionLimit }),
	};

	if (signal) {
		signal.throwIfAborted();
		streamOptions.signal = signal;
	}

	let iteration = 0;
	let currentMessages = initMessages;
	let compactionActive = false;
	let aggregatedText = "";

	while (iteration <= maxCompactionIterations) {
		try {
			const stream = await orchestrator.stream(
				{ messages: currentMessages },
				{ streamMode: ["updates", "messages"], subgraphs: true, ...streamOptions },
			);

			for await (const [, mode, data] of stream) {
				if (signal && signal.aborted) {
					if (compactionActive && callback) callback({ type: "compaction_end" });
					return { content: originalMessage };
				}

				// Messages mode — text chunks
				if (mode === "messages") {
					for (const msg of data) {
						const text = msg?.text || (typeof msg?.content === "string" ? msg.content : JSON.stringify(msg.content));
						if (text) {
							callback({ type: "text", text });
							aggregatedText += text;
						}
						if (msg?.reasoning) {
							callback({ type: "reasoning", text: msg.reasoning });
						}
					}
				}

				// Updates mode — tool events and status
				if (mode === "updates") {
					for (const nodeName of Object.keys(data)) {
						const update = data[nodeName];
						if (update?.event === "on_tool_start") {
							callback({ type: "tool_start", toolName: update?.name || "unknown" });
						}
						if (update?.event === "on_tool_end") {
							const output = update?.output || update?.result;
							callback({
								type: "tool_end",
								toolName: update?.name || "unknown",
								data: typeof output === "string" ? output.slice(0, 500) : output,
							});
						}
						if (update?.event === "on_tool_error") {
							callback({
								type: "tool_error",
								toolName: update?.name || "unknown",
								error: update?.error || update?.message,
							});
						}
					}
				}
			}

			if (compactionActive && callback) callback({ type: "compaction_end" });
			return { content: aggregatedText || originalMessage };
		} catch (err) {
			// Handle recursion limit
			if (err instanceof Error && err.name === "GraphRecursionError") {
				return { content: RECURSION_LIMIT_MESSAGE };
			}

			// Check for context length error
			if (err.message?.includes("context length") || err.message?.includes("maximum context")) {
				if (!compactionActive && callback) {
					compactionActive = true;
					callback({ type: "compaction_start" });
				}

				if (!effectiveContextLength) {
					const match = err.message.match(/(\d+)/);
					effectiveContextLength = match ? parseInt(match[1], 10) : undefined;
				}

				if (compactionActive && callback) callback({ type: "compaction_end" });
				return { content: originalMessage };
			}

			throw err;
		}
	}

	if (compactionActive && callback) callback({ type: "compaction_end" });
	return { content: aggregatedText || originalMessage };
}