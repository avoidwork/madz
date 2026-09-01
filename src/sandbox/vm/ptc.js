// src/sandbox/vm/ptc.js — PTC tool proxy that exposes agent tools as JS functions.

/**
 * @typedef {Object} ToolDef
 * @property {string} name — Tool name
 * @property {Function} execute — Tool execution function
 * @property {string} [description] — Tool description
 */

/**
 * Create a proxy object that exposes whitelisted tools as JS functions.
 * Each tool becomes: tools.<name>(input) => Promise<string>
 * @param {ToolDef[]} tools — Array of tool definitions
 * @param {string[]} whitelist — Array of tool names to expose
 * @returns {Object} Proxy object with tool functions
 */
export function createPTCProxy(tools, whitelist) {
	const toolMap = new Map();
	for (const tool of tools) {
		toolMap.set(tool.name, tool);
	}

	const proxy = {};

	// Create stubs for whitelisted tool names (even if not in tools array)
	for (const name of whitelist) {
		const toolDef = toolMap.get(name);
		if (!toolDef) {
			proxy[name] = () => Promise.resolve(`Tool not available: ${name}`);
			continue;
		}

		proxy[name] = async (input) => {
			try {
				const result = await toolDef.execute(input);
				return typeof result === "string" ? result : JSON.stringify(result);
			} catch (err) {
				return `Error: ${err.message || String(err)}`;
			}
		};
	}

	return proxy;
}
