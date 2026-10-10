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
import { loadSession } from "./src/session/loader.js";

import React from "react";
import { HumanMessage } from "@langchain/core/messages";

const { setConfigValue } = await import("./src/config/loader.js");
const { createDeepAgentsOrchestrator } = await import("./src/agent/deepAgents.js");
const { getActiveModelName, getActiveProviderName } = await import("./src/provider/index.js");
const { logger } = await import("./src/shared/logger.js");

const { default: pkg } = await import(new URL("./package.json", import.meta.url).href, {
	with: { type: "json" },
});

const { ensureSessionsDir } = await import("./src/session/index.js");
const { ensureToolsDir, ensureScreenshotsDir } = await import("./src/memory/index.js");

// Ensure sessions directory exists before any subsystem initialization
await ensureSessionsDir(config.memory.sessionsDir);

// Ensure memory/tools directory exists before any subsystem initialization
await ensureToolsDir(config.memory.toolsDir);

// Ensure memory/screenshots directory exists before any subsystem initialization
await ensureScreenshotsDir(config.memory.screenshotsDir);

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

const { agent, model, systemPrompt, mcpAdapter } = await createDeepAgentsOrchestrator(checkpointer);

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

// Capture config value before callProvider shadows the name
const showToolResults = config.tui?.showToolResults;

async function callProvider(_name, _providerConfig, message, streamingCallback, signal) {
	const isNewThread = sessionState.getConversation().length === 0;

	const config = {
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
	const input = {
		messages: [new HumanMessage(message)],
	};

	for await (const [_namespace, mode, payload] of await agent.stream(input, {
		...config,
		...options,
		streamMode: ["messages", "tools"],
		subgraphs: true,
	})) {
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
						streamingCallback({ type: "tool", text, name: msg?.name });
					}

					continue;
				}

				collectedContent += text;

				if (streamingCallback) {
					streamingCallback({ type: "message", text });
				}
			}

			// Capture reasoning content from additional_kwargs (Chat Completions API)
			const reasoningContent =
				msg?.additional_kwargs?.reasoning_content ?? msg?.additional_kwargs?.reasoning;
			if (reasoningContent) {
				collectedReasoning += reasoningContent;
				if (streamingCallback) {
					streamingCallback({ type: "reasoning", text: reasoningContent });
				}
			}

			// Capture reasoning from content blocks (Responses API / block format)
			if (Array.isArray(msg?.content)) {
				for (const block of msg.content) {
					if (block?.type === "reasoning" && block.reasoning) {
						collectedReasoning += block.reasoning;
						if (streamingCallback) {
							streamingCallback({ type: "reasoning", text: block.reasoning });
						}
					}
				}
			}
		} else if (mode === "tools" && streamingCallback) {
			// payload is StreamToolsOutput with event, name, etc.
			if (payload?.event === "on_tool_start") {
				streamingCallback({
					type: "on_tool_start",
					name: payload.name,
					data: { input: payload.input },
				});
			}
			if (payload?.event === "on_tool_end") {
				streamingCallback({
					type: "on_tool_end",
					name: payload.name,
					data: { output: payload.output },
				});
			}
		}
	}

	return {
		provider: providerName,
		content: collectedContent,
		reasoning: collectedReasoning || undefined,
		tokens: { input: 0, output: 0 },
	};
}

// Conversation handler
async function handleConversation(message, sessionId = "") {
	// Restore existing session if requested
	if (sessionId) {
		const { conversation } = await loadSession(config.cwd + "/" + "memory/sessions/", 20);
		if (conversation && conversation.length > 0) {
			conversation.forEach((msg) => sessionState.addExchange(msg));
		}
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
				maxFileSize: proj.maxFileSize || 524288,
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
		} catch (_) {
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
	handleConversation,
	handleShutdown,
	scheduleManager,
	setConfigValue,
	loadContext,
	readMemoryFile,
};
