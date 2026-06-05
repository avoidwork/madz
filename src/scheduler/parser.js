import { CronExpressionParser } from "cron-parser";

/**
 * Validate a cron expression using cron-parser.
 * Supports standard 5-field (minute hour day-of-month month day-of-week)
 * and 6-field (second-position) cron syntax.
 * @param {string} expression - The cron expression to validate
 * @returns {{ valid: boolean, error: string }}
 */
export function validateCron(expression) {
	if (!expression || typeof expression !== "string") {
		return { valid: false, error: "Cron expression is required" };
	}

	try {
		CronExpressionParser.parse(expression);
		return { valid: true, error: "" };
	} catch (err) {
		return { valid: false, error: err.message || `Invalid cron expression: "${expression}"` };
	}
}

/**
 * Parse a schedule entry from config.
 * @param {Object} entry - Raw schedule entry from config
 * @returns {{ valid: boolean, error: string, parsed: Object }}
 */
export function parseScheduleEntry(entry) {
	if (!entry.name) {
		return { valid: false, error: "Schedule entry must have a name" };
	}

	if (!entry.cron) {
		return { valid: false, error: `Schedule "${entry.name}" must have a cron expression` };
	}

	const cronValidation = validateCron(entry.cron);
	if (!cronValidation.valid) {
		return { valid: false, error: `Schedule "${entry.name}": ${cronValidation.error}` };
	}

	return {
		valid: true,
		error: "",
		parsed: {
			name: entry.name,
			cron: entry.cron,
			skill: entry.skill || "",
			input: entry.input || {},
			contextFile: entry.contextFile || "",
			enabled: entry.enabled !== false,
			paused: false,
			lastRun: null,
			nextRun: null,
		},
	};
}
