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
const { createChatModel } = await import("./src/provider/openai.js");
const { createDeepAgentsOrchestrator } = await import("./src/agent/deepAgents.js");
const { buildToolConfig } = await import("./src/tools/index.js");
const { logger } = await import("./src/logger.js");

const { default: pkg } = await import(new URL("package.json", import.meta.url).href, {
	with: { type: "json" },
});

// Initialize subsystems
// Sync crontab from persisted job definitions (runs before any subsystem)
if (config.schedules.syncOnInit !== false) {
	try {
		const { Cron } = await import("./src/scheduler/cron.js");
		const schedulesDir = config.memory?.schedulesDir || "memory/schedules/";
		const result = await Cron.sync(schedulesDir);
		if (result.error) {
			logger.warn(`[scheduler] Crontab sync failed: ${result.error}`);
		} else {
			logger.info(
				`[scheduler] Crontab sync complete: +${result.added} added, -${result.removed} removed, ~${result.updated} updated, =${result.skipped} skipped`,
			);
		}

		// Ensure the daily reflection job exists in crontab and persisted (covers upgrading users
		// who have no reflection-daily.json on disk). Cron.add() is idempotent.
		const cwd = config.cwd;
		const jobResult = Cron.add({
			name: "reflection-daily",
			cron: "0 2 * * *",
			command: `cd ${cwd} && node index.js --chat "/reflection"`,
		});
		if (jobResult.added || !jobResult.error) {
			try {
				const { existsSync, mkdirSync, writeFileSync } = await import("node:fs");
				const { join } = await import("node:path");
				const schedulesDir = config.memory?.schedulesDir || "memory/schedules/";
				const filePath = join(schedulesDir, "reflection-daily.json");
				if (!existsSync(filePath)) {
					mkdirSync(schedulesDir, { recursive: true });
					const jobData = {
						name: "reflection-daily",
						cron: "0 2 * * *",
						command: `cd ${cwd} && node index.js --chat "/reflection"`,
						enabled: true,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					};
					writeFileSync(filePath, JSON.stringify(jobData, null, 2));
				}
			} catch (err) {
				logger.warn(`[scheduler] Failed to persist reflection-daily job file: ${err.message}`);
			}
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
		const { setupAutoSchedule } = await import("./src/scheduler/autoSchedule.js");
		const autoSchedule = setupAutoSchedule();
		onboardingInstance = createOnboarding(ATTRIBUTES, { onSave: autoSchedule });
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
registry.discover();

// Initialize memory system
const { writeMemoryFile, readMemoryFile, loadContext } = await import("./src/memory/index.js");

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
const { flush: flushLogger } = await import("./src/logger.js");

// Initialize scheduler
const { ScheduleManager } = await import("./src/scheduler/index.js");
const scheduleManager = new ScheduleManager();

// Create or restore session
const providerName = Object.keys(config.providers)[0] || "openai";
const { sessionId, state: initialState } = createSession({
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

const agent = createDeepAgentsOrchestrator(checkpointer);

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
				streamingCallback({ type: "text", text });
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

	const response = await callProvider(null, null, message);

	sessionState.addExchange({ role: "user", content: message });
	sessionState.addExchange({ role: "assistant", content: response.content });

	// Persist to memory
	writeMemoryFile(
		"memory/sessions/",
		`Conversation ${new Date().toISOString()}`,
		{
			provider: response.provider,
			sessionId,
		},
		JSON.stringify(sessionState.getConversation(), null, 2),
	);

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
	await saveSession(
		config.cwd + "/" + "memory/sessions/",
		sessionState.getConversation(),
		sessionId,
	);

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
				onSaveSession: async () =>
					await saveSession(
						config.cwd + "/" + "memory/sessions/",
						sessionState.getConversation(),
						sessionId,
					),
				gcManager: gcManager ? gcManager.onActivity.bind(gcManager) : null,
				gcTrigger: gcTrace,
				checkpointer,
			}),
			{
				// Restore terminal with newline when app exits
				onExit: async () => {
					const shutdown = (await import("./src/session/index.js")).handleShutdown;
					if (shutdown) await shutdown();
					await flushLogger();
					process.stdout.write("\n");
				},
			},
		);
	}
}

// Export for testing and TUI integration
export {
	config,
	sessionId,
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
	writeMemoryFile,
	readMemoryFile,
};
