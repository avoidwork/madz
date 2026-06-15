#!/usr/bin/env node

// Load config
import { fileURLToPath } from "node:url";
import { loadSession } from "./src/session/loader.js";

import React from "react";

const { loadConfig, setConfigValue } = await import("./src/config/loader.js");
const { createChatModel } = await import("./src/provider/openai.js");
const { createReactAgent, callReactAgent } = await import("./src/agent/react.js");
const { buildToolConfig } = await import("./src/tools/index.js");
const { logger } = await import("./src/logger.js");

const { default: pkg } = await import(new URL("package.json", import.meta.url).href, {
	with: { type: "json" },
});

// Initialize subsystems
const config = loadConfig();

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
		const cwd = process.cwd();
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
await ensureSessionsDir("memory/sessions/");

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
await ensureSkillsDir("skills/");
registry.discover("skills/");

// Initialize memory system
const { writeMemoryFile, readMemoryFile, loadContext, loadMemories, formatMemoriesForPrompt } =
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
	queueMicrotask(() => expireEphemeralMemories(config.memory.contextDir).catch(() => {}));
} catch {
	// Graceful degradation: session starts even if cleanup import fails
}

// Load system prompt and append memory entries
const { loadSystemPrompt } = await import("./src/memory/prompts.js");
const { generateSkillCatalogPrompt } = await import("./src/tools/skills.js");
const systemPrompt = loadSystemPrompt();
const memoryEntriesDir = config.memory?.entriesDir || "memory/context/";
// Build agent and tool config at startup (once)
const providerConfig = config.providers[providerName] || {};

// Create checkpointer before tools so compactContext can access it
const { createCheckpointer } = await import("./src/session/checkpointer.js");
const checkpointer = createCheckpointer(config.persistence);

const tools = await buildToolConfig({
	permissions: config.sandbox.permissions || [],
	allowedPaths: config.sandbox.paths || ["memory/", "skills/", "tmp/"],
	maxReadSize: config.sandbox.maxReadSize || "1mb",
	registry,
	sessionsDir: "memory/sessions/",
	safety: config.sandbox.safety,
	timeout: config.sandbox.timeout,
	memoryLimit: config.sandbox.memoryLimit,
	contextDir: config.memory?.contextDir || "memory/context/",
	ephemeralTtlDays: config.memory?.ephemeral?.ttlDays || 7,
	ephemeralMaxEntries: config.memory?.ephemeral?.maxEntries || 10,
	config,
	checkpointer,
});
const model = createChatModel(providerConfig);
const agent = createReactAgent(
	model,
	tools,
	checkpointer,
	config.agent?.recursionLimit ?? undefined,
	config.agent?.nodeTimeout ?? 600000,
);

const sessionConfig = { configurable: { thread_id: sessionState.getThreadId() } };

async function callProvider(
	_name,
	_providerConfig,
	message,
	streamingCallback,
	interruptRef = null,
) {
	const isNewThread = sessionState.getConversation().length === 0;
	const threadId = sessionState.getThreadId();
	const memoryEntries = await loadMemories(memoryEntriesDir);
	const memoryText = formatMemoriesForPrompt(memoryEntries);
	const catalog = registry.getCatalog();
	const skillCatalog = generateSkillCatalogPrompt(catalog);
	const callPrompt = `${systemPrompt}${skillCatalog ? `\n\n${skillCatalog}` : ""}${memoryText ? `\n\n${memoryText}` : ""}`;
	const result = await callReactAgent(
		agent,
		message,
		{ ...sessionConfig, configurable: { thread_id: threadId, isNewThread } },
		callPrompt,
		streamingCallback,
		{
			maxTokens: providerConfig.maxTokens,
			checkpointer,
		},
		interruptRef,
	);
	return { provider: providerName, content: result.content, tokens: { input: 0, output: 0 } };
}

// Conversation handler
async function handleConversation(message, sessionId = "") {
	// Restore existing session if requested
	if (sessionId) {
		const { conversation } = await loadSession("memory/sessions/", 20);
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
async function dispatchProvider(
	message,
	_sessionState = null,
	streamingCallback,
	interruptRef = null,
) {
	return callProvider(null, null, message, streamingCallback, interruptRef);
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
	await saveSession("memory/sessions/", sessionState.getConversation(), sessionId);

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
	const args = process.argv.slice(2);
	const mode = args.some((a, i) => a === "--mode" && args[i + 1] === "interactive")
		? "interactive"
		: "chat";

	let chatSessionId = args.reduce((id, a, i) => {
		if (a === "--session-id" || a === "-s") return args[i + 1] || id;
		return id;
	}, "");
	const jsonOut = args.includes("--json");
	let message = args.filter((a) => !a.startsWith("--"))[0];
	if (!message && chatSessionId) {
		message = "continue";
	}
	message = message || "Hello";

	if (mode === "chat") {
		try {
			const response = await handleConversation(message, chatSessionId);

			// oxlint-disable no-console
			if (jsonOut) {
				console.log(
					JSON.stringify({
						provider: response.provider,
						content: response.content,
						tokens: response.tokens,
					}),
				);
			} else {
				console.log(response.content);
			}
			// oxlint-enable no-console
		} catch (err) {
			// oxlint-disable no-console
			console.error("Error:", err.message);
			// oxlint-enable no-console
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
					await saveSession("memory/sessions/", sessionState.getConversation(), sessionId),
				gcManager: gcManager ? gcManager.onActivity.bind(gcManager) : null,
				gcTrigger: gcTrace,
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
	loadMemories,
	formatMemoriesForPrompt,
};
