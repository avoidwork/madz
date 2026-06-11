import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hasProfile } from "../memory/profile.js";

const SCHEDULES_DIR = "memory/schedules/";
const JOB_FILE = "reflection-daily.json";
const JOB_CRON = "0 2 * * *";

/**
 * Job definition shape written to disk.
 * @typedef {Object} CronJobDef
 * @property {string} name - Job name
 * @property {string} cron - Cron expression
 * @property {string} command - Shell command to execute
 * @property {boolean} enabled - Whether the job is active
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
		command: `cd ${cwd} && node index.js --chat "/reflection"`,
		enabled: true,
	};
}

/**
 * Write a job definition JSON file to disk.
 * @param {string} schedulesDir - Directory for schedule JSON files
 * @param {CronJobDef} job - Job definition to write
 * @returns {{ success: boolean, error?: string }}
 */
function writeJobFile(schedulesDir, job) {
	const filePath = join(schedulesDir, JOB_FILE);
	try {
		const content = JSON.stringify(job, null, 2) + "\n";
		writeFileSync(filePath, content, "utf-8");
		return { success: true };
	} catch (err) {
		return { success: false, error: err.message };
	}
}

/**
 * Check whether the job file already exists on disk.
 * @param {string} schedulesDir - Directory for schedule JSON files
 * @returns {boolean}
 */
function jobFileExists(schedulesDir) {
	return existsSync(join(schedulesDir, JOB_FILE));
}

/**
 * Set up the auto-schedule callback for first-time profile detection.
 * Returns a callback that, when invoked, checks if this is a first-time
 * profile write and creates a daily reflection cron job if so.
 *
 * @param {Object} [options] - Configuration options
 * @param {string} [options.schedulesDir] - Path to schedules directory (default: memory/schedules/)
 * @param {Function} [options.hasProfile] - Profile existence checker (default: module-level hasProfile)
 * @returns {Function} Callback to invoke after saveProfile() succeeds
 */
export function setupAutoSchedule(options = {}) {
	const schedulesDir = options.schedulesDir || SCHEDULES_DIR;
	const hasProfileFn = options.hasProfile || hasProfile;

	/**
	 * Callback invoked after saveProfile() succeeds.
	 * @returns {void}
	 */
	return function autoScheduleCallback() {
		// Guard: skip if job file already exists (idempotent)
		if (jobFileExists(schedulesDir)) {
			return;
		}

		// Check if this is a first-time profile write
		let profileExists = false;
		try {
			profileExists = hasProfileFn();
		} catch (err) {
			// Graceful degradation: if detection fails, skip auto-schedule
			// The job file doesn't exist, so a future first-write will catch it
			return;
		}

		// Only trigger on first write (no existing profile)
		if (profileExists) {
			return;
		}

		// Create the job definition with embedded cwd
		const cwd = process.cwd();
		const job = createJobDefinition(cwd);

		// Write the job file
		const result = writeJobFile(schedulesDir, job);
		if (!result.success) {
			// Silently fail — the user can create the job manually
			// The job will persist in memory/schedules/ for next sync
		}
	};
}
