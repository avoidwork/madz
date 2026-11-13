import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
	access,
	constants,
	mkdir,
	writeFile,
	readFile,
	readdir,
	rename,
	unlink,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { Cron, buildSkillCommand } from "../../scheduler/cron.js";
import {
	NAME_PATTERN,
	MAX_COMMAND_LENGTH,
	isValidName,
	isValidCron,
	validateCommand,
} from "../../scheduler/validate.js";
import { logger } from "../../shared/logger.js";
import { loadConfig } from "../../config/loader.js";

const config = loadConfig();

/// -- Constants --

const ACTIONS = ["create", "list", "update", "pause", "resume", "run", "remove"];

const MAX_INPUT_BYTES = 8192;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const KILL_GRACE_MS = 2000;
const DEFAULT_SCRIPT_TIMEOUT_MS = 30000;
const DEFAULT_RUN_TIMEOUT_MS = 5 * 60 * 1000;

/// -- Validation --

/**
 * Validate job input is a plain object of bounded size.
 * @param {unknown} value - Candidate input
 * @returns {string|null} Error message, or null when valid
 */
function validateInput(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return "input must be an object";
	}
	// JSON.stringify throws on circular structures; the caller's catch reports that.
	if (Buffer.byteLength(JSON.stringify(value)) > MAX_INPUT_BYTES) {
		return `input must serialize to at most ${MAX_INPUT_BYTES} bytes`;
	}
	return null;
}

/// -- Process execution --

/**
 * Spawn a child, collect capped output, and enforce a timeout with SIGTERM then SIGKILL.
 * The child runs in its own process group so the whole tree is terminated.
 * @param {string} file - Executable
 * @param {string[]} args - Arguments
 * @param {object} options - Execution options
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {string} options.cwd - Working directory
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number, timedOut: boolean, error?: string }>}
 */
function execChild(file, args, { timeout, cwd }) {
	return new Promise((resolvePromise) => {
		const out = { stdout: [], stderr: [] };
		const sizes = { stdout: 0, stderr: 0 };
		let settled = false;
		let timedOut = false;
		let spawnError;
		let killTimer;

		const child = spawn(file, args, {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
			detached: true,
		});

		const killGroup = (signal) => {
			try {
				process.kill(-child.pid, signal);
			} catch (_err) {
				try {
					child.kill(signal);
				} catch (_err2) {
					// already gone
				}
			}
		};

		const settle = (exitCode) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			clearTimeout(killTimer);
			const result = {
				stdout: Buffer.concat(out.stdout).toString(),
				stderr: Buffer.concat(out.stderr).toString(),
				exitCode,
				timedOut,
			};
			if (spawnError) result.error = spawnError;
			resolvePromise(result);
		};

		const timer = setTimeout(() => {
			timedOut = true;
			killGroup("SIGTERM");
			killTimer = setTimeout(() => {
				killGroup("SIGKILL");
				// Give the close event a moment, then stop waiting on a stuck child.
				killTimer = setTimeout(() => settle(-1), KILL_GRACE_MS);
			}, KILL_GRACE_MS);
		}, timeout);

		for (const stream of ["stdout", "stderr"]) {
			child[stream].on("data", (chunk) => {
				if (sizes[stream] >= MAX_OUTPUT_BYTES) return;
				const room = MAX_OUTPUT_BYTES - sizes[stream];
				const piece = chunk.length > room ? chunk.subarray(0, room) : chunk;
				sizes[stream] += piece.length;
				out[stream].push(piece);
			});
		}

		child.on("error", (err) => {
			spawnError = err.message;
			settle(-1);
		});

		// "close" fires after stdio has drained, so no output is lost.
		child.on("close", (code) => settle(code ?? -1));
	});
}

/**
 * Run a script via spawn with stdout/stderr collection and timeout.
 * @param {string} scriptPath - Path to the script (must be executable)
 * @param {string[]} [args=[]] - Command-line arguments
 * @param {object} [options] - Execution options
 * @param {number} [options.timeout=30000] - Timeout in milliseconds
 * @param {string} [options.cwd] - Working directory
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number, timedOut: boolean, error?: string }>}
 */
export function runScript(scriptPath, args = [], options = {}) {
	const { timeout = DEFAULT_SCRIPT_TIMEOUT_MS, cwd = config.cwd } = options;
	return execChild(scriptPath, args, { timeout, cwd });
}

