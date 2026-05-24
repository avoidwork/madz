import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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
 * @returns {string} Path to the created file
 */
export function logScheduleResult(result, outputDir = "memory/schedules/") {
  mkdirSync(join(process.cwd(), outputDir), { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const { scheduleName, cron, startTime, endTime, exitCode, stdout, stderr } = result;
  const status = exitCode === 0 ? "success" : "failure";
  const filepath = join(process.cwd(), outputDir, `${timestamp}-${scheduleName}.md`);

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

  writeFileSync(filepath, content);
  return filepath;
}
