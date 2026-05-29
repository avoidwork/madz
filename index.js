// oxlint-disable no-console

// Load config
import { fileURLToPath } from "node:url";

import React from "react";

const { loadConfig, setConfigValue } = await import("./src/config/loader.js");
const { createChatModel } = await import("./src/provider/openai.js");
const { createReactAgent, callReactAgent } = await import("./src/agent/react.js");
const { buildToolConfig } = await import("./src/tools/index.js");

const { default: pkg } = await import(new URL("package.json", import.meta.url).href, {
	with: { type: "json" },
});

// Initialize subsystems
const config = loadConfig();

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
const { SkillRegistry, resolvePermissions } = await import("./src/registry/index.js");
const registry = new SkillRegistry();
registry.discover("skills/");

// Initialize memory system
const { writeMemoryFile, readMemoryFile, loadContext, cleanRetainedMemory, enforceMaxEntries } =
	await import("./src/memory/index.js");

// Initialize session
const { createSession, SessionStateManager, saveSession, handleShutdown, registerShutdownHandler } =
	await import("./src/session/index.js");

// Initialize scheduler
const { ScheduleManager } = await import("./src/scheduler/index.js");
const scheduleManager = new ScheduleManager(config.schedules.maxConcurrent);
scheduleManager.register(config.schedules.entries);

// Create session
const providerName = Object.keys(config.providers)[0] || "openai";
const { sessionId, state: initialState } = createSession({
	provider: providerName,
	contextWindow: config.session.context_window_size,
});
const sessionState = new SessionStateManager(initialState);

// Load system prompt
const { loadSystemPrompt } = await import("./src/memory/prompts.js");
const systemPrompt = loadSystemPrompt();

// Build agent and tool config at startup (once)
const providerConfig = config.providers[providerName] || {};
const tools = await buildToolConfig({
	permissions: config.sandbox.permissions || [],
	allowedPaths: config.sandbox.paths || ["memory/", "skills/", "tmp/"],
	maxReadSize: config.sandbox.maxReadSize || "1mb",
	registry,
	conversationsDir: config.session.conversationsDir,
	safety: config.sandbox.safety,
	timeout: config.sandbox.timeout,
	memoryLimit: config.sandbox.memoryLimit,
});
const model = createChatModel(providerConfig);
const { createCheckpointer } = await import("./src/session/checkpointer.js");
const checkpointer = createCheckpointer(config.persistence);
const agent = createReactAgent(model, tools, checkpointer);

const sessionConfig = { configurable: { thread_id: sessionId } };

async function callProvider(_name, _providerConfig, message, streamingCallback) {
	const isNewThread = sessionState.getConversation().length === 0;
	const result = await callReactAgent(
		agent,
		message,
		{ ...sessionConfig, configurable: { ...sessionConfig.configurable, isNewThread } },
		systemPrompt,
		streamingCallback,
	);
	return { provider: providerName, content: result.content, tokens: { input: 0, output: 0 } };
}

// Conversation handler
async function handleConversation(message) {
	const response = await callProvider(null, null, message);

	sessionState.addExchange({ role: "user", content: message });
	sessionState.addExchange({ role: "assistant", content: response.content });

	// Persist to memory
	writeMemoryFile(
		"memory/conversations/",
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
async function dispatchProvider(message, _sessionState = null, streamingCallback) {
	return callProvider(null, null, message, streamingCallback);
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

// Shutdown handler
registerShutdownHandler(async () => {
	saveSession(config.session.conversationsDir, sessionState.getConversation());

	// Clean up retention
	cleanRetainedMemory(config.memory.directory, config.memory.retention.days);
	enforceMaxEntries(config.memory.directory, config.memory.retention.maxEntries);

	if (shutdownFn) {
		await shutdownFn();
	}
});

// CLI mode detection (if run directly as node index.js)
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
	const args = process.argv.slice(2);
	const mode = args.some((a, i) => a === "--mode" && args[i + 1] === "interactive")
		? "interactive"
		: "chat";

	if (mode === "chat") {
		const message = args.filter((a) => !a.startsWith("--"))[0] || "Hello";
		try {
			const response = await handleConversation(message);
			console.log(JSON.stringify(response, null, 2));
		} catch (err) {
			console.error("Error:", err.message);
			process.exit(1);
		}
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
				invokeSkill,
				appInfo,
			}),
			{
				// Restore terminal with newline when app exits
				onExit: async () => {
					const shutdown = (await import("./src/session/index.js")).handleShutdown;
					if (shutdown) await shutdown();
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
	cleanRetainedMemory,
};
