import { Cron } from "./cron.js";

const JOB_CRON = "0 2 * * *";

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
		command: `cd ${cwd} && node index.js --chat "/reflection"`,
	};
}

/**
 * Set up the auto-schedule callback for first-time profile detection.
 * Returns a callback that, when invoked, adds the daily reflection
 * cron job to the system crontab if it is not already present.
 *
 * The callback uses `Cron.add()` which reads `crontab -l` and only
 * writes if the entry is missing — making it safe to call multiple times.
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
		// Create the job definition with embedded cwd
		const cwd = process.cwd();
		const job = createJobDefinition(cwd);

		// Add to system crontab (idempotent — checks crontab -l internally)
		try {
			const result = CronModule.add(job);
			if (!result.added && result.error) {
				// oxlint-disable no-console
				console.warn(`[scheduler] Failed to add reflection-daily cron job: ${result.error}`);
				// oxlint-enable no-console
			}
		} catch (err) {
			// oxlint-disable no-console
			console.warn(`[scheduler] Error adding reflection-daily cron job: ${err.message}`);
			// oxlint-enable no-console
		}
	};
}
