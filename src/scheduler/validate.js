import { CronExpressionParser } from "cron-parser";

/** Job and skill names: filesystem- and crontab-comment-safe, no separators or dots. */
export const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export const MAX_COMMAND_LENGTH = 4096;

const CRON_NAME_TOKENS =
	/\b(sun|mon|tue|wed|thu|fri|sat|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi;

/**
 * Check that a job or skill name is safe to use in paths and crontab comments.
 * @param {unknown} value - Candidate name
 * @returns {boolean} True when the name is valid
 */
export function isValidName(value) {
	return typeof value === "string" && NAME_PATTERN.test(value);
}

/**
 * Check that a raw shell command is acceptable for a crontab line.
 * @param {unknown} command - Candidate command
 * @returns {string|null} Error message, or null when valid
 */
export function validateCommand(command) {
	if (typeof command !== "string" || command.trim() === "") {
		return "command must be a non-empty string";
	}
	if (command.length > MAX_COMMAND_LENGTH) {
		return `command must be at most ${MAX_COMMAND_LENGTH} characters`;
	}
	if (/[\r\n\0]/.test(command)) {
		return "command must not contain newlines or null bytes";
	}
	return null;
}

/**
 * Validate a standard 5-field crontab expression.
 * Vixie cron has no seconds field and no ?, L, W or # modifiers, so those are rejected
 * even though the parser would accept them. Ranges are checked by cron-parser.
 * @param {unknown} expression - Cron expression
 * @returns {boolean} True when the expression is valid
 */
export function isValidCron(expression) {
	if (typeof expression !== "string") return false;
	const parts = expression.trim().split(/\s+/);
	if (parts.length !== 5 || /[\r\n\0]/.test(expression)) return false;
	if (/[?#LWlw]/.test(expression.replace(CRON_NAME_TOKENS, ""))) return false;
	try {
		CronExpressionParser.parse(parts.join(" "));
		return true;
	} catch (_err) {
		return false;
	}
}
