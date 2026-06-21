import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Cron } from "./cron.js";
import { logger } from "../logger.js";

const JOB_CRON = "0 2 * * *";

const SCHEDULES_DIR = "memory/schedules/";

/**
 * Job definition shape for the daily reflection cron job.
 * @typedef {Object} CronJobDef
 * @property {string} name - Job name
 * @property {string} cron - Cron expression
 * @property {string} command - Shell command to execute
 */

/**
 * Create the cron job definition for the daily reflection job.
 * @param {string} cwd - The working directory to embed in the command
 * @returns {CronJobDef}
 */
function createJobDefinition(cwd) {
	return {
		name: "reflection-daily",
		cron: JOB_CRON,
		command: `cd ${cwd} && timeout 300 node index.js "run /reflection"`,
	};
}

/**
 * Persist a job definition as JSON to the schedules directory.
 * Skips silently if the file already exists (idempotent).
 * @param {string} jobName - Job name (used as filename)
 * @param {CronJobDef} job - Job definition
 * @param {string} cwd - Working directory
 * @returns {{ written: boolean, error?: string }}
 */
function persistJobFile(jobName, job, cwd) {
	const schedulesDir = SCHEDULES_DIR;
	const filePath = join(schedulesDir, `${jobName}.json`);

	if (existsSync(filePath)) {
		return { written: true };
	}

	try {
		mkdirSync(schedulesDir, { recursive: true });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { written: false, error: `Failed to create schedules dir: ${msg}` };
	}

	try {
		const jobData = Object.freeze({
			name: job.name,
			cron: job.cron,
			command: `cd ${cwd} && timeout 300 node index.js "run /reflection"`,
			enabled: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		writeFileSync(filePath, JSON.stringify(jobData, null, 2));
		return { written: true };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { written: false, error: `Failed to write job file: ${msg}` };
	}
}

/**
 * Set up the auto-schedule callback for first-time profile detection.
 * Returns a callback that, when invoked, adds the daily reflection
 * cron job to the system crontab if it is not already present.
 *
 * The callback uses `Cron.add()` which reads `crontab -l` and only
 * writes if the entry is missing — making it safe to call multiple times.
 * Also persists the job definition to `memory/schedules/reflection-daily.json`.
 *
 * @param {Object} [options] - Configuration options
 * @param {Function} [options.Cron] - Cron module (default: module-level Cron)
 * @returns {Function} Callback to invoke after saveProfile() succeeds
 */
export function setupAutoSchedule(options = {}) {
	const CronModule = options.Cron || Cron;

	/**
	 * Callback invoked after saveProfile() succeeds.
	 * @returns {void}
	 */
	return function autoScheduleCallback() {
		const cwd = process.cwd();
		const job = createJobDefinition(cwd);

		try {
			const result = CronModule.add(job);
			if (!result.added && result.error) {
				logger.warn(`[scheduler] Failed to add reflection-daily cron job: ${result.error}`);
			}
		} catch (err) {
			logger.warn(`[scheduler] Error adding reflection-daily cron job: ${err.message}`);
		}

		const persistResult = persistJobFile(job.name, job, cwd);
		if (!persistResult.written) {
			logger.warn(
				`[scheduler] Failed to persist reflection-daily job file: ${persistResult.error}`,
			);
		}
	};
}
