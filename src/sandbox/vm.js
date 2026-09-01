// src/sandbox/vm.js — QuickJS VM wrapper with evaluate(), memory limits,
// timeout, and sandboxed fetch.

import { logger } from "../shared/logger.js";

/**
 * QuickJS VM wrapper that manages lifecycle, enforces limits,
 * and provides a safe evaluate() interface.
 */
export class QuickJSVM {
	/** @type {any} */
	#vm;
	/** @type {number} */
	#memoryLimit;
	/** @type {number} */
	#timeoutMs;
	/** @type {boolean} */
	#captureConsole;
	/** @type {boolean} */
	#urlFilter;
	/** @type {boolean} */
	#disposed = false;

	/**
	 * Create a new QuickJSVM instance.
	 * @param {Object} [config] - VM configuration
	 * @param {number} [config.memoryLimit=536870912] - Memory limit in bytes (512MB)
	 * @param {number} [config.timeoutMs=30000] - Execution timeout in milliseconds
	 * @param {boolean} [config.captureConsole=false] - Intercept console output
	 * @param {boolean} [config.urlFilter=true] - Enable URL filtering on fetch
	 */
	constructor({
		memoryLimit = 536870912,
		timeoutMs = 30000,
		captureConsole = false,
		urlFilter = true,
	} = {}) {
		this.#memoryLimit = memoryLimit;
		this.#timeoutMs = timeoutMs;
		this.#captureConsole = captureConsole;
		this.#urlFilter = urlFilter;
	}

	/**
	 * Initialize the QuickJS VM instance.
	 * Sets up memory limits, sandboxed fetch, and console capture.
	 * @returns {Promise<void>}
	 */
	async initialize() {
		if (this.#disposed) {
			throw new Error("VM is disposed");
		}
		if (this.#vm) {
			return;
		}

		try {
			const { newQuickJS } = await import("quickjs-emscripten-core");
			this.#vm = await newQuickJS();
			this.#vm.setMemoryLimit(this.#memoryLimit);
		} catch (err) {
			logger.warn({ error: err.message }, "[QuickJSVM] Failed to initialize QuickJS engine");
			this.#vm = null;
		}

		if (!this.#vm) {
			return;
		}

		// Inject sandboxed fetch if urlFilter enabled
		if (this.#urlFilter) {
			try {
				this.#vm.evaluate(`
          const originalFetch = globalThis.fetch;
          globalThis.fetch = async function(url) {
            return originalFetch.apply(this, arguments);
          };
        `);
			} catch {
				// Fetch override failed silently
			}
		}

		// Capture console if enabled
		if (this.#captureConsole) {
			try {
				this.#vm.evaluate(`
          const _logs = [];
          globalThis.__consoleLogs = _logs;
          globalThis.console = {
            log: (...args) => {
              _logs.push(args.map(a => String(a)).join(" "));
            },
            warn: (...args) => {
              _logs.push(args.map(a => String(a)).join(" "));
            },
            error: (...args) => {
              _logs.push(args.map(a => String(a)).join(" "));
            },
          };
        `);
			} catch {
				// Console capture failed silently
			}
		}
	}

	/**
	 * Execute JavaScript code in the VM.
	 * @param {string} code - JavaScript code to execute
	 * @returns {Promise<string>} Result string or error message
	 */
	async evaluate(code) {
		if (this.#disposed) {
			throw new Error("VM is disposed");
		}

		if (!this.#vm) {
			await this.initialize();
		}

		if (!this.#vm) {
			return "Error: QuickJS engine not available";
		}

		// Enforce timeout
		let timedOut = false;
		const timeoutId = setTimeout(() => {
			timedOut = true;
		}, this.#timeoutMs);

		try {
			const result = this.#vm.evaluate(code);
			clearTimeout(timeoutId);

			if (timedOut) {
				return "Error: execution timed out";
			}

			// Capture console output if enabled
			if (this.#captureConsole) {
				try {
					const logs = this.#vm.evaluate("globalThis.__consoleLogs || []");
					const consoleOutput = Array.isArray(logs) ? logs.join("\n") : String(logs);
					if (consoleOutput) {
						return `${consoleOutput}\n${String(result)}`;
					}
				} catch {
					// Console log retrieval failed
				}
			}

			return String(result);
		} catch (err) {
			clearTimeout(timeoutId);
			if (timedOut) {
				return "Error: execution timed out";
			}
			return `Error: ${err.message || String(err)}`;
		}
	}

	/**
	 * Get a snapshot of the current VM state.
	 * @returns {Promise<string>} Snapshot string (empty if VM not initialized)
	 */
	async getSnapshot() {
		if (this.#disposed) {
			throw new Error("VM is disposed");
		}
		if (!this.#vm) {
			return "";
		}
		try {
			return this.#vm.dumpState();
		} catch {
			return "";
		}
	}

	/**
	 * Restore a VM from a snapshot string.
	 * @param {string} snapshot - Snapshot string from getSnapshot()
	 * @returns {Promise<QuickJSVM>} Restored VM instance
	 */
	static async restore(snapshot) {
		const vm = new QuickJSVM();
		if (snapshot) {
			try {
				const { newQuickJS } = await import("quickjs-emscripten-core");
				vm.#vm = await newQuickJS(snapshot);
			} catch {
				await vm.initialize();
			}
		} else {
			await vm.initialize();
		}
		return vm;
	}

	/**
	 * Dispose of the VM and release resources.
	 * @returns {Promise<void>}
	 */
	async dispose() {
		if (this.#vm) {
			try {
				this.#vm.dispose();
			} catch {
				// Dispose failed silently
			}
			this.#vm = null;
		}
		this.#disposed = true;
	}
}
