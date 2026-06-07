import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Sanitize a schedule name for safe filesystem use.
 * @param {string} name - Raw schedule name
 * @returns {string} Sanitized name
 */
function sanitizeName(name) {
	return (name || "unnamed").replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Log a scheduled execution result to memory/schedules/ as markdown.
 * @param {Object} result - Execution result
 * @param {string} result.scheduleName - Name of the schedule
 * @param {string} result.cron - Cron expression
 * @param {string} result.startTime - Start timestamp
 * @param {string} result.endTime - End timestamp
 * @param {number} result.exitCode - Process exit code
 * @param {string} result.stdout - Stdout output
 * @param {string} result.stderr - Stderr output
 * @param {string} [outputDir="memory/schedules/"] - Output directory
 * @returns {Promise<string>} Path to the created file
 */
export async function logScheduleResult(result, outputDir = "memory/schedules/") {
	const { scheduleName, cron, startTime, endTime, exitCode, stdout, stderr } = result;
	const safeName = sanitizeName(scheduleName);
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const status = exitCode === 0 ? "success" : "failure";
	const filepath = join(process.cwd(), outputDir, `${timestamp}-${safeName}.md`);

	try {
		await mkdir(join(process.cwd(), outputDir), { recursive: true });
	} catch (_err) {
		return "";
	}

	const content = [
		"---",
		`title: "${scheduleName}"`,
		`cron: "${cron}"`,
		`startTime: "${startTime}"`,
		`endTime: "${endTime}"`,
		`exitCode: ${exitCode || "null"}`,
		`status: "${status}"`,
		"---",
		"",
		"## Stdout",
		stdout || "(no output)",
		"",
		"## Stderr",
		stderr || "(no output)",
		"",
	].join("\n");

	try {
		await writeFile(filepath, content);
	} catch (_err) {
		// Suppress write errors — log but don't throw
	}

	return filepath;
}
