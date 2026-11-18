#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import React from "react";
import yargs from "yargs";
import { loadConfig, setConfigValue } from "./src/config/loader.js";
import {
	createSession,
	ensureSessionsDir,
	handleShutdown,
	registerShutdownHandler,
	SessionStateManager,
	saveSession,
} from "./src/session/index.js";
import { resumeSession } from "./src/session/resume.js";
import { logger, flush as flushLogger } from "./src/shared/logger.js";
import { consumeStream } from "./src/stream/consume.js";
import { createSegmentLoopDetector } from "./src/stream/loopDetector.js";

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

/**
 * Parse CLI arguments. Positional words are joined into the message, so both
 * `madz "hello there"` and `madz hello there` work.
 * @param {string[]} argv - Arguments (without node and script path)
 * @returns {{mode: string|undefined, session: string|undefined, indexCode: boolean, message: string|undefined}}
 */
function parseArgs(argv) {
	const parsed = yargs(argv)
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
		.usage("$0 [message..]")
		.parseSync();

	const message = parsed._.map(String).join(" ").trim();
	return {
		mode: parsed.mode,
		session: parsed.session,
		indexCode: Boolean(parsed.indexCode),
		message: message || undefined,
	};
}

/**
 * Whether this file is the process entry point. Resolves symlinks so that
 * npm bin links and relative invocations are detected correctly.
 * @returns {boolean}
 */
function isMainModule() {
	if (!process.argv[1]) return false;
	try {
		return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
	} catch {
		return process.argv[1] === fileURLToPath(import.meta.url);
	}
}

// ---------------------------------------------------------------------------
// Module state (populated by bootstrap(); exported as live bindings)
// ---------------------------------------------------------------------------

let config;
let sessionState;
let registry;
let tracer = null;
let scheduleManager;
let loadContext;
let readMemoryFile;

let agent;
let model;
let systemPrompt;
let mcpAdapter;
let contextLength;
let checkpointer;
let providerName;
let providerConfig = {};
let showToolResults;
let onboardingInstance = null;
let gcManager = null;
let gcTrace = null;
let shutdownFn = null;
let compactContext;
let getContextMessages;

let bootstrapPromise = null;

/** Resolve a (possibly relative) config path against the configured cwd. */
function fromCwd(path) {
	return resolve(config?.cwd || process.cwd(), path);
}

