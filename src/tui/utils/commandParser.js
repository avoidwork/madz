/**
 * Event-driven command registry for the TUI.
 * Commands are registered as objects with validate, execute, and help properties.
 */

/**
 * Command registry — replaces switch-driven dispatch table.
 */
export class CommandRegistry {
	#commands = new Map();

	constructor() {
		this.#registerDefaultCommands();
	}

	/**
	 * Register a command.
	 * @param {Command} command - Command object with name, description, usage, validate, execute
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
			name: 'quit',
			description: 'Disconnect and exit',
			usage: '/quit',
			validate: () => true,
			execute: () => ({ action: 'quit', value: true, message: 'Quitting.' }),
		});

		// /clear
		this.#register({
			name: 'clear',
			description: 'Clear conversation',
			usage: '/clear',
			validate: () => true,
			execute: () => ({ action: 'clear', message: 'Conversation cleared.' }),
		});

		// /new
		this.#register({
			name: 'new',
			description: 'Start a new session',
			usage: '/new',
			validate: () => true,
			execute: () => ({ action: 'new', message: 'New session started.' }),
		});

		// /help
		this.#register({
			name: 'help',
			description: 'Show available commands',
			usage: '/help',
			validate: () => true,
			execute: (_args, ctx) => {
				const cmds = Array.from(this.#commands.keys()).filter((k) => !k.startsWith('_'));
				let message = `Available commands: /${cmds.join(', /')}`;
				if (ctx?._skillList && ctx._skillList.length > 0) {
					message += `\nSkills: /${ctx._skillList.join(', /')} (execute with /skillName [args])`;
				}
				return { action: 'help', message };
			},
		});

		// /config set <path> <value>
		this.#register({
			name: 'config',
			description: 'Set a config value',
			usage: '/config set <path> <value>',
			validate: (args) => {
				if (args[0] !== 'set' || !args[1]) {
					return 'Usage: /config set <path> <value>';
				}
				return true;
			},
			execute: (args, ctx) => {
				const dotPath = args[1]?.split(/[-:]/).join('.');
				const valueStr = args[2] || undefined;
				if (ctx?._setConfigValue) {
					ctx._setConfigValue(dotPath, valueStr);
					return { action: 'config', subAction: 'set', path: dotPath, message: `Config: ${dotPath} set.` };
				}
				return { action: 'config', message: 'Config update not available.' };
			},
		});

		// /provider set <name>
		this.#register({
			name: 'provider',
			description: 'Switch AI provider',
			usage: '/provider set <name>',
			validate: (args) => {
				if (args[0] && args[0] !== 'set') {
					return 'Usage: /provider set <name>';
				}
				return true;
			},
			execute: (args, ctx) => {
				if (args[0] === 'set' && args[1]) {
					ctx?._sessionState?.setProvider(args[1]);
					return { action: 'provider', subAction: 'set', value: args[1] };
				}
				return { action: 'provider', message: `Current provider: ${ctx?._sessionState?.getProvider() || 'unknown'}` };
			},
		});

		// /schedule list/pause/resume/run-now
		this.#register({
			name: 'schedule',
			description: 'Manage scheduled tasks',
			usage: '/schedule list|pause <name>|resume <name>|run-now <name>',
			validate: (args) => {
				if (!args[0]) return true;
				const valid = ['list', 'pause', 'resume', 'run-now'];
				if (!valid.includes(args[0])) {
					return `Unknown subcommand: ${args[0]}. Valid: list, pause, resume, run-now`;
				}
				if ((args[0] === 'pause' || args[0] === 'resume' || args[0] === 'run-now') && !args[1]) {
					return `Usage: /schedule ${args[0]} <name>`;
				}
				return true;
			},
			execute: (args, ctx) => {
				const sub = args[0];
				if (!sub) {
					return { action: 'schedule', list: ctx?._scheduleList || [] };
				}
				if (sub === 'list') {
					return { action: 'schedule', subAction: 'list', list: ctx?._scheduleList || [] };
				}
				if (sub === 'pause' && args[1]) {
					ctx?._schedulePause?.(args[1]);
					return { action: 'schedule', subAction: 'pause', name: args[1] };
				}
				if (sub === 'resume' && args[1]) {
					ctx?._scheduleResume?.(args[1]);
					return { action: 'schedule', subAction: 'resume', name: args[1] };
				}
				if (sub === 'run-now' && args[1]) {
					return { action: 'schedule', subAction: 'run-now', name: args[1] };
				}
				return { action: 'schedule', message: `Unknown subcommand: ${sub}` };
			},
		});

		// /gc /gc status
		this.#register({
			name: 'gc',
			description: 'Trigger V8 garbage collection',
			usage: '/gc|gc status',
			validate: (args) => {
				if (args[0] && args[0] !== 'status') {
					return 'Usage: /gc or /gc status';
				}
				return true;
			},
			execute: (args, ctx) => {
				if (args[0] === 'status') {
					const gcInfo = ctx?._gcStatus?.();
					if (gcInfo) {
						return {
							action: 'gc',
							subAction: 'status',
							available: gcInfo.available,
							calls: gcInfo.calls || [],
							hourCalls: gcInfo.hourCalls || 0,
							message: gcInfo.available
								? `V8 GC is available (${gcInfo.hourCalls} calls this hour)`
								: 'V8 GC is not available (start with --expose-gc)',
						};
					}
					return { action: 'gc', subAction: 'status', message: 'GC status unavailable' };
				}
				const result = ctx?._gcTrigger?.() || { triggered: false, reason: 'gc not wired' };
				const msg = result.triggered
					? `GC triggered (${result.hourCalls} calls this hour)`
					: `GC ${result.reason || 'skipped'}`;
				return { action: 'gc', subAction: 'run', ...result, message: msg };
			},
		});

		// /toggle
		this.#register({
			name: 'toggle',
			description: 'Toggle runtime settings',
			usage: '/toggle|toggle <key>',
			validate: (args) => {
				if (args[0] && !['autoScroll', 'timestamps', 'commandEcho', 'cursorBreathe', 'debugOutput'].includes(args[0])) {
					return `Unknown toggle: ${args[0]}. Available: autoScroll, timestamps, commandEcho, cursorBreathe, debugOutput`;
				}
				return true;
			},
			execute: (args, ctx) => {
				const currentToggles = ctx?._toggles || {};
				const result = ctx?._handleToggle?.(args, currentToggles);
				if (result?.toggles) {
					ctx._toggles = result.toggles;
				}
				return result || { action: 'toggle', message: 'Toggle not available' };
			},
		});

		// /skills
		this.#register({
			name: 'skills',
			description: 'List available skills',
			usage: '/skills',
			validate: () => true,
			execute: (_args) => {
				const skills = ctx?._skillList || [];
				if (skills.length === 0) {
					return { action: 'skills', message: 'No skills registered.' };
				}
				return { action: 'skills', message: `Registered skills: ${skills.join(', ')}` };
			},
		});

		// /memory
		this.#register({
			name: 'memory',
			description: 'Show memory entries',
			usage: '/memory',
			validate: () => true,
			execute: (_args) => {
				// Memory display would be handled by the parent component
				return { action: 'memory', message: 'Memory command — use /memory open for details' };
			},
		});

		// Skill fallback (internal)
		this.#register({
			name: '_skillFallback',
			description: 'Internal — skill execution fallback',
			usage: '',
			validate: () => true,
			execute: () => ({ action: 'skill', subAction: 'error', message: 'Skill not found' }),
		});
	}

	/**
	 * Parse a raw input string and return a command result.
	 * @param {string} input - The raw input (e.g., "/config set telemetry.enabled true")
	 * @param {Object} context - The execution context with module references
	 * @returns {Object|null} Parsed command result
	 */
	parse(input, context) {
		if (!input || typeof input !== 'string') return null;
		const trimmed = input.trim();
		if (!trimmed.startsWith('/')) return null;

		const parts = trimmed.slice(1).trim().split(/\s+/);
		const commandName = parts[0];
		const args = parts.slice(1);

		// 1. Check registered commands first
		const command = this.#commands.get(commandName);
		if (command) {
			// Validate
			const validation = command.validate(args, context);
			if (validation !== true) {
				return { action: 'unknown', message: validation };
			}
			// Execute
			return command.execute(args, context);
		}

		// 2. Fall back to skill execution
		if (context?._skillList && context._skillList.includes(commandName)) {
			if (context._executeSkill) {
				return context._executeSkill(commandName, args);
			}
			return {
				action: 'skill',
				subAction: 'error',
				message: `Skill "${commandName}" not available in this context.`,
			};
		}

		// 3. Unknown command
		return {
			action: 'unknown',
			message: `Unknown command: /${commandName}. Type /help for available commands.`,
		};
	}

	/**
	 * Check if an input is a command (starts with "/").
	 * @param {string} input
	 * @returns {boolean}
	 */
	isCommand(input) {
		return input && typeof input === 'string' && input.trim().startsWith('/');
	}

	/**
	 * Get a list of all registered commands.
	 * @returns {string[]}
	 */
	listCommands() {
		return Array.from(this.#commands.keys()).filter((k) => !k.startsWith('_'));
	}

	/**
	 * Check if a command exists.
	 * @param {string} name
	 * @returns {boolean}
	 */
	hasCommand(name) {
		return this.#commands.has(name);
	}
}