/**
 * Run a shell command line (the same string cron would run) with a timeout.
 * @param {string} command - Shell command
 * @param {object} [options] - Execution options
 * @param {number} [options.timeout] - Timeout in milliseconds
 * @param {string} [options.cwd] - Working directory
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number, timedOut: boolean, error?: string }>}
 */
function runCommand(command, options = {}) {
	const { timeout = DEFAULT_RUN_TIMEOUT_MS, cwd = config.cwd } = options;
	return execChild("/bin/sh", ["-c", command], { timeout, cwd });
}

/// -- Skill script lookup --

/**
 * Locate the main script file for a skill.
 * System skills (.skills/) are searched first and shadow user skills (skills/).
 * @param {string} skillName - Skill name (must match the job/skill name pattern)
 * @param {string|string[]} [baseDir=[".skills", "skills"]] - Base directory or array of directories to search
 * @returns {Promise<string|null>} Path to the main script, or null
 */
export async function findSkillScript(skillName, baseDir = [".skills", "skills"]) {
	if (!isValidName(skillName)) return null;
	const dirs = typeof baseDir === "string" ? [baseDir] : baseDir;

	const candidates = [
		"scripts/run.sh",
		"scripts/run.py",
		"scripts/run.js",
		"scripts/run.bash",
		"run.sh",
		"run.py",
		"run.js",
		"run.bash",
	];

	for (const dir of dirs) {
		for (const candidate of candidates) {
			const fullPath = join(dir, skillName, candidate);
			try {
				await access(fullPath, constants.F_OK);
				return fullPath;
			} catch (err) {
				if (err.code !== "ENOENT" && err.code !== "ENOTDIR") {
					logger.debug(`[cron] Cannot access ${fullPath}: ${err.message}`);
				}
			}
		}
	}

	return null;
}

/// -- Job persistence --

/** @type {Map<string, Promise<unknown>>} Per-file operation queues */
const locks = new Map();

/**
 * Serialize async operations that touch the same job file.
 * @template T
 * @param {string} key - Lock key (the job file path)
 * @param {() => Promise<T>} fn - Operation
 * @returns {Promise<T>}
 */
function withLock(key, fn) {
	const previous = locks.get(key) ?? Promise.resolve();
	const run = previous.then(fn, fn);
	const tail = run.catch(() => {});
	locks.set(key, tail);
	tail.then(() => {
		if (locks.get(key) === tail) locks.delete(key);
	});
	return run;
}

/**
 * Absolute path of a job's JSON file.
 * @param {string} name - Validated job name
 * @param {string} schedulesDir - Schedules directory
 * @returns {string}
 */
function jobPath(name, schedulesDir) {
	return join(schedulesDir, `${name}.json`);
}

/**
 * Load a job from disk.
 * A missing file yields null; unreadable or corrupt files throw so callers never
 * mistake damage for absence (and overwrite it).
 * @param {string} name - Validated job name
 * @param {string} schedulesDir - Directory to load from
 * @returns {Promise<object|null>}
 */
async function loadJob(name, schedulesDir) {
	let content;
	try {
		content = await readFile(jobPath(name, schedulesDir), "utf-8");
	} catch (err) {
		if (err.code === "ENOENT") return null;
		throw err;
	}
	try {
		return JSON.parse(content);
	} catch (err) {
		throw new Error(`Job file "${name}.json" is corrupt: ${err.message}`);
	}
}

/**
 * Save a job atomically (write to a temp file, then rename over the target).
 * @param {object} job - Job object
 * @param {string} schedulesDir - Directory to save to
 * @returns {Promise<void>}
 */
async function saveJob(job, schedulesDir) {
	await mkdir(schedulesDir, { recursive: true });
	const filePath = jobPath(job.name, schedulesDir);
	const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
	try {
		await writeFile(tmpPath, JSON.stringify(job, null, 2), "utf-8");
		await rename(tmpPath, filePath);
	} catch (err) {
		await unlink(tmpPath).catch(() => {});
		throw err;
	}
}

/**
 * List all jobs from disk, sorted by name. Corrupt files are skipped with a warning.
 * @param {string} schedulesDir - Directory to list from
 * @returns {Promise<{ jobs: object[] }>}
 */
