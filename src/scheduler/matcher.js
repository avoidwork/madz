import { CronExpressionParser } from "cron-parser";

/**
 * Check if a cron expression matches a given date.
 * Uses the "previous occurrence" approach: get the previous cron occurrence
 * from (date + 1ms), if it lands on the same minute as the input date,
 * the expression matches. Adding 1ms handles the edge case where the date
 * is exactly at a cron boundary (e.g., 09:30:00.000).
 * @param {string} cronExpression - The cron expression to match
 * @param {Date} date - The date to check against
 * @returns {boolean} True if the expression matches the date
 */
export function matchesCron(cronExpression, date) {
	try {
		const afterDate = new Date(date.getTime() + 1);
		const expr = CronExpressionParser.parse(cronExpression, {
			currentDate: afterDate.toISOString(),
			tz: "UTC",
		});
		const prev = expr.prev();
		// For 6-field cron (with seconds), compare full second precision.
		// For 5-field cron (minute-level), compare minute precision.
		const fields = cronExpression.trim().split(/\s+/).length;
		const precision = fields >= 6 ? 20 : 16;
		return prev.toISOString().slice(0, precision) === date.toISOString().slice(0, precision);
	} catch {
		return false;
	}
}
