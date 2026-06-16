/**
 * Event-driven command registry for TUI.
 * Replaces the switch-driven dispatch table with a registration-based
 * system where commands are objects with validate, execute, and help properties.
 */

/**
 * @typedef {Object} Command
 * @property {string} name - Command name (e.g., "quit", "config")
 * @property {string} description - Human-readable description
 * @property {string} usage - Usage string (e.g., "/config set <path> <value>")
 * @property {Function} validate - (args, ctx) => { valid: boolean, error?: string }
 * @property {Function} execute - (args, ctx) => { action, ...result }
 * @property {string} [group] - Command group for /help display
 */

/**
 * @typedef {Object} CommandHelpers
 * @property {Function} dispatchProvider - Provider dispatch function
 * @property {Object} sessionState - Current session state
 * @property {Object} config - Application config
 * @property {Object} scrollRef - ScrollView ref
 * @property {Function} [setConfigValue] - Config setter
 * @property {Array} [scheduleList] - Current schedule list
 * @property {Function} [schedulePause] - Schedule pause function
 * @property {Function} [scheduleResume] - Schedule resume function
 * @property {Array} [skillList] - Available skills
 * @property {Function} [executeSkill] - Skill execution function
 * @property {Function} [gcTrigger] - GC trigger function
 * @property {Function} [gcStatus] - GC status function
 */

/**
 * Event-driven command registry.
 */
export class CommandRegistry {
	#commands = new Map();
	#groups = new Map();

	constructor() {
		// Register all built-in commands
		this.#registerBuiltins();
	}

	/**
	 * Register a command with the registry.
	 * @param {Command} command - Command definition
	 */
	register(command) {
		this.#commands.set(command.name, command);

		// Track groups
		const group = command.group || "General";
		if (!this.#groups.has(group)) {
			this.#groups.set(group, []);
		}
		this.#groups.get(group).push(command.name);
	}

	/**
	 * Check if a command exists.
	 * @param {string} name
	 * @returns {boolean}
	 */
	has(name) {
		return this.#commands.has(name);
	}

	/**
	 * Parse a raw input string and return a command result.
	 * @param {string} input - Raw input (e.g., "/config set telemetry.enabled true")
	 * @param {Object} context - Execution context with module references
	 * @returns {Object|null} Parsed command result
	 */
	parse(input, context) {
		if (!input || typeof input !== "string") return null;
		const trimmed = input.trim();
		if (!trimmed.startsWith("/")) return null;

		const parts = trimmed.slice(1).trim().split(/\s+/);
		const commandName = parts[0];
		const args = parts.slice(1);

		// Check registered commands
		const command = this.#commands.get(commandName);
		if (command) {
			// Validate first
			const validation = command.validate ? command.validate(args, context) : { valid: true };
			if (!validation.valid) {
				return {
					action: "unknown",
					message: `Invalid ${commandName}: ${validation.error || "invalid arguments"}`,
				};
			}
			// Execute
			return command.execute(args, context);
		}

		// Unknown command
		return {
			action: "unknown",
			message: `Unknown command: /${commandName}. Type /help for available commands.`,
		};
	}

	/**
	 * Check if an input is a command (starts with "/").
	 * @param {string} input
	 * @returns {boolean}
	 */
	isCommand(input) {
		return input && typeof input === "string" && input.trim().startsWith("/");
	}

