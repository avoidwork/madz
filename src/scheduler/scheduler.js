import { parseScheduleEntry } from "./parser.js";
import { ScheduleQueue } from "./queue.js";
import { runScheduledSkill } from "./runner.js";
import { logScheduleResult } from "./logger.js";
import { matchesCron } from "./matcher.js";

/**
 * Schedule manager that ties together parsing, queueing, and execution.
 */
export class ScheduleManager {
	#scheduleEntry = new Map();
	#queue;
	#running = false;
	#tickId = null;

	/**
	 * @param {number} [maxConcurrent=1] - Maximum concurrent schedule runs
	 */
	constructor(maxConcurrent = 1) {
		this.#queue = new ScheduleQueue(maxConcurrent);
	}

	/**
	 * Parse and register multiple schedule entries from config.
	 * @param {Array} entries - Raw schedule entries from config.yaml
	 * @returns {Array<{ name: string, error: string }>}
	 */
	register(entries = []) {
		const results = [];
		for (const entry of entries) {
			const parsed = parseScheduleEntry(entry);
			if (parsed.valid) {
				this.#scheduleEntry.set(parsed.parsed.name, parsed.parsed);
			} else {
				results.push({ name: entry.name, error: parsed.error });
			}
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
			schedules.push({
				...entry,
				queued: this.#queue.getQueueLength(),
			});
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
	 * Run a schedule immediately.
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

		const result = await runScheduledSkill(entry, scheduler.sandbox, scheduler.state);
		const endTime = new Date().toISOString();

		if (result && result.exitCode !== undefined) {
			await logScheduleResult({
				scheduleName: entry.name,
				cron: entry.cron,
				startTime: entry.lastRun || endTime,
				endTime,
				exitCode: result.exitCode,
				stdout: result.stdout || "",
				stderr: result.stderr || "",
			});
		}

		entry.lastRun = endTime;
		return result;
	}

	/**
	 * Start the scheduler clock (checks schedules periodically).
	 * Only valid for inprocess mode — system mode uses external crontab.
	 * @param {Object} scheduler - The full scheduler instance
	 * @param {number} [intervalMs=60000] - Check interval in ms
	 */
	start(scheduler, intervalMs = 60000) {
		this.#running = true;
		this.#tickId = setInterval(() => this.#clockTick(), intervalMs);
		this.#clockTick();
	}

	/**
	 * Stop the scheduler clock.
	 */
	stop() {
		this.#running = false;
		if (this.#tickId) {
			clearInterval(this.#tickId);
			this.#tickId = null;
		}
		this.#queue.clear();
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

	/**
	 * Clock tick: check schedule expressions and enqueue triggered tasks.
	 */
	#clockTick() {
		if (!this.#running) return;

		const now = new Date();
		for (const [, entry] of this.#scheduleEntry) {
			if (entry.paused) continue;

			try {
				if (matchesCron(entry.cron, now)) {
					const dedup = {
						entryName: entry.name,
						...entry,
						triggeredAt: now.toISOString(),
					};
					const { queued } = this.#queue.enqueue(dedup);
					if (queued) {
						entry.lastRun = now.toISOString();
					}
				}
			} catch {
				// Single entry failure doesn't block remaining checks
			}
		}
	}
}

export { matchesCron } from "./matcher.js";
