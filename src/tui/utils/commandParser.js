/**
 * Command registry — event-driven command dispatch for the TUI.
 * Commands are registered as objects with validate, execute, and help properties.
 * Adding a new command is a registration, not a switch case edit.
 */

/**
 * @typedef {Object} Command
 * @property {string} name - Command name (without leading slash)
 * @property {string} description - Human-readable description
 * @property {string} usage - Usage string (e.g., "/quit")
 * @property {(args: string[]) => boolean | string} validate - Returns true if valid, or error message string
 * @property {(args: string[], state: TUIState, dispatch: Function, helpers: CommandHelpers) => Promise<void> | void} execute - Execute the command
 */

/**
 * @typedef {Object} CommandHelpers
 * @property {Function} dispatchProvider - Provider dispatch function
 * @property {Object} sessionState - Session state manager
 * @property {Object} config - App config
 * @property {Object} scrollRef - Scroll ref
 * @property {Function} handleQuit - Quit handler
 * @property {Function} handleNewSession - New session handler
 * @property {Function} handleSkillStream - Skill stream handler
 * @property {Function} setStatusMessage - Set status message
 * @property {Function} addMessage - Add message helper
 * @property {Function} exit - Ink exit function
 */

/**
 * Command registry class.
 */
export class CommandRegistry {
	#commands = new Map();

	constructor() {
		this.#registerDefaultCommands();
	}