	/**
	 * Get a list of all registered commands.
	 * @returns {string[]}
	 */
	listCommands() {
		return Array.from(this.#commands.keys());
	}

	/**
	 * Get grouped command list for /help display.
	 * @returns {Array<{group: string, commands: string[]}>}
	 */
	getGroupedCommands() {
		const result = [];
		for (const [group, commands] of this.#groups) {
			result.push({ group, commands });
		}
		return result;
	}

	/**
	 * Get help text for a specific command.
	 * @param {string} name
	 * @returns {string|null}
	 */
	getHelp(name) {
		const command = this.#commands.get(name);
		if (!command) return null;
		return `${command.usage}\n${command.description}`;
	}

	/**
	 * Register all built-in commands.
	 */
	#registerBuiltins() {
		// Quit
		this.register({
			name: "quit",
			description: "Exit the application",
			usage: "/quit",
			group: "Session",
			validate: () => ({ valid: true }),
			execute: () => ({ action: "quit", value: true, message: "Quitting." }),
		});

		// New session
		this.register({
			name: "new",
			description: "Start a new conversation session",
			usage: "/new",
			group: "Session",
			validate: () => ({ valid: true }),
			execute: () => ({ action: "new", message: "New session started." }),
		});

		// Clear
		this.register({
			name: "clear",
			description: "Clear the conversation",
			usage: "/clear",
			group: "Session",
			validate: () => ({ valid: true }),
			execute: () => ({ action: "clear", message: "Conversation cleared." }),
		});

		// Provider
		this.register({
			name: "provider",
			description: "List or switch the AI provider",
			usage: "/provider [set <name>]",
			group: "Provider",
			validate: (args) => {
				if (args[0] === "set" && !args[1]) {
					return { valid: false, error: "Missing provider name" };
				}
				return { valid: true };
			},
			execute: (args, ctx) => {
				if (args[0] === "set" && args[1]) {
					ctx.sessionState?.setProvider(args[1]);
					return { action: "provider", subAction: "set", value: args[1] };
				}
				return {
					action: "provider",
					message: `Current provider: ${ctx.sessionState?.getProvider() || "unknown"}`,
				};
			},
		});

		// Config
		this.register({
			name: "config",
			description: "View or update configuration",
			usage: "/config [set <path> <value>]",
			group: "Config",
			validate: (args) => {
				if (args[0] === "set") {
					if (!args[1]) return { valid: false, error: "Missing config path" };
					if (args.length < 3) return { valid: false, error: "Missing config value" };
				}
				return { valid: true };
			},
			execute: (args, ctx) => {
				if (args[0] === "set" && args[1]) {
					const dotPath = args[1].split(/[-:]/).join(".");
					const valueStr = args[2] || undefined;
					if (ctx.setConfigValue) {
						ctx.setConfigValue(dotPath, valueStr);
						return {
							action: "config",
							subAction: "set",
							path: dotPath,
							message: `Config: ${dotPath} set.`,
						};
					}
				}
				if (args[0]) {
					const dotPath = args[0].split(/[-:]/).join(".");
					const valueStr = args[1] || undefined;
					if (ctx.setConfigValue) {
						ctx.setConfigValue(dotPath, valueStr);
						return {
							action: "config",
							subAction: "set",
							path: dotPath,
							message: `Config: ${dotPath} set.`,
						};
					}
				}
				return { action: "config", message: "Usage: /config set <path> <value>" };
			},
		});

		// Schedule
		this.register({
			name: "schedule",
			description: "Manage scheduled tasks",
			usage: "/schedule [list|pause|resume|run-now]",
			group: "Schedule",
			validate: (args) => {
				if (args[0] === "pause" && !args[1]) {
					return { valid: false, error: "Missing schedule name" };
				}
				if (args[0] === "resume" && !args[1]) {
					return { valid: false, error: "Missing schedule name" };
				}
				if (args[0] === "run-now" && !args[1]) {
					return { valid: false, error: "Missing schedule name" };
				}
				return { valid: true };
			},
			execute: (args, ctx) => {
				if (!args[0]) {
					return { action: "schedule", list: ctx.scheduleList || [] };
				}
				const sub = args[0];
				if (sub === "list") {
					return { action: "schedule", subAction: "list", list: ctx.scheduleList || [] };
				}
				if (sub === "pause" && args[1]) {
					ctx.schedulePause?.(args[1]);
					return { action: "schedule", subAction: "pause", name: args[1] };
				}
				if (sub === "resume" && args[1]) {
					ctx.scheduleResume?.(args[1]);
					return { action: "schedule", subAction: "resume", name: args[1] };
				}
				if (sub === "run-now" && args[1]) {
					return { action: "schedule", subAction: "run-now", name: args[1] };
				}
				return { action: "schedule", message: `Unknown subcommand: ${sub}` };
			},
		});

		// GC
		this.register({
			name: "gc",
			description: "Trigger or check V8 garbage collection",
			usage: "/gc [status]",
			group: "System",
			validate: () => ({ valid: true }),
			execute: (args, ctx) => {
				if (args[0] === "status") {
					const gcInfo = ctx.gcStatus ? ctx.gcStatus() : null;
					if (gcInfo) {
						return {
							action: "gc",
							subAction: "status",
							available: gcInfo.available,
							calls: gcInfo.calls || [],
							hourCalls: gcInfo.hourCalls || 0,
							message: gcInfo.available
								? `V8 GC is available (${gcInfo.hourCalls} calls this hour)`
								: "V8 GC is not available (start with --expose-gc)",
						};
					}
					return { action: "gc", subAction: "status", message: "GC status unavailable" };
				}
				const result = ctx.gcTrigger ? ctx.gcTrigger() : { triggered: false, reason: "gc not wired" };
				const msg = result.triggered
					? `GC triggered (${result.hourCalls} calls this hour)`
					: `GC ${result.reason || "skipped"}`;
				return { action: "gc", subAction: "run", ...result, message: msg };
			},
		});

		// Help
		this.register({
			name: "help",
			description: "Show available commands",
			usage: "/help",
			group: "General",
			validate: () => ({ valid: true }),
			execute: (_args, ctx) => {
				const grouped = this.getGroupedCommands();
				let message = "Available commands:\n";
				for (const { group, commands } of grouped) {
					message += `\n${group}:\n`;
					for (const cmd of commands) {
						const command = this.#commands.get(cmd);
						message += `  /${cmd} - ${command.usage}\n`;
					}
				}
				if (ctx.skillList && ctx.skillList.length > 0) {
					message += `\nSkills:\n`;
					for (const skill of ctx.skillList) {
						message += `  /${skill} - execute skill\n`;
					}
				}
				return { action: "help", message };
			},
		});
	}
}

/**
 * Create a new command registry instance.
 * @returns {CommandRegistry}
 */
export function createCommandRegistry() {
	return new CommandRegistry();
}