async function listJobs(schedulesDir) {
	let files;
	try {
		files = (await readdir(schedulesDir)).filter((f) => f.endsWith(".json"));
	} catch (err) {
		if (err.code === "ENOENT") return { jobs: [] };
		throw err;
	}
	const loaded = await Promise.all(
		files.map(async (file) => {
			const name = file.slice(0, -".json".length);
			if (!isValidName(name)) return null;
			try {
				return await loadJob(name, schedulesDir);
			} catch (err) {
				logger.warn(`[cronJob] Skipping unreadable job "${name}": ${err.message}`);
				return null;
			}
		}),
	);
	const jobs = loaded.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
	return { jobs };
}

/// -- Crontab sync helpers --

/**
 * Whether a crontab error just means there is no crontab to modify.
 * @param {string|undefined} error - Error text from the cron module
 * @returns {boolean}
 */
function isCrontabUnavailable(error) {
	return typeof error === "string" && /not available/i.test(error);
}

/**
 * Register a job in the crontab.
 * @param {object} cronModule - Cron module
 * @param {object} job - Job
 * @returns {Promise<string|null>} Error message, or null on success
 */
async function crontabAdd(cronModule, job) {
	const res = await cronModule.add({ name: job.name, cron: job.cron, command: job.command });
	return res?.error ? `Failed to register "${job.name}" in crontab: ${res.error}` : null;
}

/**
 * Remove a job from the crontab. An unavailable crontab counts as success because
 * there is nothing installed to remove.
 * @param {object} cronModule - Cron module
 * @param {string} name - Job name
 * @returns {Promise<string|null>} Error message, or null on success
 */
async function crontabRemove(cronModule, name) {
	const res = await cronModule.remove(name);
	if (res?.error && !isCrontabUnavailable(res.error)) {
		return `Failed to remove "${name}" from crontab: ${res.error}`;
	}
	return null;
}

/// -- Running jobs --

/**
 * Run a job now, using the same command cron would run, and record the outcome.
 * Paused jobs are refused.
 * @param {object} job - Job to run
 * @param {string} schedulesDir - Directory the job file lives in
 * @param {object} [options] - Runtime options
 * @param {number} [options.runTimeout] - Timeout in milliseconds
 * @returns {Promise<{ ok: boolean, error?: string, result?: object }>}
 */
async function runJob(job, schedulesDir, options = {}) {
	if (!job.enabled) {
		return { ok: false, error: `Job "${job.name}" is paused` };
	}

	const command = job.command || (job.skill ? buildSkillCommand(job.skill, job.input) : null);
	if (!command) {
		return { ok: false, error: `Job "${job.name}" has no command or skill to run` };
	}

	const result = await runCommand(command, { timeout: options.runTimeout });
	const ok = result.exitCode === 0 && !result.timedOut;

	await withLock(jobPath(job.name, schedulesDir), async () => {
		// Reload so concurrent edits made while the command ran are not clobbered.
		const fresh = (await loadJob(job.name, schedulesDir)) ?? job;
		const now = new Date().toISOString();
		fresh.lastRun = now;
		fresh.lastExitCode = result.exitCode;
		fresh.lastStatus = result.timedOut ? "timeout" : ok ? "success" : "failure";
		fresh.updatedAt = now;
		await saveJob(fresh, schedulesDir);
	});

	if (ok) return { ok: true, result };
	const reason = result.timedOut
		? "timed out"
		: result.error
			? `failed to start: ${result.error}`
			: `exited with code ${result.exitCode}`;
	return { ok: false, error: `Job "${job.name}" ${reason}`, result };
}

/// -- Core cron tool --

/**
 * Whether a stored job's command was generated from its skill/input (and so must be
 * regenerated when they change) rather than supplied by the caller.
 * @param {object} job - Stored job
 * @returns {boolean}
 */
function hasDerivedCommand(job) {
	if (typeof job.commandDerived === "boolean") return job.commandDerived;
	return Boolean(job.skill) && job.command === buildSkillCommand(job.skill, job.input);
}

/**
 * Manage cron jobs with CRUD actions.
 * The crontab is changed before the job file so a failure never leaves a job on disk
 * that was reported as created, and changes are rolled back if the save fails.
 * @param {object} input - Tool input with action and parameters
 * @param {object} [options] - Runtime options
 * @param {string} [options.schedulesDir] - Directory for job persistence (default "memory/schedules/")
 * @param {object} [options.cron] - Cron module for testing
 * @param {number} [options.runTimeout] - Timeout for the run action in milliseconds
 * @returns {Promise<object>} Structured result object
 */
