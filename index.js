#!/usr/bin/env node

// Parse CLI arguments via yargs first — before loading config
import yargs from "yargs";
const parsed = yargs(process.argv.slice(2))
	.option("mode", {
		alias: "m",
		type: "string",
		description: "CLI mode: 'chat' or 'interactive'",
	})
	.option("session", {
		type: "string",
		description: "Session ID to restore",
	})
	.option("index-code", {
		type: "boolean",
		description: "Index project source code for vector search",
	})
	.positional("message", {
		type: "string",
		description: "Message to send",
	}).argv;

// Load config
import { loadConfig } from "./src/config/loader.js";
const config = loadConfig();
import { fileURLToPath } from "node:url";
import { resumeSession } from "./src/session/resume.js";

import React from "react";
import { HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { isSubagentNamespace } from "./src/stream/namespace.js";
import { surfaceInterrupt } from "./src/stream/interrupt.js";

const { setConfigValue } = await import("./src/config/loader.js");
const { createDeepAgentsOrchestrator, toConversationExchange } =
	await import("./src/agent/deepAgents.js");
const { getActiveModelName, getActiveProviderName } = await import("./src/provider/index.js");
const { logger } = await import("./src/shared/logger.js");

const { default: pkg } = await import(new URL("./package.json", import.meta.url).href, {
	with: { type: "json" },
});

const { ensureSessionsDir } = await import("./src/session/index.js");
const { ensureToolsDir, ensureScreenshotsDir, ensureContextDir } =
	await import("./src/memory/index.js");

// Ensure sessions directory exists before any subsystem initialization
await ensureSessionsDir(config.memory.sessionsDir);

// Ensure memory/tools directory exists before any subsystem initialization
await ensureToolsDir(config.memory.toolsDir);

// Ensure memory/screenshots directory exists before any subsystem initialization
await ensureScreenshotsDir(config.memory.screenshotsDir);

// Ensure memory/context directory exists before any subsystem initialization
await ensureContextDir(config.memory.contextDir);

// Initialize subsystems
// Write .env.cron before any subsystem that may use cron
try {
	const { writeEnvCron } = await import("./src/scheduler/cron.js");
	await writeEnvCron(process.cwd());
} catch (err) {
	logger.warn(`[cron] Failed to write .env.cron: ${err.message}`);
}

// Sync crontab from persisted job definitions (runs before any subsystem)
if (config.schedules.syncOnInit !== false) {
	try {
		const { Cron } = await import("./src/scheduler/cron.js");
		if (config.schedules.logPath) {
			Cron.setLogPath(config.schedules.logPath);
		}
		const schedulesDir = config.memory?.schedulesDir || "memory/schedules/";
		const result = await Cron.sync(schedulesDir);
		if (result.error) {
			logger.warn(`[scheduler] Crontab sync failed: ${result.error}`);
		} else {
			logger.info(
				`[scheduler] Crontab sync complete: +${result.added} added, -${result.removed} removed, ~${result.updated} updated, =${result.skipped} skipped`,
			);
		}
	} catch (err) {
		logger.warn(`[scheduler] Crontab sync error: ${err.message}`);
	}
}

// Initialize contextual onboarding if profile is missing (with graceful degradation)
let onboardingInstance = null;
try {
	const { hasProfile, ATTRIBUTES } = await import("./src/memory/profile.js");
	if (!(await hasProfile())) {
		const { createOnboarding } = await import("./src/session/onboarding.js");
		onboardingInstance = createOnboarding(ATTRIBUTES, { onSave: () => {} });
	}
} catch {
	// Fail gracefully: continue without onboarding if profile detection fails
}

// Boot telemetry if enabled
let tracer = null;
let shutdownFn = null;
if (config.telemetry.enabled) {
	const { initTelemetry, getTracer, shutdownTelemetry } =
		await import("./src/telemetry/provider.js");
	await initTelemetry(config.telemetry);
	tracer = getTracer();
	shutdownFn = shutdownTelemetry;
}

// Initialize skill registry
const { SkillRegistry, ensureSkillsDir } = await import("./src/skills/index.js");
const registry = new SkillRegistry();
await ensureSkillsDir(config.cwd + "/" + "skills/");
await registry.discover();

// Initialize memory system
const { readMemoryFile, loadContext, expireEphemeralMemories } =
	await import("./src/memory/index.js");

// Initialize GC manager (if enabled)
let gcManager = null;
let gcTrace = null;
let maxGcPerHour = 4;
try {
	const { initGC, gc: gcFn, isAvailable } = await import("./src/memory/gc.js");
	const gcConfig = config.memory?.gc;
	if (gcConfig?.enabled !== false) {
		const idleTimeoutMs = gcConfig.idleTimeoutMs ?? 300000;
		maxGcPerHour = gcConfig.maxGcPerHour ?? 4;
		gcManager = initGC({
			idleTimeoutMs,
			maxGcPerHour,
			onIdle(result) {
				logger.info(
					`[gc] idle GC ${result.triggered ? "triggered" : "skipped"} (${result.reason || "success"}, ${result.hourCalls} calls/hr)`,
				);
			},
		});
		gcTrace = () => gcFn(maxGcPerHour);
		const avail = isAvailable();
		logger.info(`[gc] V8 GC manager initialized ${avail ? "with" : "without"} --expose-gc`);
	}
} catch {
	logger.warn("[gc] Failed to initialize: graceful degradation");
}

// Initialize session
const { createSession, SessionStateManager, saveSession, handleShutdown, registerShutdownHandler } =
	await import("./src/session/index.js");
const { flush: flushLogger } = await import("./src/shared/logger.js");

// Initialize scheduler
const { ScheduleManager } = await import("./src/scheduler/index.js");
const schedulesDir = config.memory?.schedulesDir || "memory/schedules/";
const scheduleManager = await ScheduleManager.loadFromDisk(config.cwd + "/" + schedulesDir);

// Create or restore session
const providerName = Object.keys(config.providers)[0] || "openai";
const { state: initialState } = createSession({
	provider: providerName,
});
const sessionState = new SessionStateManager(initialState);

// Session-init: asynchronously clean up expired ephemeral memories (non-blocking)
queueMicrotask(() =>
	expireEphemeralMemories(config.cwd + "/" + config.memory.contextDir).catch(() => {}),
);

// Create checkpointer before tools so the orchestrator can access it
const { createCheckpointer, ensureCheckpointsDir } = await import("./src/session/checkpointer.js");
const checkpointsDir = config.memory?.checkpointsDir || "memory/checkpoints/";
await ensureCheckpointsDir(checkpointsDir);
const checkpointer = createCheckpointer(config);

// Provider config for TUI
const providerConfig = config.providers[providerName] || {};

const { agent, model, systemPrompt, mcpAdapter, contextLength } =
	await createDeepAgentsOrchestrator(checkpointer);

// Build a session config for the CURRENT thread. `sessionConfig` is captured
// once at startup with the initial thread_id, but `/new` replaces the session
// ID via `sessionState.createNewSession()`. Any consumer that needs the live
// thread must resolve the ID at call time (as `callProvider` does) rather than
// reuse the frozen `sessionConfig`, otherwise it queries the stale thread.
const currentSessionConfig = () => ({
	configurable: { thread_id: sessionState.getSessionId() },
});

// Bind a compaction callback to the session thread so the TUI can manually
// compress the context window on demand (via the `/compact` slash command).
const compactContext = (options) =>
	agent.compactContext(currentSessionConfig(), sessionState, options);

// Automatic compaction rewrites the checkpointer mid-run; keep the session's
// conversation in step so saved sessions and the TUI agree with the model.
agent.onCompacted?.((result) => {
	sessionState.loadConversation(result.messages.map(toConversationExchange));
});

// Expose the real LangChain message array from the checkpointer to the TUI so
// the context counter reflects the full message set the model sees (tool calls,
// tool messages, content blocks) rather than the lossy sessionState array.
// Degrades gracefully: returns null when the checkpointer is unavailable or
// `agent.getState` throws, so the TUI falls back to sessionState.getConversation().
const getContextMessages = async () => {
	try {
		const state = await agent.getState(currentSessionConfig());
		return state?.values?.messages ?? null;
	} catch (_err) {
		return null;
	}
};

const showToolResults = config.tui?.showToolResults;

async function callProvider(_name, _providerConfig, message, streamingCallback, signal) {
	const isNewThread = sessionState.getConversation().length === 0;

	const threadConfig = {
		...currentSessionConfig(),
		configurable: { thread_id: sessionState.getSessionId(), isNewThread },
	};

	const options = {
		maxTokens: providerConfig.maxTokens,
		signal,
		recursionLimit: config.agent?.recursionLimit,
	};

	let collectedContent = "";
	let collectedReasoning = "";
	let interrupted = false;
	const input = {
		messages: [new HumanMessage(message)],
	};

	for await (const [namespace, mode, payload] of await agent.stream(input, {
		...threadConfig,
		...options,
		streamMode: ["messages", "tools", "values"],
		subgraphs: true,
	})) {
		// With `subgraphs: true`, the orchestrator's own events carry an empty
		// namespace (`[]`) and each subagent run is nested under a `tools:<id>`
		// segment. Subagent events are emitted with a `subagent_` prefix and carry
		// the namespace so the TUI routes them to the SUBAGENTS store instead of
		// folding them into the orchestrator's assistant bubble.
		const isSubagent = isSubagentNamespace(namespace);

		// Detect a human-in-the-loop interrupt (e.g. the `clarify` tool calling
		// `interrupt()`). The interrupt surfaces as a `values` chunk carrying an
		// `__interrupt__` array. When one fires, surface the question (and
		// choices) to the TUI via the streaming callback and stop consuming the
		// stream — the agent is paused and must be resumed with a `Command`.
		if (surfaceInterrupt(mode, payload, streamingCallback)) {
			// The agent is paused; stop consuming the stream so the caller can
			// surface the question and resume with the user's answer.
			interrupted = true;
			break;
		}

		if (mode === "messages") {
			const [msg] = payload;
			const msgType = msg?._getType ? msg._getType() : msg?.type;
			const text = msg?.text ?? "";

			if (text) {
				// ToolMessage text is never folded into the message segment. It is
				// emitted as a distinct `tool` event so the TUI can render it as a
				// separate block toggled by toolCallCollapsed. When showToolResults
				// is false, tool text is skipped entirely.
				if (msgType === "tool") {
					if (showToolResults !== false && streamingCallback) {
						streamingCallback({
							type: isSubagent ? "subagent_tool" : "tool",
							text,
							name: msg?.name,
							namespace,
						});
					}

					continue;
				}

				if (!isSubagent) {
					collectedContent += text;
				}

				if (streamingCallback) {
					streamingCallback({
						type: isSubagent ? "subagent_message" : "message",
						text,
						namespace,
						// The content-block index is the stable identifier for a
						// streamed text block. It is normalized to `id` downstream
						// so message segments coalesce by block identity, mirroring
						// how reasoning segments target by `id`.
						...(msg?.content?.[0]?.index != null ? { index: msg.content[0].index } : {}),
					});
				}
			}

			// Capture reasoning content from additional_kwargs (Chat Completions API)
			const reasoningContent =
				msg?.additional_kwargs?.reasoning_content ?? msg?.additional_kwargs?.reasoning;
			if (reasoningContent) {
				if (!isSubagent) {
					collectedReasoning += reasoningContent;
				}
				if (streamingCallback) {
					streamingCallback({
						type: isSubagent ? "subagent_reasoning" : "reasoning",
						text: reasoningContent,
						namespace,
					});
				}
			}

			// Capture reasoning from content blocks (Responses API / block format)
			if (Array.isArray(msg?.content)) {
				for (const block of msg.content) {
					if (block?.type === "reasoning" && block.reasoning) {
						if (!isSubagent) {
							collectedReasoning += block.reasoning;
						}
						if (streamingCallback) {
							streamingCallback({
								type: isSubagent ? "subagent_reasoning" : "reasoning",
								text: block.reasoning,
								id: block.id,
								namespace,
							});
						}
					}
				}
			}
		} else if (mode === "tools" && streamingCallback) {
			// payload is StreamToolsOutput with event, name, etc.
			if (payload?.event === "on_tool_start") {
				streamingCallback({
					type: isSubagent ? "subagent_tool_start" : "on_tool_start",
					name: payload.name,
					data: { input: payload.input },
					namespace,
				});
			}
			if (payload?.event === "on_tool_end") {
				streamingCallback({
					type: isSubagent ? "subagent_tool_end" : "on_tool_end",
					name: payload.name,
					data: { output: payload.output },
					namespace,
				});
			}
		}
	}

	return {
		provider: providerName,
		content: collectedContent,
		reasoning: collectedReasoning || undefined,
		tokens: { input: 0, output: 0 },
		interrupted,
	};
}

/**
 * Resume a paused agent (e.g. after a `clarify` interrupt) with the user's
 * answer. Re-invokes the graph with `Command({ resume })` on the same thread,
 * which continues the paused node and streams the rest of the response.
 * @param {string} answer - The user's answer to the clarification question
 * @param {Function} [streamingCallback] - Callback for streamed chunks
 * @param {AbortSignal} [signal] - Abort signal
 * @returns {Promise<Object>} The resumed response
 */
async function resumeProvider(answer, streamingCallback, signal) {
	const threadConfig = {
		...currentSessionConfig(),
		configurable: { thread_id: sessionState.getSessionId() },
	};

	const options = {
		maxTokens: providerConfig.maxTokens,
		signal,
		recursionLimit: config.agent?.recursionLimit,
	};

	let collectedContent = "";
	let collectedReasoning = "";
	let interrupted = false;

	for await (const [namespace, mode, payload] of await agent.stream(
		new Command({ resume: answer }),
		{
			...threadConfig,
			...options,
			streamMode: ["messages", "tools", "values"],
			subgraphs: true,
		},
	)) {
		const isSubagent = isSubagentNamespace(namespace);

		// Handle a nested interrupt (e.g. a second clarify question).
		if (surfaceInterrupt(mode, payload, streamingCallback)) {
			interrupted = true;
			break;
		}

		if (mode === "messages") {
			const [msg] = payload;
			const msgType = msg?._getType ? msg._getType() : msg?.type;
			const text = msg?.text ?? "";

			if (text) {
				if (msgType === "tool") {
					if (showToolResults !== false && streamingCallback) {
						streamingCallback({
							type: isSubagent ? "subagent_tool" : "tool",
							text,
							name: msg?.name,
							namespace,
						});
					}
					continue;
				}

				if (!isSubagent) {
					collectedContent += text;
				}

				if (streamingCallback) {
					streamingCallback({
						type: isSubagent ? "subagent_message" : "message",
						text,
						namespace,
						// The content-block index is the stable identifier for a
						// streamed text block. It is normalized to `id` downstream
						// so message segments coalesce by block identity, mirroring
						// how reasoning segments target by `id`.
						...(msg?.content?.[0]?.index != null ? { index: msg.content[0].index } : {}),
					});
				}
			}

			const reasoningContent =
				msg?.additional_kwargs?.reasoning_content ?? msg?.additional_kwargs?.reasoning;
			if (reasoningContent) {
				if (!isSubagent) {
					collectedReasoning += reasoningContent;
				}
				if (streamingCallback) {
					streamingCallback({
						type: isSubagent ? "subagent_reasoning" : "reasoning",
						text: reasoningContent,
						namespace,
					});
				}
			}

			if (Array.isArray(msg?.content)) {
				for (const block of msg.content) {
					if (block?.type === "reasoning" && block.reasoning) {
						if (!isSubagent) {
							collectedReasoning += block.reasoning;
						}
						if (streamingCallback) {
							streamingCallback({
								type: isSubagent ? "subagent_reasoning" : "reasoning",
								text: block.reasoning,
								id: block.id,
								namespace,
							});
						}
					}
				}
			}
		} else if (mode === "tools" && streamingCallback) {
			if (payload?.event === "on_tool_start") {
				streamingCallback({
					type: isSubagent ? "subagent_tool_start" : "on_tool_start",
					name: payload.name,
					data: { input: payload.input },
					namespace,
				});
			}
			if (payload?.event === "on_tool_end") {
				streamingCallback({
					type: isSubagent ? "subagent_tool_end" : "on_tool_end",
					name: payload.name,
					data: { output: payload.output },
					namespace,
				});
			}
		}
	}

	return {
		provider: providerName,
		content: collectedContent,
		reasoning: collectedReasoning || undefined,
		tokens: { input: 0, output: 0 },
		interrupted,
	};
}

// Conversation handler
async function handleConversation(message, sessionId = "") {
	// Restore existing session if requested
	if (sessionId) {
		await resumeSession(sessionState, "memory/sessions/", sessionId, config.cwd);
	}

	const response = await callProvider(null, null, message, (chunk) => {
		if (chunk.type === "message" && chunk.text) {
			process.stdout.write(chunk.text);
		}
	});

	sessionState.addExchange({ role: "user", content: message });
	sessionState.addExchange({
		role: "assistant",
		content: response.content,
		reasoningContent: response.reasoning,
	});

	// Persist session after each exchange
	await saveSession(
		"memory/sessions/",
		sessionState.getConversation(),
		sessionState.getSessionId(),
	);

	return response;
}

// LLM provider dispatch (for TUI and external callers)
async function dispatchProvider(message, _sessionState = null, streamingCallback, signal) {
	return callProvider(null, null, message, streamingCallback, signal);
}

// Skill invocation is handled by the LLM via the deepagents skill system;
// there is no direct programmatic invocation path.

// Shared shutdown logic — called on signals and in non-interactive mode
const runShutdown = async () => {
	if (gcManager) {
		gcManager.stop();
	}

	if (mcpAdapter) {
		await mcpAdapter.close();
	}

	if (shutdownFn) {
		await shutdownFn();
	}
};

registerShutdownHandler(runShutdown);

// CLI mode detection (if run directly as node.js/index.js)
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
	// Handle --index-code flag
	if (parsed.indexCode) {
		const { createVectorStore } = await import("./src/vector/store.js");
		const { createEmbedder } = await import("./src/vector/embedder.js");
		const { reindex } = await import("./src/vector/indexer.js");

		const vectorConfig = config.vector || {};
		const embedder = createEmbedder({ model: vectorConfig.model || "local" });
		const projects = vectorConfig.projects || {};

		if (Object.keys(projects).length === 0) {
			logger.error("No vector projects configured in config.yaml under vector.projects.");
			process.exit(1);
		}

		for (const [name, proj] of Object.entries(projects)) {
			logger.info(`Indexing project "${name}"...`);
			const store = await createVectorStore(proj.dbPath);
			await store.init();
			const result = await reindex(store, embedder, {
				rootDir: proj.rootDir || ".",
				include: proj.include || ["src/**/*.js", "src/**/*.mjs", "src/**/*.cjs"],
				exclude: proj.exclude || ["node_modules/**", ".git/**", ".worktrees/**"],
				chunkSize: proj.chunkSize || 96,
				chunkOverlap: proj.chunkOverlap || 16,
				maxFileSize: proj.maxFileSize || vectorConfig.maxFileSize,
			});
			store.close();
			logger.info(
				`  indexed: ${result.indexed}, skipped: ${result.skipped}, errors: ${result.errors}`,
			);
		}

		process.exit(0);
	}

	const mode = parsed.mode === "interactive" ? "interactive" : "chat";
	const chatSessionId = parsed.session || "";
	let message = parsed.message;
	if (!message && chatSessionId) {
		message = "continue";
	}
	message = message || "Hello";

	if (mode === "chat") {
		try {
			await handleConversation(message, chatSessionId);
			process.stdout.write("\n");
		} catch (err) {
			logger.error(`Conversation failed: ${err.message}`);
			await flushLogger();
			process.exit(1);
		}

		// Graceful shutdown in non-interactive mode
		await runShutdown();
		await flushLogger();
		process.exit(0);
	} else {
		const { render } = await import("ink");
		const App = (await import("./src/tui/app.js")).default;
		const appInfo = {
			name: config.tui.name,
			version: pkg.version,
			model: getActiveModelName(config),
		};

		// GitHub Copilot authenticates via OAuth device flow. The user has no
		// CLI access in this environment, so surface the auth URL/code as a
		// system message in the chat on init. If a token is already present, or
		// the provider isn't Copilot, this is null and no prompt is emitted.
		// When the device-code request fails (e.g. no network), fall back to a
		// static message so the user knows to check connectivity.
		let authPrompt = null;
		const activeProviderName = getActiveProviderName(config);
		const activeProvider = config?.providers?.[activeProviderName] || {};
		if (activeProvider.type === "github-copilot") {
			const { getAuthPrompt, getToken } = await import("./src/provider/copilotAuth.js");
			const memoryDir = config.memory?.directory || "memory/";
			const deploymentType = activeProvider.enterpriseUrl
				? activeProvider.enterpriseUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "")
				: "github.com";
			const token = await getToken(memoryDir);
			if (!token) {
				authPrompt = await getAuthPrompt({ deploymentType, memoryDir });
				if (!authPrompt) {
					authPrompt = {
						error:
							"GitHub Copilot requires authentication, but the device-code request failed. " +
							"Check your network connectivity and restart.",
					};
				}
			}
		}

		render(
			React.createElement(App, {
				config,
				registry,
				sessionState,
				dispatchProvider,
				resumeProvider,
				scheduleManager,
				appInfo,
				authPrompt,
				onboarding: onboardingInstance,
				onSaveSession: () =>
					saveSession(
						"memory/sessions/",
						sessionState.getConversation(),
						sessionState.getSessionId(),
					).catch(() => {}),
				gcManager: gcManager ? gcManager.onActivity.bind(gcManager) : null,
				gcTrigger: gcTrace,
				checkpointer,
				compactContext,
				getContextMessages,
				model,
				systemPrompt,
				contextLength,
			}),
			{
				// Restore terminal with newline when app exits
				onExit: async () => {
					const { handleShutdown } = await import("./src/session/index.js");
					if (handleShutdown)
						await handleShutdown({
							onShutdown: async () => {
								if (gcManager) gcManager.stop();
								if (shutdownFn) await shutdownFn();
							},
						});
					await flushLogger();
					process.stdout.write("\n");
					process.exit(0);
				},
			},
		);
	}
}

// Export for testing and TUI integration
export {
	config,
	sessionState,
	registry,
	tracer,
	dispatchProvider,
	resumeProvider,
	handleConversation,
	handleShutdown,
	scheduleManager,
	setConfigValue,
	loadContext,
	readMemoryFile,
};
