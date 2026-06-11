/**
 * Command parser that handles `:command` syntax with a dispatch table.
 * Supports commands like: `:config set`, `:provider set`, `:schedule list`,
 * `:clear`, `:quit`, `:gc`, etc.
 */
export class CommandParser {
	#dispatch = new Map();

	constructor() {
		// Register default commands
		this.#register("quit", (_args, _ctx) => {
			return { action: "quit", value: true, message: "Quitting." };
		});

		this.#register("provider", (args, ctx) => {
			if (args[0] === "set" && args[1]) {
				ctx._sessionState.setProvider(args[1]);
				return { action: "provider", subAction: "set", value: args[1] };
			}
			return {
				action: "provider",
				message: `Current provider: ${ctx._sessionState.getProvider()}`,
			};
		});

		this.#register("config", (args, ctx) => {
			if (args[0] === "set" && args[1]) {
				// args = ["set", "<path>", "<value>"]
				const dotPath = args[1];
				const valueStr = args[2] || undefined;
				if (ctx._setConfigValue) {
					ctx._setConfigValue(dotPath, valueStr);
					return {
						action: "config",
						subAction: "set",
						path: dotPath,
						message: `Config: ${dotPath} set.`,
					};
				}
			}
			if (args[0]) {
				// args = ["<path>", "<value>"] (without "set")
				const dotPath = args[0];
				const valueStr = args[1] || undefined;
				if (ctx._setConfigValue) {
					ctx._setConfigValue(dotPath, valueStr);
					return {
						action: "config",
						subAction: "set",
						path: dotPath,
						message: `Config: ${dotPath} set.`,
					};
				}
			}
			return { action: "config", message: "Usage: :config set <path> <value>" };
		});

		this.#register("schedule", (args, ctx) => {
			if (!args[0]) {
				return { action: "schedule", list: ctx._scheduleList || [] };
			}
			const sub = args[0];
			if (sub === "list") {
				return { action: "schedule", subAction: "list", list: ctx._scheduleList || [] };
			}
			if (sub === "pause" && args[1]) {
				ctx._schedulePause(args[1]);
				return { action: "schedule", subAction: "pause", name: args[1] };
			}
			if (sub === "resume" && args[1]) {
				ctx._scheduleResume(args[1]);
				return { action: "schedule", subAction: "resume", name: args[1] };
			}
			if (sub === "run-now" && args[1]) {
				return { action: "schedule", subAction: "run-now", name: args[1] };
			}
			return { action: "schedule", message: `Unknown subcommand: ${sub}` };
		});

		this.#register("clear", (_args, _ctx) => {
			return {
				action: "clear",
				message: "Conversation cleared.",
			};
		});

		this.#register("new", (_args, _ctx) => {
			return { action: "new", message: "New session started." };
		});

		this.#register("help", (_args, _ctx) => {
			const cmds = Array.from(this.#dispatch.keys());
			return {
				action: "help",
				message: `Available commands: ${cmds.join(", ")}`,
			};
		});

		this.#register("gc", (args, ctx) => {
			if (args[0] === "status") {
				const gcInfo = ctx._gcStatus ? ctx._gcStatus() : null;
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
			const result = ctx._gcTrigger
				? ctx._gcTrigger()
				: { triggered: false, reason: "gc not wired" };
			const msg = result.triggered
				? `GC triggered (${result.hourCalls} calls this hour)`
				: `GC ${result.reason || "skipped"}`;
			return { action: "gc", subAction: "run", ...result, message: msg };
		});
	}

	#register(name, handler) {
		this.#dispatch.set(name, handler);
	}

	/**
	 * Parse a raw input string and return a command result.
	 * @param {string} input - The raw input (e.g., ":config set telemetry.enabled true")
	 * @param {Object} context - The execution context with module references
	 * @returns {Object|null} Parsed command result
	 */
	parse(input, context) {
		if (!input || typeof input !== "string") return null;
		const trimmed = input.trim();
		if (!trimmed.startsWith(":")) return null;

		const parts = trimmed.slice(1).trim().split(/\s+/);
		const commandName = parts[0];
		const args = parts.slice(1);

		const handler = this.#dispatch.get(commandName);
		if (!handler) {
			return {
				action: "unknown",
				message: `Unknown command: :${commandName}. Type :help for available commands.`,
			};
		}

		return handler(args, context);
	}

	/**
	 * Check if an input is a command (starts with ":".)
	 * @param {string} input
	 * @returns {boolean}
	 */
	isCommand(input) {
		return input && typeof input === "string" && input.trim().startsWith(":");
	}

	/**
	 * Get a list of all registered commands.
	 * @returns {string[]}
	 */
	listCommands() {
		return Array.from(this.#dispatch.keys());
	}

	/**
	 * Check if a command exists.
	 * @param {string} name
	 * @returns {boolean}
	 */
	hasCommand(name) {
		return this.#dispatch.has(name);
	}
}
