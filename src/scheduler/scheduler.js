import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../shared/logger.js";
import { buildSkillCommand } from "./cron.js";

/**
 * Schedule manager for CRUD operations on scheduled jobs.
 * Jobs are stored as JSON files in memory/schedules/ and managed via the cronJob tool.
 * This class does not include the in-process clock tick loop — crond handles scheduling.
 */
export class ScheduleManager {
	#scheduleEntry = new Map();

	/**
	 * @param {number} [_maxConcurrent=1] - Deprecated, kept for API compat
	 * @param {Array} [entries] - Optional initial schedule entries
	 */
	constructor(_maxConcurrent = 1, entries = []) {
		for (const entry of entries) {
			this.#scheduleEntry.set(entry.name, { ...entry, paused: false, lastRun: null });
		}
	}

	/**
	 * Load schedule entries from JSON files in the schedules directory.
	 * Reads *.json files, skips entries with enabled: false or malformed data.
	 * For entries with a 'skill' field, the command is set to the reflection-style shell command.
	 * For entries with only a 'command' field, the command is used directly.
	 * @param {string} schedulesDir - Path to the schedules directory
	 * @param {object} [deps] - Dependency injection for testing ({ readFile, readdir })
	 * @returns {Promise<ScheduleManager>} New instance populated with disk entries
	 */
	static async loadFromDisk(schedulesDir, deps = {}) {
		const readFileFn = deps.readFile || readFile;
		const readdirFn = deps.readdir || readdir;
		const entries = [];

		try {
			const files = await readdirFn(schedulesDir);
			for (const file of files) {
				if (!file.endsWith(".json")) continue;
				try {
					const content = await readFileFn(join(schedulesDir, file), "utf-8");
					const job = JSON.parse(content);
					if (job.enabled === false) continue;
					if (!job.name || !job.cron || (!job.skill && !job.command)) continue;

					const entry = {
						name: job.name,
						cron: job.cron,
						input: job.input || {},
						contextFile: "",
						paused: false,
						lastRun: null,
					};

					if (job.skill) {
						entry.skill = job.skill;
						entry.command = buildSkillCommand(job.skill, job.input);
					} else if (job.command) {
						entry.command = job.command;
					}

					entries.push(entry);
				} catch (err) {
					logger.debug(`[scheduler] Skipping malformed schedule file: ${err.message}`);
				}
			}
		} catch (err) {
			logger.debug(`[scheduler] Schedules directory not found: ${err.message}`);
		}

		return new ScheduleManager(undefined, entries);
	}

	/**
	 * Register schedule entries from config-style objects.
	 * @param {Array} entries - Raw schedule entries
	 * @returns {Array<{ name: string, error: string }>}
	 */
	register(entries = []) {
		const results = [];
		for (const entry of entries) {
			if (!entry.name || !entry.cron || (!entry.skill && !entry.command)) {
				results.push({
					name: entry.name,
					error: "Missing required fields (name, cron, skill or command)",
				});
				continue;
			}
			this.#scheduleEntry.set(entry.name, {
				...entry,
				paused: false,
				lastRun: null,
				input: entry.input || {},
				contextFile: entry.contextFile || "",
			});
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
}
