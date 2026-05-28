import { parseScheduleEntry } from "./parser.js";
import { ScheduleQueue } from "./queue.js";
import { runScheduledSkill } from "./runner.js";
import { logScheduleResult } from "./logger.js";

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
				queued: this.#queue.getLength(),
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
		entry.paused = entry.enabled !== false;
		return true;
	}

	/**
	 * Run a schedule immediately.
	 * @param {string} name - Schedule name
	 * @param {Object} scheduler - The full scheduler instance for sandbox access
	 * @returns {Promise<Object>} Execution result
	 */
	async runNow(name, _scheduler) {
		const entry = this.#scheduleEntry.get(name);
		if (!entry) return { error: `Unknown schedule: ${name}` };

		if (entry.paused) {
			return { error: `Schedule "${name}" is paused` };
		}

		const result = await runScheduledSkill(entry, _scheduler.sandbox, _scheduler.state);
		const endTime = new Date().toISOString();

		if (result && result.exitCode !== undefined) {
			logScheduleResult({
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
	 * @param {Object} scheduler - The full scheduler instance
	 * @param {number} [intervalMs=60000] - Check interval in ms
	 */
	start(scheduler, intervalMs = 60000) {
		this.#running = true;
		this.#tickId = setInterval(() => this.#clockTick(scheduler), intervalMs);
		// Also run once immediately
		this.#clockTick(scheduler);
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
	 * Clock tick: check schedule expressions and enqueue triggered tasks.
	 * @param {Object} scheduler - The scheduler instance
	 */
	#clockTick(_scheduler) {
		if (!this.#running) return;

		const now = new Date();
		for (const [, entry] of this.#scheduleEntry) {
			if (entry.paused) continue;

			// Basic cron matching (minute-level)
			if (shouldRun(entry.cron, now)) {
				this.#queue.enqueue({ ...entry, triggeredAt: now.toISOString() });
				entry.lastRun = now.toISOString();
			}
		}
	}
}

/**
 * Simple cron matcher — checks if a schedule should run at the given time.
 * Basic minute-level matching for the cron expression.
 * @param {string} cron - Cron expression
 * @param {Date} now - Current date/time
 * @returns {boolean}
 */
export function shouldRun(cron, now) {
	const fields = cron.trim().split(/\s+/);
	const [minute, hour] = fields.length >= 2 ? [fields[0], fields[1]] : [fields[0], "*"];

	return matchesField(now.getMinutes(), minute) && matchesField(now.getHours(), hour);
}

/**
 * Check if a numeric value matches a cron field.
 * @param {number} value - The current value (minute/hour/etc.)
 * @param {string} field - Cron field expression
 * @returns {boolean}
 */
function matchesField(value, field) {
	if (field === "*") return true;
	if (/\//.test(field)) {
		const [start, step] = field.split("/");
		const stepNum = parseInt(step, 10);
		const startNum = start === "*" ? 0 : parseInt(start, 10);
		return value >= startNum && (value - startNum) % stepNum === 0;
	}
	if (/-/.test(field)) {
		const [from, to] = field.split("-").map(Number);
		return value >= from && value <= to;
	}
	try {
		return value === parseInt(field, 10);
	} catch {
		return false;
	}
}
