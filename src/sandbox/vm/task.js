// src/sandbox/vm/task.js — Subagent dispatch proxy for the VM.

/**
 * @typedef {Function} TaskDispatchFn
 * @param {string} description — Task description
 * @param {Object} [options] — Dispatch options
 * @param {string} [options.agent] — Target agent name
 * @returns {Promise<string>}
 */

/**
 * Create a task() function that can be called from within the VM.
 * @param {TaskDispatchFn} dispatchFn — Function to dispatch subagent tasks
 * @returns {Function} task() function for the VM
 */
export function createTaskProxy(dispatchFn) {
	return async function task(description, options = {}) {
		try {
			const result = await dispatchFn(description, options);
			return typeof result === "string" ? result : JSON.stringify(result);
		} catch (err) {
			return `Error: ${err.message || String(err)}`;
		}
	};
}
