/**
 * Shared command help data — single source of truth for the TUI banner
 * and the `/help` command. Keeps the two in sync.
 */

export const COMMAND_GROUPS = [
	{
		group: "Chat:",
		items: ["Type naturally to chat", "Up/Down arrow: message history", "Esc: interrupt"],
	},
	{
		group: "Command:",
		items: [
			"/clear - clear conversation",
			"/config set <path> <value> - update config",
			"/gc [status] - garbage collect or show GC status",
			"/help - show this list",
			"/memory - view memory panel",
			"/new - start a new session",
			"/provider [set <name>] - list or switch provider",
			"/quit, /exit - exit the app",
			"/schedule [list|pause|resume|run-now]",
			"/sessions - view sessions panel",
			"/settings - view settings panel",
			"/skills - view skills panel",
		],
	},
];

/**
 * Format the command help groups as a plain-text string.
 * @returns {string} The grouped help text
 */
export function formatCommandHelp() {
	return COMMAND_GROUPS.map((g) => `${g.group}\n${g.items.map((it) => "  " + it).join("\n")}`).join(
		"\n\n",
	);
}
