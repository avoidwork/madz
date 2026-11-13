import { exec } from "node:child_process";
import { chmod, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../shared/logger.js";
import { isValidCron, isValidName, validateCommand } from "./validate.js";

// Block delimiters for madz-managed crontab entries
const BLOCK_START = "# --- BEGIN madz-schedules ---";
const BLOCK_END = "# --- END madz-schedules ---";
const NAME_MARKER = "# madz-schedule: ";

// Default reflection-daily job definition (its command is built at call time from the cwd)
const REFLECTION_JOB = {
	name: "reflection-daily",
	cron: "30 23 * * *",
	skill: "reflection",
	enabled: true,
};

const ENV_VAR_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SAFE_SHELL_WORD = /^[A-Za-z0-9_./:@%+=,-]+$/;

/** @type {string|undefined} */
let _logPath = undefined;

/** @type {Promise<unknown>} Tail of the in-process crontab mutation queue */
let _queue = Promise.resolve();

/**
 * Serialize crontab read-modify-write operations within this process.
 * Errors still reach the caller through the returned promise; the queue itself never rejects.
 * Cross-process races (e.g. a cron-fired `node index.js` running sync) are not prevented.
 * @template T
 * @param {() => Promise<T>} fn - Operation to run once earlier operations finished
 * @returns {Promise<T>} Result of fn
 */
function serialize(fn) {
	const run = _queue.then(fn);
	_queue = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}

/**
 * Quote a string for use as one POSIX shell word. Strings made only of safe characters are
 * returned unchanged to keep generated commands readable.
 * @param {string} value - Raw string
 * @returns {string} Shell-safe word
 */
function shellQuote(value) {
	const str = String(value);
	return SAFE_SHELL_WORD.test(str) ? str : `'${str.replace(/'/g, "'\\''")}'`;
}

/**
 * Write the .env.cron file with all environment variables from process.env.
 * Called on startup so cron jobs can source it for required variables.
 * Idempotent and atomic (temp file + rename, mode 0o600). Variables whose names are not valid
 * shell identifiers are skipped. When the process was itself started by a cron job
 * (MADZ_CRON=1) the file is left untouched, because cron's minimal environment would
 * otherwise overwrite the full one.
 * @param {string} cwd - The current working directory path
 * @returns {Promise<{ written: boolean, skipped?: boolean, error?: string }>} Write result
 */
export async function writeEnvCron(cwd) {
	if (process.env.MADZ_CRON === "1") {
		logger.debug("[cron] Started by cron; not overwriting .env.cron");
		return { written: false, skipped: true };
	}

	const envPath = join(cwd, ".env.cron");
	const lines = [];

	for (const [key, value] of Object.entries(process.env)) {
		if (value === undefined) continue;
		if (!ENV_VAR_NAME.test(key)) {
			logger.debug(`[cron] Skipping env var with invalid name: ${JSON.stringify(key)}`);
			continue;
		}
		// Escape single quotes and wrap in single quotes for shell safety
		lines.push(`export ${key}='${value.replace(/'/g, "'\\''")}'`);
	}

	if (lines.length === 0) {
		return { written: false };
	}

	const tmpPath = join(cwd, `.env.cron.${process.pid}.tmp`);
	try {
		await writeFile(tmpPath, lines.join("\n") + "\n", { mode: 0o600 });
		await chmod(tmpPath, 0o600);
		await rename(tmpPath, envPath);
		logger.debug(`[cron] Wrote .env.cron with ${lines.length} variables`);
		return { written: true };
	} catch (err) {
		await unlink(tmpPath).catch((unlinkErr) => {
			if (unlinkErr.code !== "ENOENT") {
				logger.debug(`[cron] Could not remove temp env file: ${unlinkErr.message}`);
			}
		});
		const msg = err instanceof Error ? err.message : String(err);
		logger.warn(`[cron] Failed to write .env.cron: ${msg}`);
		return { written: false, error: msg };
	}
}

/**
 * Execute a shell command with optional stdin input.
 * On failure the rejection carries the command's `stdout` and `stderr`.
 * @param {string} cmd - Shell command to execute
 * @param {object} [opts={}] - Options
 * @param {string} [opts.input] - Data to write to stdin
 * @returns {Promise<{stdout: string, stderr: string}>} Command output
 */
function runExec(cmd, opts = {}) {
	return new Promise((resolve, reject) => {
		const child = exec(cmd, opts, (err, stdout, stderr) => {
			if (err) reject(Object.assign(err, { stdout, stderr }));
			else resolve({ stdout, stderr });
		});
		if (opts.input) {
			child.stdin.write(opts.input);
		}
		child.stdin.end();
	});
}

/** @type {typeof import("node:child_process").exec|undefined} */
let _execOverride = runExec;

/**
 * Set a custom exec function for testing.
 * @param {typeof import("node:child_process").exec} fn - Custom exec implementation
 */
export function setExecOverride(fn) {
	_execOverride = fn;
}

/**
 * Sanitize a command string for safe interpolation into crontab entries.
 * Escapes unescaped `%` (cron turns an unescaped `%` into a newline). Commands containing
 * CR, LF or NUL are rejected rather than rewritten, since stripping them would silently
 * merge lines into a different command. Shell special characters ($, `, |, ;) are
 * preserved — they are handled by the shell at execution time.
 * @param {string} command - The command string to sanitize
 * @returns {string} The sanitized command
 * @throws {Error} When the command contains CR, LF or NUL
 */
export function sanitizeCrontabCommand(command) {
	if (/[\r\n\0]/.test(command)) {
		throw new Error("command must not contain newlines or null bytes");
	}
	return command.replace(/(?<!\\)%/g, "\\%");
}

/**
 * Prepare a command for crontab entry.
 * Produces `. <cwd>/.env.cron 2>/dev/null || true && export MADZ_CRON=1 && <command>` so cron
 * jobs source the env file first and mark their process as cron-started (see writeEnvCron).
 * With a log path the command is wrapped as `( <command> ) >> '<logPath>' 2>&1`.
 * @param {string} command - The command string to prepare
 * @param {string} [logPath] - Optional log file path; stdout and stderr are appended to it
 * @returns {string} The prepared single-line command
 * @throws {Error} When the command contains CR, LF or NUL
 */
export function prepareCrontabCommand(command, logPath) {
	const body = logPath ? `( ${command} ) >> ${shellQuote(logPath)} 2>&1` : command;
	const envFile = shellQuote(join(process.cwd(), ".env.cron"));
	return sanitizeCrontabCommand(
		`. ${envFile} 2>/dev/null || true && export MADZ_CRON=1 && ${body}`,
	);
}

/**
 * Escape a string for safe use inside a double-quoted shell string.
 * @param {string} value - Raw value
 * @returns {string} Value with \, ", $ and ` backslash-escaped
 */
function escapeDoubleQuoted(value) {
	return String(value).replace(/[\\"$`]/g, "\\$&");
}

/**
 * Build the shell command that runs a skill through the madz CLI.
 * The skill name and serialized input are escaped so they cannot break out of
 * the double-quoted --message argument; the cwd is shell-quoted when needed.
 * @param {string} skill - Skill name
 * @param {object} [input] - Job input
 * @returns {string} Shell command
 */
export function buildSkillCommand(skill, input) {
	const inputStr = input && Object.keys(input).length ? ` ${JSON.stringify(input)}` : "";
	return `cd ${shellQuote(process.cwd())} && node index.js --message "${escapeDoubleQuoted(`Run the ${skill} skill${inputStr}`)}"`;
}

/**
 * Extract the job name from a block line's trailing comment.
 * @param {string} line - Crontab block line
 * @returns {string|null} Name, or null when the line has no madz comment
 */
function entryName(line) {
	const idx = line.indexOf(NAME_MARKER);
	return idx === -1 ? null : line.slice(idx + NAME_MARKER.length).trim();
}

/**
 * Drop block lines belonging to the named job.
 * @param {string[]} lines - Block lines
 * @param {string} name - Job name
 * @returns {string[]} Remaining lines
 */
function withoutName(lines, name) {
	return lines.filter((line) => entryName(line) !== name);
}

/**
 * Check a disk job against the same rules the cronJob tool enforces.
 * @param {{ name: unknown, cron: unknown }} job - Parsed job file
 * @param {string} command - Resolved command
 * @returns {string|null} Reason the job is invalid, or null
 */
function jobError(job, command) {
	if (!isValidName(job.name)) return "invalid job name";
	if (!isValidCron(job.cron)) return "invalid cron expression";
	const commandError = validateCommand(command);
	return commandError ? `invalid ${commandError}` : null;
}

/**
 * Cron manages madz schedule entries in the user's system crontab.
 * Entries are written as: <cron>  <command>  # madz-schedule: <name>
 *
 * Every read-modify-write is serialized in-process. A failed `crontab -l` (anything other
 * than "no crontab for <user>") or a malformed madz block aborts the operation without
 * writing, so the user's own entries are never lost.
 */
export const Cron = {
	/**
	 * Set the log file path for crontab output redirection.
	 * @param {string} logPath - Absolute path to the log file
	 */
	setLogPath(logPath) {
		_logPath = logPath;
	},

	/**
	 * Check if the system crontab binary is available.
	 * @returns {Promise<{ available: boolean, error?: string }>} Availability
	 */
	async isAvailable() {
		try {
			await _execOverride("which crontab", { stdio: ["pipe", "pipe", "pipe"] });
			return { available: true };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return { available: false, error: `crontab not available: ${msg}` };
		}
	},

	/**
	 * Read the current user crontab. Only the genuine "no crontab for <user>" failure is
	 * treated as an empty crontab.
	 * @returns {Promise<string>} Crontab content (may be empty)
	 * @throws {Error} When `crontab -l` fails for any other reason
	 */
	async _readCrontab() {
		try {
			const { stdout } = await _execOverride("crontab -l", {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
			});
			return (stdout || "").trim();
		} catch (err) {
			if (/no crontab for/i.test(`${err?.stderr ?? ""}\n${err?.message ?? ""}`)) return "";
			throw new Error(`Failed to read crontab: ${err?.message ?? err}`);
		}
	},

	/**
	 * Write the crontab via `crontab -`.
	 * @param {string} content - Full crontab text
	 * @returns {Promise<void>} Resolves when written
	 */
	async _writeCrontab(content) {
		// Ensure content ends with newline; empty content gets a newline to avoid crontab errors
		const safeContent = content.endsWith("\n") ? content : content + "\n";
		await _execOverride("crontab -", { input: safeContent, stdio: ["pipe", "pipe", "pipe"] });
	},

	/**
	 * Extract madz-managed block lines and outside lines from crontab content.
	 * @param {string} crontab - Raw crontab content
	 * @returns {{ outsideLines: string[], blockLines: string[] }} Split lines
	 * @throws {Error} When a BEGIN marker has no matching END, or END has no BEGIN
	 */
	_splitBlock(crontab) {
		const outsideLines = [];
		const blockLines = [];
		let inBlock = false;

		for (const line of crontab.split("\n")) {
			if (line === BLOCK_START) {
				if (inBlock) throw new Error("Malformed crontab: nested madz-schedules BEGIN marker");
				inBlock = true;
			} else if (line === BLOCK_END) {
				if (!inBlock) throw new Error("Malformed crontab: madz-schedules END without BEGIN");
				inBlock = false;
			} else if (inBlock) {
				blockLines.push(line);
			} else {
				outsideLines.push(line);
			}
		}

		if (inBlock) throw new Error("Malformed crontab: madz-schedules BEGIN without END");
		return { outsideLines, blockLines };
	},

	/**
	 * Read and split the crontab.
	 * @returns {Promise<{ crontab: string, outsideLines: string[], blockLines: string[] }>} State
	 * @throws {Error} When reading fails or the madz block is malformed
	 */
	async _loadState() {
		const crontab = await this._readCrontab();
		return { crontab, ...this._splitBlock(crontab) };
	},

	/**
	 * Write outside lines plus the madz block, unless that equals the current crontab.
	 * @param {string} crontab - Current crontab text (as read)
	 * @param {string[]} outsideLines - Lines outside the block
	 * @param {string[]} blockLines - Lines for the madz block (block omitted when empty)
	 * @returns {Promise<boolean>} True when a write happened
	 */
	async _commit(crontab, outsideLines, blockLines) {
		const lines = [...outsideLines];
		while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
			lines.pop();
		}
		if (blockLines.length > 0) {
			lines.push(BLOCK_START, ...blockLines, BLOCK_END);
		}
		const next = lines.join("\n");
		if (next.trim() === crontab) return false;
		await this._writeCrontab(next);
		return true;
	},

	/**
	 * Add a single crontab entry for a schedule job.
	 * Replaces any entry with the same name. Aborts without writing if the crontab cannot be
	 * read, the madz block is malformed, or the command contains CR/LF/NUL.
	 * @param {{ name: string, cron: string, command: string }} job - Schedule job to add
	 * @returns {Promise<{ added: boolean, error?: string }>} Result
	 */
	add(job) {
		return serialize(async () => {
			const { available, error } = await this.isAvailable();
			if (!available) {
				return { added: false, error: error || "System crontab is not available" };
			}
			if (!job.command) {
				return { added: false, error: "Job requires a 'command' field" };
			}

			try {
				const newEntry = `${job.cron}  ${prepareCrontabCommand(job.command, _logPath)}  ${NAME_MARKER}${job.name}`;
				const { crontab, outsideLines, blockLines } = await this._loadState();
				await this._commit(crontab, outsideLines, [...withoutName(blockLines, job.name), newEntry]);
			} catch (err) {
				return { added: false, error: err instanceof Error ? err.message : String(err) };
			}
			return { added: true };
		});
	},

	/**
	 * Remove a single crontab entry by name.
	 * Aborts without writing if the crontab cannot be read or the madz block is malformed.
	 * @param {string} name - Schedule job name
	 * @returns {Promise<{ removed: boolean, error?: string }>} Result
	 */
	remove(name) {
		return serialize(async () => {
			if (!(await this.isAvailable()).available) {
				return { removed: false, error: "System crontab is not available" };
			}

			try {
				const { crontab, outsideLines, blockLines } = await this._loadState();
				await this._commit(crontab, outsideLines, withoutName(blockLines, name));
			} catch (err) {
				return { removed: false, error: err instanceof Error ? err.message : String(err) };
			}
			return { removed: true };
		});
	},

	/**
	 * List the schedule entries from the current crontab block.
	 * @returns {Promise<Array<{ name: string, cron: string, command: string }>>} Entries
	 * @throws {Error} When the crontab cannot be read or the madz block is malformed
	 */
	async list() {
		const { blockLines } = await this._loadState();
		return blockLines
			.filter((line) => line.trim())
			.map((line) => this._parseEntry(line))
			.filter(Boolean);
	},

	/**
	 * Parse a crontab entry line into its components.
	 * @param {string} line - Crontab entry line
	 * @returns {{ name: string, cron: string, command: string } | null} Entry, or null
	 */
	_parseEntry(line) {
		const cronEnd = line.indexOf("  ");
		const cron = cronEnd !== -1 ? line.slice(0, cronEnd).trim() : line.trim();
		if (!cron) return null;

		const commandStart = cronEnd !== -1 ? cronEnd + 2 : 0;
		const commandEnd = line.indexOf(`  ${NAME_MARKER.trimEnd()}`);
		const command =
			commandEnd !== -1
				? line.slice(commandStart, commandEnd).trim()
				: line.slice(commandStart).trim();

		return { name: entryName(line) || "unknown", cron, command };
	},

	/**
	 * Ensure the reflection-daily job file exists on disk.
	 * Creates it with default values if missing (idempotent). Deleting the file does not
	 * remove the job — it is recreated on the next sync; disable it with `enabled: false`.
	 * Unreadable files (not ENOENT) are left alone, and a failed write is logged, not thrown.
	 * @param {string} schedulesDir - Path to the schedules directory
	 * @returns {Promise<void>} Resolves when done
	 */
	async _ensureReflectionJob(schedulesDir) {
		const filePath = join(schedulesDir, `${REFLECTION_JOB.name}.json`);
		try {
			await readdir(schedulesDir);
		} catch (err) {
			logger.debug(`[cron] Schedules directory missing, creating: ${err.message}`);
			try {
				await mkdir(schedulesDir, { recursive: true });
			} catch (mkdirErr) {
				logger.debug(`[cron] Directory creation failed: ${mkdirErr.message}`);
				return;
			}
		}
		try {
			await readFile(filePath, "utf-8");
			return;
		} catch (err) {
			if (err.code !== "ENOENT") {
				logger.warn(`[cron] Cannot read ${filePath}, leaving it untouched: ${err.message}`);
				return;
			}
		}

		const now = new Date().toISOString();
		const jobData = {
			name: REFLECTION_JOB.name,
			cron: REFLECTION_JOB.cron,
			command: buildSkillCommand(REFLECTION_JOB.skill),
			enabled: REFLECTION_JOB.enabled,
			createdAt: now,
			updatedAt: now,
		};
		try {
			await writeFile(filePath, JSON.stringify(jobData, null, 2));
		} catch (err) {
			logger.warn(`[cron] Failed to create ${filePath}: ${err.message}`);
		}
	},

	/**
	 * Read all valid job definitions from the schedules directory.
	 * Jobs failing the cronJob tool's validation (name, cron expression, command) are skipped
	 * with a warning. Files are read in name order; when two files define the same job name the
	 * first wins and the later one is skipped with a warning.
	 * @param {string} schedulesDir - Path to the schedules directory
	 * @returns {Promise<Array<{ name: string, cron: string, command: string, enabled: boolean }>>} Jobs
	 */
	async _readJobsFromDisk(schedulesDir) {
		const jobs = [];
		const seen = new Set();
		try {
			const files = (await readdir(schedulesDir)).filter((f) => f.endsWith(".json")).sort();
			for (const file of files) {
				try {
					const job = JSON.parse(await readFile(join(schedulesDir, file), "utf-8"));
					if (!job.name || !job.cron || (!job.skill && !job.command)) continue;
					const command = job.command || buildSkillCommand(job.skill, job.input);
					const reason = jobError(job, command);
					if (reason) {
						logger.warn(`[cron] Skipping ${file}: ${reason}`);
						continue;
					}
					if (seen.has(job.name)) {
						logger.warn(`[cron] Skipping ${file}: duplicate job name "${job.name}"`);
						continue;
					}
					seen.add(job.name);
					jobs.push({
						name: job.name,
						cron: job.cron,
						command,
						enabled: job.enabled !== false,
					});
				} catch (err) {
					logger.debug(`[cron] Skipping unreadable file ${file}: ${err.message}`);
				}
			}
		} catch (err) {
			logger.debug(`[cron] Error reading schedules directory: ${err.message}`);
		}
		return jobs;
	},

	/**
	 * Synchronize persisted job definitions with the system crontab.
	 * Reads all JSON files from the schedules directory, compares the crontab lines that would
	 * be written against the current madz block, and replaces the block. The crontab is not
	 * written when nothing changed. Aborts (error field set, no write) if the crontab cannot
	 * be read or the madz block is malformed.
	 *
	 * Jobs with `enabled: false`, invalid jobs, and jobs whose command cannot be prepared are
	 * excluded.
	 *
	 * @param {string} schedulesDir - Path to the schedules directory
	 * @returns {Promise<{ added: number, removed: number, updated: number, skipped: number, error?: string }>} Counts
	 */
	sync(schedulesDir) {
		return serialize(async () => {
			const counts = { added: 0, removed: 0, updated: 0, skipped: 0 };
			const { available, error } = await this.isAvailable();
			if (!available) {
				return { ...counts, error: error || "System crontab is not available" };
			}

			// Ensure reflection-daily job file exists on disk before reading
			await this._ensureReflectionJob(schedulesDir);

			// Desired state: name -> crontab line
			const desired = new Map();
			for (const job of await this._readJobsFromDisk(schedulesDir)) {
				if (!job.enabled) continue;
				try {
					desired.set(
						job.name,
						`${job.cron}  ${prepareCrontabCommand(job.command, _logPath)}  ${NAME_MARKER}${job.name}`,
					);
				} catch (err) {
					logger.warn(`[cron] Skipping job "${job.name}": ${err.message}`);
				}
			}

			let state;
			try {
				state = await this._loadState();
			} catch (err) {
				return { ...counts, error: err.message };
			}
			const { crontab, outsideLines, blockLines } = state;

			// Current state: name -> crontab line
			const current = new Map();
			for (const line of blockLines) {
				const parsed = line.trim() ? this._parseEntry(line) : null;
				if (parsed) current.set(parsed.name, line.trim());
			}

			for (const [name, line] of desired) {
				if (!current.has(name)) counts.added++;
				else if (current.get(name) === line) counts.skipped++;
				else counts.updated++;
			}
			for (const name of current.keys()) {
				if (!desired.has(name)) counts.removed++;
			}

			try {
				await this._commit(crontab, outsideLines, [...desired.values()]);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return { ...counts, error: `Failed to write crontab: ${msg}` };
			}
			return counts;
		});
	},
};