	/**
	 * Register a command.
	 * @param {Command} command - Command definition
	 */
	#register(command) {
		this.#commands.set(command.name, command);
	}

	/**
	 * Register all default commands.
	 */
	#registerDefaultCommands() {
		// /quit
		this.#register({
			name: "quit",
			description: "Disconnect and exit",
			usage: "/quit",
			validate: () => true,
			execute: async (_args, _state, _dispatch, helpers) => {
				helpers.handleQuit();
			},
		});

		// /clear
		this.#register({
			name: "clear",
			description: "Clear conversation",
			usage: "/clear",
			validate: () => true,
			execute: async (args, state, dispatch, helpers) => {
				dispatch({ type: "CLEAR_MESSAGES" });
				helpers.setStatusMessage("Conversation cleared.");
			},
		});

		// /new
		this.#register({
			name: "new",
			description: "Start a new session",
			usage: "/new",
			validate: () => true,
			execute: async (_args, _state, _dispatch, helpers) => {
				helpers.handleNewSession();
			},
		});

		// /help
		this.#register({
			name: "help",
			description: "Show available commands",
			usage: "/help",
			validate: () => true,
			execute: async (args, state, dispatch, helpers) => {
				const cmds = Array.from(this.#commands.keys());
				let message = `Available commands: /${cmds.join(", /")}`;
				if (helpers._skillList && helpers._skillList.length > 0) {
					message += `\nSkills: /${helpers._skillList.join(", /")} (execute with /skillName [args])`;
				}
				helpers.addMessage({ role: "system", content: message });
			},
		});

		// /config set <path> <value>
		this.#register({
			name: "config",
			description: "Set a config value",
			usage: "/config set <path> <value>",
			validate: (args) => {
				if (args[0] !== "set" || !args[1]) {
					return "Usage: /config set <path> <value>";
				}
				return true;
			},
			execute: async (args, _state, _dispatch, helpers) => {
				const dotPath = args[1].split(/[-:]/).join(".");
				const valueStr = args[2] || undefined;
				if (helpers._setConfigValue) {
					helpers._setConfigValue(dotPath, valueStr);
					helpers.addMessage({ role: "system", content: `Config: ${dotPath} set.` });
				}
			},
		});

		// /provider set <name>
		this.#register({
			name: "provider",
			description: "Switch AI provider",
			usage: "/provider set <name>",
			validate: (args) => {
				if (args[0] !== "set" || !args[1]) {
					return `Current provider: ${helpers._sessionState?.getProvider() || "unknown"}`;
				}
				return true;
			},
			execute: async (args, _state, _dispatch, helpers) => {
				if (args[0] === "set" && args[1]) {
					helpers._sessionState?.setProvider(args[1]);
					helpers.addMessage({ role: "system", content: `Provider set to: ${args[1]}` });
				} else {
					helpers.addMessage({
						role: "system",
						content: `Current provider: ${helpers._sessionState?.getProvider() || "unknown"}`,
					});
				}
			},
		});

		// /schedule list|pause|resume|run-now
		this.#register({
			name: "schedule",
			description: "Manage scheduled tasks",
			usage: "/schedule [list|pause <name>|resume <name>|run-now <name>]",
			validate: (args) => {
				if (args.length > 2) return "Usage: /schedule [list|pause <name>|resume <name>|run-now <name>]";
				return true;
			},
			execute: async (args, _state, _dispatch, helpers) => {
				if (!args[0]) {
					const list = helpers._scheduleList || [];
					helpers.addMessage({ role: "system", content: `Scheduled tasks: ${list.length}` });
					return;
				}
				const sub = args[0];
				if (sub === "list") {
					const list = helpers._scheduleList || [];
					helpers.addMessage({ role: "system", content: `Scheduled tasks: ${list.length}` });
				} else if (sub === "pause" && args[1]) {
					helpers._schedulePause?.(args[1]);
					helpers.addMessage({ role: "system", content: `Paused: ${args[1]}` });
				} else if (sub === "resume" && args[1]) {
					helpers._scheduleResume?.(args[1]);
					helpers.addMessage({ role: "system", content: `Resumed: ${args[1]}` });
				} else if (sub === "run-now" && args[1]) {
					helpers._scheduleRunNow?.(args[1]);
					helpers.addMessage({ role: "system", content: `Running now: ${args[1]}` });
				} else {
					helpers.setStatusMessage(`Unknown subcommand: ${sub}`);
				}
			},
		});

		// /gc [status]
		this.#register({
			name: "gc",
			description: "Trigger V8 garbage collection",
			usage: "/gc [status]",
			validate: () => true,
			execute: async (args, _state, _dispatch, helpers) => {
				if (args[0] === "status") {
					const gcInfo = helpers._gcStatus?.();
					if (gcInfo) {
						helpers.addMessage({
							role: "system",
							content: gcInfo.available
								? `V8 GC is available (${gcInfo.hourCalls} calls this hour)`
								: "V8 GC is not available (start with --expose-gc)",
						});
					} else {
						helpers.addMessage({ role: "system", content: "GC status unavailable" });
					}
				} else {
					const result = helpers._gcTrigger?.();
					const msg = result?.triggered
						? `GC triggered (${result.hourCalls} calls this hour)`
						: `GC ${result?.reason || "skipped"}`;
					helpers.addMessage({ role: "system", content: msg });
				}
			},
		});

		// /toggle [key]
		this.#register({
			name: "toggle",
			description: "Toggle a runtime configuration setting",
			usage: "/toggle [key]",
			validate: () => true,
			execute: async (args, state, dispatch, _helpers) => {
				if (!args[0]) {
					// Show all toggles
					const lines = Object.entries(state.toggles).map(
						([key, value]) => `  ${key}: ${value ? "on" : "off"}`,
					);
					helpers.addMessage({
						role: "system",
						content: `Toggles:\n${lines.join("\n")}`,
					});
					return;
				}
				const key = args[0];
				if (!(key in state.toggles)) {
					helpers.addMessage({
						role: "system",
						content: `Unknown toggle: ${key}. Available: ${Object.keys(state.toggles).join(", ")}`,
					});
					return;
				}
				dispatch({ type: "TOGGLE_CONFIG", key });
			},
		});

		// /skills
		this.#register({
			name: "skills",
			description: "Display registered skills",
			usage: "/skills",
			validate: () => true,
			execute: async (_args, _state, _dispatch, helpers) => {
				const skillList = helpers._skillList || [];
				if (skillList.length === 0) {
					helpers.addMessage({ role: "system", content: "No skills registered." });
				} else {
					helpers.addMessage({
						role: "system",
						content: `Registered skills (${skillList.length}):\n${skillList.map((s) => `  /${s}`).join("\n")}`,
					});
				}
			},
		});

		// /memory
		this.#register({
			name: "memory",
			description: "Display memory context",
			usage: "/memory",
			validate: () => true,
			execute: async (_args, _state, _dispatch, helpers) => {
				// Memory display would query the memory system
				helpers.addMessage({ role: "system", content: "Memory context inspection not yet implemented." });
			},
		});
	}

	/**
	 * Parse a raw input string and return a command result.
	 * @param {string} input - The raw input (e.g., "/config set telemetry.enabled true")
	 * @param {Object} context - The execution context
	 * @returns {Object|null} Parsed command result
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
			// Validate first
			const validation = command.validate(args);
			if (validation !== true) {
				return { action: "unknown", message: validation };
			}
			// Execute
			return { action: command.name, ...command.execute(args, context) };
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
	 * Register a new command at runtime.
	 * @param {Command} command
	 */
	register(command) {
		this.#register(command);
	}
}
