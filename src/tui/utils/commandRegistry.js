/**
 * Command Registry — event-driven command registration system.
 * Replaces the switch-driven dispatch table with a registry where commands
 * are registered as objects with validate, execute, and help properties.
 *
 * Adding a new command is a registration, not a switch case edit.
 */

/**
 * Command registry class.
 */
export class CommandRegistry {
	#commands = new Map();

	/**
	 * Register a command.
	 * @param {Object} command - { name, description, usage, validate, execute, help }
	 */
	register(command) {
		this.#commands.set(command.name, command);
	}

	/**
	 * Parse and execute a command input.
	 * @param {string} input - Raw input (e.g., "/config set telemetry.enabled true")
	 * @param {Object} context - Execution context with helpers
	 * @returns {Object} Command result
	 */
	parse(input, context) {
		if (!input || typeof input !== "string") return null;
		const trimmed = input.trim();
		if (!trimmed.startsWith("/")) return null;

		const parts = trimmed.slice(1).trim().split(/\s+/);
		const commandName = parts[0];
		const args = parts.slice(1);

		// 1. Check registered commands first
		const command = this.#commands.get(commandName);
		if (command) {
			// Validate
			const validation = command.validate(args, context);
			if (validation === true || validation === undefined) {
				return command.execute(args, context);
			}
			// Validation returned an error message
			return {
				action: "unknown",
				message: validation,
			};
		}

		// 2. Fall back to skill execution
		if (context?._skillList && context._skillList.includes(commandName)) {
			if (context._executeSkill) {
				return context._executeSkill(commandName, args);
			}
			return {
				action: "skill",
				subAction: "error",
				message: `Skill "${commandName}" not available in this context.`,
			};
		}

		// 3. Unknown command
		return {
			action: "unknown",
			message: `Unknown command: /${commandName}. Type /help for available commands.`,
		};
	}

	/**
	 * Check if an input is a command.
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
	 * Check if a command exists.
	 * @param {string} name
	 * @returns {boolean}
	 */
	hasCommand(name) {
		return this.#commands.has(name);
	}

	/**
	 * Get help text for all commands.
	 * @returns {string}
	 */
	getHelp(context) {
		const cmds = this.listCommands();
		let message = `Available commands: /${cmds.join(", /")}`;
		if (context?._skillList && context._skillList.length > 0) {
			message += `\nSkills: /${context._skillList.join(", /")} (execute with /skillName [args])`;
		}
		return message;
	}
}

/**
 * Default command definitions.
 * Each command has validate, execute, and help properties.
 */
export const defaultCommands = [
	{
		name: "quit",
		description: "Disconnect and exit",
		usage: "/quit",
		validate: () => true,
		execute: () => ({ action: "quit", value: true, message: "Quitting." }),
	},

	{
		name: "clear",
		description: "Clear conversation",
		usage: "/clear",
		validate: () => true,
		execute: () => ({ action: "clear", message: "Conversation cleared." }),
	},

	{
		name: "new",
		description: "Start a new session",
		usage: "/new",
		validate: () => true,
		execute: () => ({ action: "new", message: "New session started." }),
	},

	{
		name: "help",
		description: "Show available commands",
		usage: "/help",
		validate: () => true,
		execute: (_args, context) => {
			return {
				action: "help",
				message: `Available commands: /quit, /clear, /new, /help, /config, /provider, /schedule, /gc\nSkills: /${(context?._skillList || []).join(", /")} (execute with /skillName [args])`,
			};
		},
	},

	{
		name: "provider",
		description: "Switch AI provider",
		usage: "/provider set <name>",
		validate: (args) => {
			if (args[0] === "set" && !args[1]) {
				return "Usage: /provider set <name>";
			}
			return true;
		},
		execute: (args, context) => {
			if (args[0] === "set" && args[1]) {
				context._sessionState.setProvider(args[1]);
				return { action: "provider", subAction: "set", value: args[1] };
			}
			return {
				action: "provider",
				message: `Current provider: ${context._sessionState.getProvider()}`,
			};
		},
	},

	{
		name: "config",
		description: "Set a config value",
		usage: "/config set <path> <value>",
		validate: (args) => {
			if (args[0] === "set" && !args[1]) {
				return "Usage: /config set <path> <value>";
			}
			return true;
		},
		execute: (args, context) => {
			const pathArg = args[0] === "set" ? args[1] : args[0];
			const valueStr = args[args[0] === "set" ? 2 : 1];
			if (!pathArg) {
				return { action: "config", message: "Usage: /config set <path> <value>" };
			}
			const dotPath = pathArg.split(/[-:]/).join(".");
			if (context._setConfigValue) {
				context._setConfigValue(dotPath, valueStr);
				return {
					action: "config",
					subAction: "set",
					path: dotPath,
					message: `Config: ${dotPath} set.`,
				};
			}
			return { action: "config", message: "Config update not available" };
		},
	},

	{
		name: "schedule",
		description: "Manage scheduled tasks",
		usage: "/schedule [list|pause <name>|resume <name>|run-now <name>]",
		validate: (args) => {
			if (args[0] && !["list", "pause", "resume", "run-now"].includes(args[0])) {
				return `Unknown subcommand: ${args[0]}`;
			}
			if ((args[0] === "pause" || args[0] === "resume" || args[0] === "run-now") && !args[1]) {
				return `Usage: /schedule ${args[0]} <name>`;
			}
			return true;
		},
		execute: (args, context) => {
			if (!args[0]) {
				return { action: "schedule", list: context._scheduleList || [] };
			}
			const sub = args[0];
			if (sub === "list") {
				return { action: "schedule", subAction: "list", list: context._scheduleList || [] };
			}
			if (sub === "pause" && args[1]) {
				context._schedulePause(args[1]);
				return { action: "schedule", subAction: "pause", name: args[1] };
			}
			if (sub === "resume" && args[1]) {
				context._scheduleResume(args[1]);
				return { action: "schedule", subAction: "resume", name: args[1] };
			}
			if (sub === "run-now" && args[1]) {
				return { action: "schedule", subAction: "run-now", name: args[1] };
			}
			return { action: "schedule", message: `Unknown subcommand: ${sub}` };
		},
	},

	{
		name: "gc",
		description: "Trigger V8 garbage collection",
		usage: "/gc [status]",
		validate: (args) => {
			if (args[0] && args[0] !== "status") {
				return "Usage: /gc [status]";
			}
			return true;
		},
		execute: (args, context) => {
			if (args[0] === "status") {
				const gcInfo = context._gcStatus ? context._gcStatus() : null;
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
			const result = context._gcTrigger ? context._gcTrigger() : { triggered: false, reason: "gc not wired" };
			const msg = result.triggered
				? `GC triggered (${result.hourCalls} calls this hour)`
				: `GC ${result.reason || "skipped"}`;
			return { action: "gc", subAction: "run", ...result, message: msg };
		},
	},
];

/**
 * Create and populate a CommandRegistry with default commands.
 * @param {Object} context - Execution context for command helpers
 * @returns {CommandRegistry}
 */
export function createDefaultRegistry(context) {
	const registry = new CommandRegistry();
	for (const cmd of defaultCommands) {
		registry.register(cmd);
	}
	return registry;
}
