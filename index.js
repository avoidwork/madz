// oxlint-disable no-console

// Load config
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import React from "react";

const { loadConfig, setConfigValue } = await import("./src/config/loader.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
const {
	createSession,
	SessionStateManager,
	enforceContextWindow,
	saveSession,
	handleShutdown,
	registerShutdownHandler,
} = await import("./src/session/index.js");

// Initialize scheduler
const { ScheduleManager } = await import("./src/scheduler/index.js");
const scheduleManager = new ScheduleManager(config.schedules.maxConcurrent);
scheduleManager.register(config.schedules.entries);

// Create session
const { sessionId, state: initialState } = createSession({
	provider: config.providers.default,
	contextWindow: config.session.context_window_size,
});
const sessionState = new SessionStateManager(initialState);

// LLM provider dispatch with fallback chain
async function dispatchProvider(message, providerName = null) {
	const provider = providerName || sessionState.getProvider();
	const providersConfig = config.providers || {};
	const fallbackOrder = providersConfig.fallback_order || [provider, "local"];

	let lastError = null;
	for (const name of fallbackOrder) {
		const _providerConfig = {}; // Provider-specific config from config.providers[name]
		try {
			const result = await callProvider(name, _providerConfig, message);
			return result;
		} catch (err) {
			lastError = err;
			console.error(`Provider "${name}" failed:`, err.message);
		}
	}

	throw new Error(`All providers failed. Last error: ${lastError?.message}`);
}

async function callProvider(_name, _providerConfig, _message) {
	// Placeholder — actual provider implementation would call the LLM API
	return {
		provider: _name,
		content: `[No provider implementation: ${_name}]`,
		tokens: { input: 0, output: 0 },
	};
}

// Conversation handler
async function handleConversation(message) {
	sessionState.addExchange({ role: "user", content: message });
	const contextEnforced = enforceContextWindow(
		sessionState.getConversation(),
		sessionState.getContextWindow(),
	);
	sessionState.addExchange(contextEnforced.context);

	const contextPrefix = loadContext();
	const fullPrompt = [contextPrefix, message].filter(Boolean).join("\n\n");

	const response = await dispatchProvider(fullPrompt);

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
		render(
			React.createElement(App, {
				config,
				registry,
				sessionState,
				dispatchProvider,
				invokeSkill,
			}),
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
