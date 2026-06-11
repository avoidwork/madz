const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Schedule manager for CRUD operations on scheduled jobs.
 * Jobs are stored as JSON files in memory/schedules/ and managed via the cronJob tool.
 * This class does not include the in-process clock tick loop — crond handles scheduling.
 */
export class ScheduleManager {
	#scheduleEntry = new Map();

	/**
	 * @param {number} [_maxConcurrent=1] - Deprecated, kept for API compat
	 */
	constructor(_maxConcurrent = 1) {}

	/**
	 * Register schedule entries from config-style objects.
	 * @param {Array} entries - Raw schedule entries
	 * @returns {Array<{ name: string, error: string }>}
	 */
	register(entries = []) {
		const results = [];
		for (const entry of entries) {
			if (!entry.name || !entry.cron || !entry.skill) {
				results.push({ name: entry.name, error: "Missing required fields (name, cron, skill)" });
				continue;
			}
			this.#scheduleEntry.set(entry.name, { ...entry, paused: false, lastRun: null });
		}
		return results;
	}

	/**
	 * List all registered schedules with status.
	 * @returns {Array}
	 */
	list() {
		const schedules = [];
		for (const [, entry] of this.#scheduleEntry) {
			schedules.push({ ...entry });
		}
		return schedules;
	}

	/**
	 * Pause a schedule by name.
	 * @param {string} name
	 * @returns {boolean}
	 */
	pause(name) {
		const entry = this.#scheduleEntry.get(name);
		if (!entry) return false;
		entry.paused = true;
		return true;
	}

	/**
	 * Resume a paused schedule by name.
	 * @param {string} name
	 * @returns {boolean}
	 */
	resume(name) {
		const entry = this.#scheduleEntry.get(name);
		if (!entry) return false;
		entry.paused = false;
		return true;
	}

	/**
	 * Run a schedule immediately via the sandbox.
	 * @param {string} name - Schedule name
	 * @param {Object} scheduler - The full scheduler instance for sandbox access
	 * @returns {Promise<Object>} Execution result
	 */
	async runNow(name, scheduler) {
		const entry = this.#scheduleEntry.get(name);
		if (!entry) return { error: `Unknown schedule: ${name}` };

		if (entry.paused) {
			return { error: `Schedule "${name}" is paused` };
		}

		const contextDir = scheduler.state?.contextDir || "memory/context/";
		const timeoutMs = scheduler.state?.timeoutMs || DEFAULT_TIMEOUT_MS;
		let contextPrefix = "";
		if (entry.contextFile) {
			try {
				const { readFile } = await import("node:fs/promises");
				const { existsSync } = await import("node:fs");
				const { loadContext } = await import("../memory/context.js");
				if (existsSync(entry.contextFile)) {
					contextPrefix = await readFile(entry.contextFile, "utf-8");
				} else {
					contextPrefix = loadContext(contextDir);
				}
			} catch {
				// Context load failed — continue with empty context
			}
		}

		const sandbox = scheduler.sandbox || (() => ({ stdout: "", stderr: "", exitCode: 1 }));
		const result = await Promise.race([
			sandbox({
				skillName: entry.skill,
				input: entry.input,
				context: contextPrefix,
				permissions: scheduler.state?.skills || [],
			}),
			new Promise((_, reject) =>
				setTimeout(
					() => reject(new Error(`Sandbox execution timed out after ${timeoutMs}ms`)),
					timeoutMs,
				),
			),
		]);

		const endTime = new Date().toISOString();
		entry.lastRun = endTime;
		return result;
	}

	/**
	 * Test helper: set a schedule entry directly on the internal map.
	 * @param {string} name
	 * @param {Object} entry
	 * @returns {void}
	 */
	_testSetEntry(name, entry) {
		this.#scheduleEntry.set(name, entry);
	}
}
