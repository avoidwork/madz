import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

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
						entry.command = `cd ${process.cwd()} && node index.js --message "Run the ${job.skill} skill"`;
					} else if (job.command) {
						entry.command = job.command;
					}

					entries.push(entry);
				} catch {
					// Skip malformed JSON files
				}
			}
		} catch {
			// Directory doesn't exist — return empty manager
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

	/**
	 * Run a schedule immediately via the sandbox or command.
	 * If the entry has a 'skill', uses the sandbox. If it has only a 'command',
	 * spawns the command directly via shell.
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

		const timeoutMs = scheduler.state?.timeoutMs || DEFAULT_TIMEOUT_MS;

		if (entry.command && !entry.skill) {
			const { spawn } = await import("node:child_process");
			return new Promise((resolve) => {
				const child = spawn("/bin/sh", ["-c", entry.command], {
					stdio: ["pipe", "pipe", "pipe"],
				});

				const chunks = { stdout: [], stderr: [] };
				let settled = false;
				const settle = (exitCode) => {
					if (settled) return;
					settled = true;
					entry.lastRun = new Date().toISOString();
					resolve({
						stdout: Buffer.concat(chunks.stdout).toString(),
						stderr: Buffer.concat(chunks.stderr).toString(),
						exitCode,
					});
				};

				child.stdout.on("data", (chunk) => chunks.stdout.push(chunk));
				child.stderr.on("data", (chunk) => chunks.stderr.push(chunk));
				child.on("exit", (code) => settle(code ?? 0));
				child.on("error", () => settle(-1));

				setTimeout(() => {
					child.kill("SIGTERM");
					setTimeout(() => settle(-1), 3000);
				}, timeoutMs);
			});
		}

		const contextDir = scheduler.state?.contextDir || "memory/context/";
		let contextPrefix = "";
		if (entry.contextFile) {
			try {
				const { readFile, access, constants } = await import("node:fs/promises");
				const { loadContext } = await import("../memory/context.js");
				try {
					await access(entry.contextFile, constants.F_OK);
					contextPrefix = await readFile(entry.contextFile, "utf-8");
				} catch {
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