export async function cronJobImpl(input, options) {
	const action = input?.action;
	const schedulesDir = resolve(options?.schedulesDir || "memory/schedules/");
	const cronModule = options?.cron || Cron;

	if (!ACTIONS.includes(action)) {
		return {
			ok: false,
			error: `Unknown action: "${action}". Valid actions: ${ACTIONS.join(", ")}`,
		};
	}

	try {
		if (action === "list") {
			return { ok: true, ...(await listJobs(schedulesDir)) };
		}

		const { name } = input;
		if (action === "create") {
			if (!name || !input.cron || (!input.skill && !input.command)) {
				return { ok: false, error: "create requires: name, cron, and either skill or command" };
			}
		} else if (!name) {
			return { ok: false, error: `${action} requires: name` };
		}
		if (!isValidName(name)) {
			return {
				ok: false,
				error: `Invalid job name: "${name}". Use 1-64 letters, digits, "_" or "-", starting with a letter or digit.`,
			};
		}

		if (action === "run") {
			// Load under the lock but execute outside it, so a long run does not block
			// pause/remove. runJob re-takes the lock only to record the result.
			const job = await withLock(jobPath(name, schedulesDir), () => loadJob(name, schedulesDir));
			if (!job) return { ok: false, error: `Job "${name}" not found` };
			return await runJob(job, schedulesDir, { runTimeout: options?.runTimeout });
		}

		return await withLock(jobPath(name, schedulesDir), () =>
			handleAction(action, input, { schedulesDir, cronModule }),
		);
	} catch (err) {
		return { ok: false, error: `Cron job error: ${err.message}` };
	}
}

/**
 * Execute a single name-scoped action while holding the job's lock.
 * @param {string} action - create | update | pause | resume | remove
 * @param {object} input - Tool input
 * @param {object} ctx - Context
 * @param {string} ctx.schedulesDir - Schedules directory
 * @param {object} ctx.cronModule - Cron module
 * @returns {Promise<object>}
 */
