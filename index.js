#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
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
import { surfaceInterrupt } from "./src/stream/interrupt.js";
import { isSubagentNamespace } from "./src/stream/namespace.js";

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

	// Ensure storage directories exist before any subsystem initialization
	await ensureSessionsDir(config.memory.sessionsDir);
	await ensureToolsDir(config.memory.toolsDir);
	await ensureScreenshotsDir(config.memory.screenshotsDir);
	await ensureContextDir(config.memory.contextDir);

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
 * Consume an agent stream, forwarding events to `streamingCallback` and
 * collecting the orchestrator's own text and reasoning.
 * @param {AsyncIterable} stream - The agent stream (subgraphs mode)
 * @param {Function} [streamingCallback] - Callback for streamed chunks
 * @returns {Promise<{content: string, reasoning: string, interrupted: boolean}>}
 */
async function consumeStream(stream, streamingCallback) {
	let content = "";
	let reasoning = "";
	let interrupted = false;

	for await (const [namespace, mode, payload] of stream) {
		// Subagent runs are nested under a `tools:<id>` namespace segment. Their
		// events get a `subagent_` prefix so the TUI routes them separately.
		const isSubagent = isSubagentNamespace(namespace);

		// A human-in-the-loop interrupt (e.g. `clarify`) pauses the agent; stop
		// consuming so the caller can ask the question and resume.
		if (surfaceInterrupt(mode, payload, streamingCallback)) {
			interrupted = true;
			break;
		}

		if (mode === "messages") {
			const [msg] = payload;
			const msgType = msg?._getType ? msg._getType() : msg?.type;
			const text = msg?.text ?? "";

			if (text) {
				// ToolMessage text is emitted as a distinct `tool` event, never
				// folded into the message segment.
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
					content += text;
				}

				if (streamingCallback) {
					streamingCallback({
						type: isSubagent ? "subagent_message" : "message",
						text,
						namespace,
						// The content-block index is the stable identifier for a streamed
						// text block; it is normalized to `id` downstream.
						...(msg?.content?.[0]?.index != null ? { index: msg.content[0].index } : {}),
					});
				}
			}

			// Reasoning from additional_kwargs (Chat Completions API)
			const reasoningContent =
				msg?.additional_kwargs?.reasoning_content ?? msg?.additional_kwargs?.reasoning;
			if (reasoningContent) {
				if (!isSubagent) {
					reasoning += reasoningContent;
				}
				if (streamingCallback) {
					streamingCallback({
						type: isSubagent ? "subagent_reasoning" : "reasoning",
						text: reasoningContent,
						namespace,
					});
				}
			} else if (Array.isArray(msg?.content)) {
				// Reasoning from content blocks (Responses API). Skipped when
				// additional_kwargs already supplied it, to avoid double-counting.
				for (const block of msg.content) {
					if (block?.type === "reasoning" && block.reasoning) {
						if (!isSubagent) {
							reasoning += block.reasoning;
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

	return { content, reasoning, interrupted };
}

/**
 * Stream an agent input on the current session thread.
 * @param {Object|Command} input - Messages input or a resume Command
 * @param {Object} threadExtras - Extra `configurable` fields
 * @param {Function} [streamingCallback] - Callback for streamed chunks
 * @param {AbortSignal} [signal] - Abort signal
 */
async function runAgent(input, threadExtras, streamingCallback, signal) {
	const stream = await agent.stream(input, {
		configurable: { thread_id: sessionState.getSessionId(), ...threadExtras },
		maxTokens: providerConfig.maxTokens,
		signal,
		recursionLimit: config.agent?.recursionLimit,
		streamMode: ["messages", "tools", "values"],
		subgraphs: true,
	});
	const { content, reasoning, interrupted } = await consumeStream(stream, streamingCallback);
	return {
		provider: providerName,
		content,
		reasoning: reasoning || undefined,
		tokens: { input: 0, output: 0 },
		interrupted,
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
 * Ask a clarification question on the terminal.
 * @param {{question: string, choices?: string[]}} clarify - The pending question
 * @returns {Promise<string|null>} The answer, or null when no terminal is available
 */
async function askOnTerminal(clarify) {
	if (!process.stdin.isTTY) return null;
	const rl = createInterface({ input: process.stdin, output: process.stderr });
	try {
		const choices = clarify.choices || [];
		let prompt = `\n${clarify.question}\n`;
		choices.forEach((c, i) => {
			prompt += `  ${i + 1}. ${c}\n`;
		});
		prompt += "> ";
		const raw = (await rl.question(prompt)).trim();
		const index = Number(raw);
		return Number.isInteger(index) && index >= 1 && index <= choices.length
			? choices[index - 1]
			: raw;
	} finally {
		rl.close();
	}
}

/**
 * Run one conversation turn (non-interactive). Handles clarify interrupts by
 * prompting on the terminal when one is available.
 * @param {string} message - User message
 * @param {string} [sessionId] - Session to restore first
 */
export async function handleConversation(message, sessionId = "") {
	await bootstrap();

	if (sessionId) {
		await resumeSession(sessionState, sessionsPath(), sessionId, config.cwd);
	}

	let pending = null;
	const onChunk = (chunk) => {
		if (chunk.type === "clarify") {
			pending = chunk;
		} else if (chunk.type === "message" && chunk.text) {
			process.stdout.write(chunk.text);
		}
	};

	let response = await callProvider(message, onChunk);
	let content = response.content;
	let reasoning = response.reasoning;

	while (response.interrupted) {
		const answer = pending ? await askOnTerminal(pending) : null;
		if (answer == null) {
			logger.warn(
				"The agent asked a clarifying question but no terminal is available to answer it.",
			);
			break;
		}
		pending = null;
		response = await resumeProvider(answer, onChunk);
		content += response.content;
		reasoning = (reasoning || "") + (response.reasoning || "") || undefined;
	}

	sessionState.addExchange({ role: "user", content: message });
	sessionState.addExchange({
		role: "assistant",
		content,
		reasoningContent: reasoning,
	});

	// Persist session after each exchange
	await saveSession(sessionsPath(), sessionState.getConversation(), sessionState.getSessionId());

	return { ...response, content, reasoning };
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
		const store = await createVectorStore(proj.dbPath);
		try {
			await store.init();
			const result = await reindex(store, embedder, {
				rootDir: proj.rootDir || ".",
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
