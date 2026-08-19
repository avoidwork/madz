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

const { setConfigValue } = await import("./src/config/loader.js");
const { createDeepAgentsOrchestrator } = await import("./src/agent/deepAgents.js");
const { logger } = await import("./src/shared/logger.js");

const { default: pkg } = await import(new URL("./package.json", import.meta.url).href, {
	with: { type: "json" },
});

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

// Ensure sessions directory exists before any subsystem initialization
const { ensureSessionsDir } = await import("./src/session/index.js");
await ensureSessionsDir(config.cwd + "/" + "memory/sessions/");

// Initialize contextual onboarding if profile is missing (with graceful degradation)
let onboardingInstance = null;
try {
	const { hasProfile, ATTRIBUTES } = await import("./src/memory/profile.js");
	if (!hasProfile()) {
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
const { SkillRegistry, resolvePermissions, ensureSkillsDir } =
	await import("./src/skills/index.js");
const registry = new SkillRegistry();
await ensureSkillsDir(config.cwd + "/" + "skills/");
await registry.discover();

// Initialize memory system
const { readMemoryFile, loadContext } = await import("./src/memory/index.js");

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
try {
	const { expireEphemeralMemories } = await import("./src/memory/expireEphemeral.js");
	queueMicrotask(() =>
		expireEphemeralMemories(config.cwd + "/" + config.memory.contextDir).catch(() => {}),
	);
} catch {
	// Graceful degradation: session starts even if cleanup import fails
}

// Create checkpointer before tools so compactContext can access it
const { createCheckpointer } = await import("./src/session/checkpointer.js");
const checkpointer = createCheckpointer(config.persistence);

// Provider config for TUI
const providerConfig = config.providers[providerName] || {};

const agent = await createDeepAgentsOrchestrator(checkpointer);

const sessionConfig = { configurable: { thread_id: sessionState.getThreadId() } };

async function callProvider(_name, _providerConfig, message, streamingCallback, signal) {
	const isNewThread = sessionState.getConversation().length === 0;
	const threadId = sessionState.getThreadId();

	const config = {
		...sessionConfig,
		configurable: { thread_id: threadId, isNewThread },
	};

	const options = {
		maxTokens: providerConfig.maxTokens,
		signal,
		recursionLimit: config.agent?.recursionLimit,
	};

	let collectedContent = "";
	const input = {
		messages: [{ role: "user", content: message }],
	};

	for await (const [_namespace, chunk] of await agent.stream(input, {
		...config,
		...options,
		streamMode: "messages",
		subgraphs: true,
	})) {
		const [message] = chunk;
		const text = message?.text ?? "";

		if (text) {
			collectedContent += text;
			if (streamingCallback) {
				streamingCallback({ type: "message", text });
			}
		}
	}

	return { provider: providerName, content: collectedContent, tokens: { input: 0, output: 0 } };
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
	sessionState.addExchange({ role: "assistant", content: response.content });

	// Persist session after each exchange
	await saveSession("memory/sessions/", sessionState.getConversation(), sessionState.getThreadId());

	return response;
}

// LLM provider dispatch (for TUI and external callers)
async function dispatchProvider(message, _sessionState = null, streamingCallback, signal) {
	return callProvider(null, null, message, streamingCallback, signal);
}

// Skill invocation through sandbox
async function invokeSkill(skillName, input = {}) {
	const skill = registry.get(skillName);
	if (!skill) {
		throw new Error(`Unknown skill: ${skillName}`);
	}

	if (skill.disabled) {
		throw new Error(`Skill "${skillName}" is disabled`);
	}

	const permissions = resolvePermissions(skill.metadata);

	// Placeholder — actual sandbox execution
	return {
		skill: skillName,
		input,
		output: `[Skill ${skillName} executed with permissions: ${permissions.join(", ")}]`,
		exitCode: 0,
	};
}

// Shared shutdown logic — called on signals and in non-interactive mode
const runShutdown = async () => {
	await saveSession("memory/sessions/", sessionState.getConversation(), sessionState.getThreadId());

	if (gcManager) {
		gcManager.stop();
	}

	if (shutdownFn) {
		await shutdownFn();
	}
};

registerShutdownHandler(runShutdown);

// CLI mode detection (if run directly as node.js/index.js)
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
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
		const appInfo = { name: config.tui.name, version: pkg.version };
		render(
			React.createElement(App, {
				config,
				registry,
				sessionState,
				dispatchProvider,
				scheduleManager,
				invokeSkill,
				appInfo,
				onboarding: onboardingInstance,
				onSaveSession: () =>
					saveSession(
						"memory/sessions/",
						sessionState.getConversation(),
						sessionState.getThreadId(),
					).catch(() => {}),
				gcManager: gcManager ? gcManager.onActivity.bind(gcManager) : null,
				gcTrigger: gcTrace,
				checkpointer,
			}),
			{
				// Restore terminal with newline when app exits
				onExit: async () => {
					const { handleShutdown } = await import("./src/session/index.js");
					const saveSessionArgs = [
						"memory/sessions/",
						sessionState.getConversation(),
						sessionState.getThreadId(),
					];
					if (handleShutdown)
						await handleShutdown({
							saveSession,
							saveSessionArgs,
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
	invokeSkill,
	handleShutdown,
	scheduleManager,
	setConfigValue,
	loadContext,
	readMemoryFile,
};