async function handleAction(action, input, { schedulesDir, cronModule }) {
	const { name } = input;
	const existing = await loadJob(name, schedulesDir);

	if (action === "create") {
		const { cron, skill, command, input: jobInput = {} } = input;
		if (!isValidCron(cron)) {
			return {
				ok: false,
				error: `Invalid cron expression: "${cron}". Must be 5 fields (minute hour day month weekday) with valid ranges`,
			};
		}
		if (skill !== undefined && !isValidName(skill)) {
			return { ok: false, error: `Invalid skill name: "${skill}"` };
		}
		if (command !== undefined) {
			const commandError = validateCommand(command);
			if (commandError) return { ok: false, error: `Invalid ${commandError}` };
		}
		const inputError = validateInput(jobInput);
		if (inputError) return { ok: false, error: `Invalid ${inputError}` };
		if (existing) {
			return { ok: false, error: `Job "${name}" already exists. Use "update" to modify it.` };
		}

		const now = new Date().toISOString();
		const job = {
			name,
			cron,
			skill,
			command: command || buildSkillCommand(skill, jobInput),
			commandDerived: !command,
			input: jobInput,
			enabled: true,
			createdAt: now,
			updatedAt: now,
		};

		const addError = await crontabAdd(cronModule, job);
		if (addError) return { ok: false, error: addError };
		try {
			await saveJob(job, schedulesDir);
		} catch (err) {
			await crontabRemove(cronModule, name).catch(() => {});
			throw err;
		}
		return { ok: true, message: `Job "${name}" created`, job };
	}

	if (!existing) {
		return {
			ok: false,
			error:
				action === "update"
					? `Job "${name}" not found. Use "create" to add it.`
					: `Job "${name}" not found`,
		};
	}

	switch (action) {
		case "update": {
			const { cron: newCron, skill: newSkill, command: newCommand, input: newInput } = input;
			const job = { ...existing };
			const before = { cron: job.cron, command: job.command };
			const derived = hasDerivedCommand(existing);

			if (newCron !== undefined) {
				if (!isValidCron(newCron)) {
					return { ok: false, error: `Invalid cron expression: "${newCron}".` };
				}
				job.cron = newCron;
			}
			if (newSkill !== undefined) {
				if (!isValidName(newSkill)) {
					return { ok: false, error: `Invalid skill name: "${newSkill}"` };
				}
				job.skill = newSkill;
			}
			if (newInput !== undefined) {
				const inputError = validateInput(newInput);
				if (inputError) return { ok: false, error: `Invalid ${inputError}` };
				job.input = { ...job.input, ...newInput };
			}

			if (newCommand !== undefined && newCommand !== "") {
				const commandError = validateCommand(newCommand);
				if (commandError) return { ok: false, error: `Invalid ${commandError}` };
				job.command = newCommand;
				job.commandDerived = false;
			} else if (
				newCommand === "" ||
				(derived && (newSkill !== undefined || newInput !== undefined))
			) {
				// An empty command, or a skill/input change on a derived command, regenerates it.
				if (!job.skill) {
					return { ok: false, error: "Cannot derive a command without a skill" };
				}
				job.command = buildSkillCommand(job.skill, job.input);
				job.commandDerived = true;
			}

			job.updatedAt = new Date().toISOString();

			const scheduleChanged = job.cron !== before.cron || job.command !== before.command;
			if (job.enabled && scheduleChanged) {
				const addError = await crontabAdd(cronModule, job);
				if (addError) return { ok: false, error: addError };
			}
			try {
				await saveJob(job, schedulesDir);
			} catch (err) {
				if (job.enabled && scheduleChanged) {
					await crontabAdd(cronModule, existing).catch(() => {});
				}
				throw err;
			}
			return { ok: true, message: `Job "${name}" updated`, job };
		}

		case "pause": {
			const removeError = await crontabRemove(cronModule, name);
			if (removeError) return { ok: false, error: removeError };
			const job = { ...existing, enabled: false, updatedAt: new Date().toISOString() };
			try {
				await saveJob(job, schedulesDir);
			} catch (err) {
				if (existing.enabled) await crontabAdd(cronModule, existing).catch(() => {});
				throw err;
			}
			return { ok: true, message: `Job "${name}" paused`, job };
		}

		case "resume": {
			const job = { ...existing, enabled: true, updatedAt: new Date().toISOString() };
			if (!job.command && job.skill) job.command = buildSkillCommand(job.skill, job.input);
			const addError = await crontabAdd(cronModule, job);
			if (addError) return { ok: false, error: addError };
			try {
				await saveJob(job, schedulesDir);
			} catch (err) {
				if (!existing.enabled) await crontabRemove(cronModule, name).catch(() => {});
				throw err;
			}
			return { ok: true, message: `Job "${name}" resumed`, job };
		}

		case "remove": {
			const removeError = await crontabRemove(cronModule, name);
			if (removeError) return { ok: false, error: removeError };
			await unlink(jobPath(name, schedulesDir));
			return { ok: true, message: `Job "${name}" removed` };
		}
	}

	return { ok: false, error: `Unhandled action: "${action}"` };
}

/**
 * LangChain tool wrapper around {@link cronJobImpl}.
 */
export const cronJob = tool(
	(input) => cronJobImpl(input, { schedulesDir: config.memory.schedulesDir }),
	{
		name: "cronJob",
		description:
			"Manage scheduled cron jobs persisted to memory/schedules/. Actions: create, list, update, pause, resume, run, remove. " +
			"Job metadata is stored as JSON files and installed in the system crontab (pause removes the crontab entry, resume restores it). " +
			"`run` executes the job's command immediately in a shell, exactly as cron would. " +
			"Job and skill names must be 1-64 letters, digits, '_' or '-'. Cron expressions have 5 fields. " +
			"Registered only when the network:outbound permission is granted.",
		schema: z.object({
			action: z.enum(ACTIONS).describe("Action to perform"),
			name: z
				.string()
				.regex(NAME_PATTERN)
				.optional()
				.describe("Job name (required for create, update, pause, resume, run, remove)"),
			cron: z
				.string()
				.max(100)
				.optional()
				.describe("5-field cron expression (required for create, optional for update)"),
			skill: z
				.string()
				.regex(NAME_PATTERN)
				.optional()
				.describe("Skill name to trigger (required for create if command not provided)"),
			command: z
				.string()
				.max(MAX_COMMAND_LENGTH)
				.optional()
				.describe(
					"Single-line shell command to execute (required for create if skill not provided; empty string on update re-derives it from the skill)",
				),
			input: z.record(z.string(), z.unknown()).optional().describe("Job input parameters"),
		}),
	},
);