/** The session-storage directory, used consistently everywhere. */
function sessionsPath() {
	return config.memory?.sessionsDir || "memory/sessions/";
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Initialize all subsystems. Idempotent: repeated calls share one run.
 * Nothing in this module runs at import time except definitions.
 * @returns {Promise<void>}
 */
export function bootstrap() {
	if (!bootstrapPromise) {
		bootstrapPromise = doBootstrap();
	}
	return bootstrapPromise;
}

async function doBootstrap() {
	config = loadConfig();

	const { createDeepAgentsOrchestrator, toConversationExchange } =
		await import("./src/agent/deepAgents.js");
	const { ensureToolsDir, ensureScreenshotsDir, ensureContextDir, expireEphemeralMemories } =
		await import("./src/memory/index.js");
	const { ensureDownloadsDir } = await import("./src/downloads/index.js");

	// Ensure storage directories exist before any subsystem initialization.
	// These are independent, so create them in parallel.
	await Promise.all([
		ensureSessionsDir(config.memory.sessionsDir),
		ensureToolsDir(config.memory.toolsDir),
		ensureScreenshotsDir(config.memory.screenshotsDir),
		ensureContextDir(config.memory.contextDir),
		ensureDownloadsDir(config.api.downloadsDir),
	]);

	const schedulesDir = fromCwd(config.memory?.schedulesDir || "memory/schedules/");

	// Write .env.cron before any subsystem that may use cron
	try {
		const { writeEnvCron } = await import("./src/scheduler/cron.js");
		await writeEnvCron(config.cwd || process.cwd());
	} catch (err) {
		logger.warn(`[cron] Failed to write .env.cron: ${err.message}`);
	}

	// Sync crontab from persisted job definitions
	if (config.schedules?.syncOnInit !== false) {
		try {
			const { Cron } = await import("./src/scheduler/cron.js");
			if (config.schedules?.logPath) {
				Cron.setLogPath(config.schedules.logPath);
			}
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

	// Contextual onboarding if the profile is missing (graceful degradation)
	try {
		const { hasProfile, ATTRIBUTES } = await import("./src/memory/profile.js");
		if (!(await hasProfile())) {
			const { createOnboarding } = await import("./src/session/onboarding.js");
			onboardingInstance = createOnboarding(ATTRIBUTES, { onSave: () => {} });
		}
	} catch {
		// Continue without onboarding if profile detection fails
	}

	// Telemetry
	if (config.telemetry?.enabled) {
		const { initTelemetry, getTracer, shutdownTelemetry } =
			await import("./src/telemetry/provider.js");
		await initTelemetry(config.telemetry);
		tracer = getTracer();
		shutdownFn = shutdownTelemetry;
	}

	// Skill registry
	const { SkillRegistry, ensureSkillsDir } = await import("./src/skills/index.js");
	registry = new SkillRegistry();
	await ensureSkillsDir(fromCwd("skills/"));
	await registry.discover();

	// Memory system
	({ readMemoryFile, loadContext } = await import("./src/memory/index.js"));

	// GC manager (if enabled)
	try {
		const { initGC, gc: gcFn, isAvailable } = await import("./src/memory/gc.js");
		const gcConfig = config.memory?.gc;
		if (gcConfig?.enabled !== false) {
			const idleTimeoutMs = gcConfig?.idleTimeoutMs ?? 300000;
			const maxGcPerHour = gcConfig?.maxGcPerHour ?? 4;
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
			logger.info(
				`[gc] V8 GC manager initialized ${isAvailable() ? "with" : "without"} --expose-gc`,
			);
		}
	} catch {
		logger.warn("[gc] Failed to initialize: graceful degradation");
	}

	// Scheduler
	const { ScheduleManager } = await import("./src/scheduler/index.js");
	scheduleManager = await ScheduleManager.loadFromDisk(schedulesDir);

	// Session. Use the same provider-selection rule as the TUI and orchestrator.
	const { getActiveProviderName } = await import("./src/provider/index.js");
	providerName =
		getActiveProviderName(config) || Object.keys(config.providers || {})[0] || "openai";
	providerConfig = config.providers?.[providerName] || {};
	const { state: initialState } = createSession({ provider: providerName });
	sessionState = new SessionStateManager(initialState);

	// Clean up expired ephemeral memories (non-blocking)
	queueMicrotask(() => expireEphemeralMemories(fromCwd(config.memory.contextDir)).catch(() => {}));

	// Checkpointer must exist before the orchestrator
	const { createCheckpointer, ensureCheckpointsDir } =
		await import("./src/session/checkpointer.js");
	await ensureCheckpointsDir(config.memory?.checkpointsDir || "memory/checkpoints/");
	checkpointer = createCheckpointer(config);

	({ agent, model, systemPrompt, mcpAdapter, contextLength } =
		await createDeepAgentsOrchestrator(checkpointer));

	// `/new` replaces the session ID, so always resolve the thread at call time.
	const currentSessionConfig = () => ({
		configurable: { thread_id: sessionState.getSessionId() },
	});

	// Manual context compaction (the `/compact` slash command)
	compactContext = (options) => agent.compactContext(currentSessionConfig(), sessionState, options);

	// Automatic compaction rewrites the checkpointer mid-run; keep the session's
	// conversation in step so saved sessions and the TUI agree with the model.
	agent.onCompacted?.((result) => {
		sessionState.loadConversation(result.messages.map(toConversationExchange));
	});

	// Real LangChain message array from the checkpointer for the context counter.
	// Returns null on failure so the TUI falls back to sessionState.
	getContextMessages = async () => {
		try {
			const state = await agent.getState(currentSessionConfig());
			return state?.values?.messages ?? null;
		} catch (_err) {
			return null;
		}
	};

	showToolResults = config.tui?.showToolResults;

	registerShutdownHandler(runShutdown);
}

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

/**
 * Stream an agent input on the current session thread.
 * @param {Object|Command} input - Messages input or a resume Command
 * @param {Object} threadExtras - Extra `configurable` fields
 * @param {Function} [streamingCallback] - Callback for streamed chunks
 * @param {AbortSignal} [signal] - Abort signal
 */
async function runAgent(input, threadExtras, streamingCallback, signal) {
	const loopConfig = config.loopDetection ?? {};
	const loopDetector =
		loopConfig.enabled === false
			? undefined
			: createSegmentLoopDetector({
					windowSize: loopConfig.windowSize,
					threshold: loopConfig.threshold,
					ttlMs: loopConfig.ttlMs,
				});
	const stream = await agent.stream(input, {
		configurable: { thread_id: sessionState.getSessionId(), ...threadExtras },
		maxTokens: providerConfig.maxTokens,
		signal,
		recursionLimit: config.agent?.recursionLimit,
		streamMode: ["messages", "tools", "values"],
		subgraphs: true,
	});
	// A detected loop abandons the stream; the caller (the TUI) sends the silent
	// nudge, the same way it sends the reasoning-only "Continue".
	const { content, reasoning, interrupted, lastEventType, loopDetected } = await consumeStream(
		stream,
		streamingCallback,
		{
			showToolResults,
			loopDetector,
		},
	);
	return {
		provider: providerName,
		content,
		reasoning: reasoning || undefined,
		tokens: { input: 0, output: 0 },
		interrupted,
		lastEventType,
		loopDetected,
	};
}

/**
 * Send a message to the agent.
 * @param {string} message - User message
 * @param {Function} [streamingCallback] - Callback for streamed chunks
 * @param {AbortSignal} [signal] - Abort signal
 */
function callProvider(message, streamingCallback, signal) {
	const isNewThread = sessionState.getConversation().length === 0;
	return runAgent(
		{ messages: [new HumanMessage(message)] },
		{ isNewThread },
		streamingCallback,
		signal,
	);
}

/**
 * Resume a paused agent (e.g. after a `clarify` interrupt) with the user's
 * answer, continuing on the same thread.
 * @param {string} answer - The user's answer to the clarification question
 * @param {Function} [streamingCallback] - Callback for streamed chunks
 * @param {AbortSignal} [signal] - Abort signal
 * @returns {Promise<Object>} The resumed response
 */
export function resumeProvider(answer, streamingCallback, signal) {
	return runAgent(new Command({ resume: answer }), {}, streamingCallback, signal);
}

/** LLM provider dispatch (for TUI and external callers). */
export function dispatchProvider(message, _sessionState = null, streamingCallback, signal) {
	return callProvider(message, streamingCallback, signal);
}

/**
 * Run one conversation turn (non-interactive). If the agent pauses to ask a
 * clarifying question, the exchange is saved and an error carrying the question
 * is thrown, since a one-shot run has no way to answer it.
 * @param {string} message - User message
 * @param {string} [sessionId] - Session to restore first
 * @returns {Promise<Object>} The agent response
 */
export async function handleConversation(message, sessionId = "") {
	await bootstrap();

	if (sessionId) {
		await resumeSession(sessionState, sessionsPath(), sessionId, config.cwd);
	}

	let question = null;
	const response = await callProvider(message, (chunk) => {
		if (chunk.type === "clarify") {
			question = chunk.question;
		} else if (chunk.type === "message" && chunk.text) {
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
	await saveSession(sessionsPath(), sessionState.getConversation(), sessionState.getSessionId());

	if (response.interrupted) {
		throw new Error(
			`The agent needs input: ${question ?? "(no question provided)"} Re-run with --mode interactive.`,
		);
	}

	return response;
}

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------

let shutdownPromise = null;

/** Shared, idempotent shutdown used by signals, chat mode and the TUI. */
async function runShutdown() {
	if (!shutdownPromise) {
		shutdownPromise = (async () => {
			await handleShutdown({
				onShutdown: async () => {
					if (gcManager) gcManager.stop();
					if (mcpAdapter) await mcpAdapter.close();
					if (shutdownFn) await shutdownFn();
				},
			});
		})();
	}
	return shutdownPromise;
}

// ---------------------------------------------------------------------------
// CLI modes
// ---------------------------------------------------------------------------

/** Index project source code for vector search, then return. */
async function runIndexCode() {
	const { createVectorStore } = await import("./src/vector/store.js");
	const { createEmbedder } = await import("./src/vector/embedder.js");
	const { reindex } = await import("./src/vector/indexer.js");

	const vectorConfig = config.vector || {};
	const embedder = createEmbedder({ model: vectorConfig.model || "local" });
	const projects = vectorConfig.projects || {};

	if (Object.keys(projects).length === 0) {
		logger.error("No vector projects configured in config.yaml under vector.projects.");
		return 1;
	}

	for (const [name, proj] of Object.entries(projects)) {
		logger.info(`Indexing project "${name}"...`);
		const store = await createVectorStore(fromCwd(proj.dbPath));
		try {
			await store.init();
			const result = await reindex(store, embedder, {
				rootDir: fromCwd(proj.rootDir || "."),
				include: proj.include || ["src/**/*.js", "src/**/*.mjs", "src/**/*.cjs"],
				exclude: proj.exclude || ["node_modules/**", ".git/**", ".worktrees/**"],
				chunkSize: proj.chunkSize || 96,
				chunkOverlap: proj.chunkOverlap || 16,
				maxFileSize: proj.maxFileSize || vectorConfig.maxFileSize,
			});
			logger.info(
				`  indexed: ${result.indexed}, skipped: ${result.skipped}, errors: ${result.errors}`,
			);
		} finally {
			store.close();
		}
	}
	return 0;
}

/**
 * GitHub Copilot authenticates via an OAuth device flow; surface the auth
 * prompt as a system message in the TUI when a token is missing.
 * @returns {Promise<Object|null>}
 */
async function getCopilotAuthPrompt() {
	const { getActiveProviderName } = await import("./src/provider/index.js");
	const activeProvider = config?.providers?.[getActiveProviderName(config)] || {};
	if (activeProvider.type !== "github-copilot") return null;

	const { getAuthPrompt, getToken } = await import("./src/provider/copilotAuth.js");
	const memoryDir = config.memory?.directory || "memory/";
	const deploymentType = activeProvider.enterpriseUrl
		? activeProvider.enterpriseUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "")
		: "github.com";
	if (await getToken(memoryDir)) return null;

	return (
		(await getAuthPrompt({ deploymentType, memoryDir })) || {
			error:
				"GitHub Copilot requires authentication, but the device-code request failed. " +
				"Check your network connectivity and restart.",
		}
	);
}

async function runInteractive() {
	const { render } = await import("ink");
	const App = (await import("./src/tui/app.js")).default;
	const { getActiveModelName } = await import("./src/provider/index.js");
	const { default: pkg } = await import(new URL("./package.json", import.meta.url).href, {
		with: { type: "json" },
	});

	const appInfo = {
		name: config.tui.name,
		version: pkg.version,
		model: getActiveModelName(config),
	};
	const authPrompt = await getCopilotAuthPrompt();

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
					sessionsPath(),
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
				await runShutdown();
				await flushLogger();
				process.stdout.write("\n");
				process.exit(0);
			},
		},
	);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));

	if (args.indexCode) {
		// Indexing only needs the config, not the full agent bootstrap.
		config = loadConfig();
		let code = 1;
		try {
			code = await runIndexCode();
		} catch (err) {
			logger.error(`Indexing failed: ${err.message}`);
		}
		await flushLogger();
		process.exit(code);
	}

	await bootstrap();

	const mode = args.mode === "interactive" ? "interactive" : "chat";
	const chatSessionId = args.session || "";
	const message = args.message || (chatSessionId ? "continue" : "Hello");

	if (mode === "chat") {
		let exitCode = 0;
		try {
			await handleConversation(message, chatSessionId);
			process.stdout.write("\n");
		} catch (err) {
			logger.error(`Conversation failed: ${err.message}`);
			exitCode = 1;
		}
		await runShutdown();
		await flushLogger();
		process.exit(exitCode);
	} else {
		await runInteractive();
	}
}

if (isMainModule()) {
	main().catch(async (err) => {
		logger.error(`Fatal error: ${err?.stack || err}`);
		try {
			await runShutdown();
			await flushLogger();
		} finally {
			process.exit(1);
		}
	});
}

// Export for testing and TUI integration. Values are populated by bootstrap().
export {
	config,
	sessionState,
	registry,
	tracer,
	handleShutdown,
	scheduleManager,
	setConfigValue,
	loadContext,
	readMemoryFile,
};
