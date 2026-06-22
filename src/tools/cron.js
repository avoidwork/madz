import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { mkdir, writeFile, readFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Cron } from "../../src/scheduler/cron.js";
import { logger } from "../logger.js";

/// -- Helper to find skill script --

/**
 * Locate the main script file for a skill.
 * System skills (system-skills/) are searched first and shadow user skills (skills/).
 * @param {string} skillName - Skill name
 * @param {string|string[]} [baseDir=["system-skills", "skills"]] - Base directory or array of directories to search
 * @returns {Promise<string|null>} Path to the main script, or null
 */
export async function findSkillScript(skillName, baseDir = ["system-skills", "skills"]) {
	if (typeof baseDir === "string") {
		baseDir = [baseDir];
	}

	const scriptCandidates = [
		"scripts/run.sh",
		"scripts/run.py",
		"scripts/run.js",
		"scripts/run.bash",
	];

	const rootScripts = ["run.sh", "run.py", "run.js", "run.bash"];

	for (const dir of baseDir) {
		const skillDir = join(dir, skillName);

		for (const candidate of scriptCandidates) {
			const fullPath = join(skillDir, candidate);
			if (existsSync(fullPath)) return fullPath;
		}

		for (const candidate of rootScripts) {
			const fullPath = join(skillDir, candidate);
			if (existsSync(fullPath)) return fullPath;
		}
	}

	return null;
}

/**
 * Run a script via spawn with stdout/stderr collection and timeout.
 * @param {string} scriptPath - Path to the script
 * @param {string[]} [args=[]] - Command-line arguments
 * @param {object} [options] - Execution options
 * @param {number} [options.timeout=30000] - Timeout in milliseconds
 * @param {string} [options.cwd] - Working directory
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
 */
export async function runScript(scriptPath, args = [], options = {}) {
	const { timeout = 30000, cwd = process.cwd() } = options;
	return new Promise((resolve) => {
		const child = spawn(scriptPath, args, {
			cwd,
			stdio: ["pipe", "pipe", "pipe"],
		});

		const chunks = { stdout: [], stderr: [] };
		let settled = false;

		const settle = (exitCode) => {
			if (settled) return;
			settled = true;
			resolve({
				stdout: Buffer.concat(chunks.stdout).toString(),
				stderr: Buffer.concat(chunks.stderr).toString(),
				exitCode,
			});
		};

		const timer = setTimeout(() => {
			child.kill("SIGTERM");
			setTimeout(() => settle(-1), 2000);
		}, timeout);

		child.stdout.on("data", (chunk) => chunks.stdout.push(chunk));
		child.stderr.on("data", (chunk) => chunks.stderr.push(chunk));

		child.on("exit", (code) => {
			clearTimeout(timer);
			settle(code ?? 0);
		});

		child.on("error", () => {
			clearTimeout(timer);
			if (!settled) settle(-1);
		});
	});
}

/// -- Cron validation --

/**
 * Validate a cron expression with regex.
 * Supports 5-field format: minute hour day month weekday
 * @param {string} expression - Cron expression
 * @returns {boolean}
 */
function isValidCron(expression) {
	const parts = expression.trim().split(/\s+/);
	if (parts.length !== 5 && parts.length !== 6) return false;

	const fieldPatterns = [
		/^(\*|\*\/\d+|\/\d+|(\d+(-\d+)?)(\/\d+)?(,\d+(-\d+)?(\/\d+)?)*)$/,
		/^(\*|\*\/\d+|\/\d+|(\d+(-\d+)?)(\/\d+)?(,\d+(-\d+)?(\/\d+)?)*)$/,
		/^(\*|\*\/\d+|\/\d+|(\d+(-\d+)?)(\/\d+)?(,\d+(-\d+)?(\/\d+)?)*)$/,
		/^(\*|\*\/\d+|\/\d+|(\d+(-\d+)?)(\/\d+)?(,\d+(-\d+)?(\/\d+)?)*)$/,
		/^(\*|\*\/\d+|\/\d+|(\d+(-\d+)?)(\/\d+)?(,\d+(-\d+)?(\/\d+)?)*)$/,
	];

	for (let i = 0; i < fieldPatterns.length; i++) {
		if (!fieldPatterns[i].test(parts[i])) return false;
	}

	return true;
}

/// -- Job persistence --

/**
 * Load a job from disk.
 * @param {string} name - Job name
 * @param {string} schedulesDir - Directory to load from
 * @returns {Promise<object|null>}
 */
async function loadJob(name, schedulesDir) {
	const filePath = join(schedulesDir, `${name}.json`);
	try {
		const content = await readFile(filePath, "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
}

/**
 * Save a job to disk.
 * @param {object} job - Job object
 * @param {string} schedulesDir - Directory to save to
 * @returns {Promise<void>}
 */
async function saveJob(job, schedulesDir) {
	await mkdir(schedulesDir, { recursive: true });
	const filePath = join(schedulesDir, `${job.name}.json`);
	await writeFile(filePath, JSON.stringify(job, null, 2), "utf-8");
}

/**
 * List all jobs from disk.
 * @param {string} schedulesDir - Directory to list from
 * @returns {Promise<{ jobs: object[] }>}
 */
async function listJobs(schedulesDir) {
	const files = await getScheduleFiles(schedulesDir);
	const jobs = [];
	for (const file of files) {
		const job = await loadJob(file.replace(".json", ""), schedulesDir);
		if (job) {
			jobs.push(job);
		}
	}
	return { jobs };
}

/**
 * Get all JSON files from the schedules directory.
 * @param {string} schedulesDir - Directory to list files from
 * @returns {Promise<string[]>}
 */
async function getScheduleFiles(schedulesDir) {
	try {
		const files = await readdir(schedulesDir);
		return files.filter((f) => f.endsWith(".json"));
	} catch {
		return [];
	}
}

/**
 * Trigger a job immediately via the sandbox.
 * @param {object} job - Job to run
 * @param {object} [schedulerModule] - Scheduler module for testing
 * @param {string} [schedulesDir] - Directory to write output to
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function runJob(job, schedulerModule, schedulesDir) {
	if (!job.enabled) {
		return { ok: false, error: `Job "${job.name}" is paused` };
	}

	if (!schedulerModule) {
		const scriptPath = await findSkillScript(job.skill);
		if (!scriptPath) {
			return {
				ok: false,
				error: `Skill "${job.skill}" has no discoverable script. Job "${job.name}" was not executed.`,
			};
		}

		try {
			const result = await runScript(scriptPath, [], { timeout: 30000 });
			job.lastRun = new Date().toISOString();
			job.updatedAt = new Date().toISOString();
			await saveJob(job, schedulesDir);
			return { ok: result.exitCode === 0, result };
		} catch (err) {
			return { ok: false, error: `Execution failed: ${err.message}` };
		}
	}

	const scheduleEntry = {
		name: job.name,
		cron: job.cron,
		skill: job.skill,
		input: job.input,
		contextFile: "",
	};

	try {
		await schedulerModule.runScheduledSkill(
			scheduleEntry,
			schedulerModule.sandbox || (() => ({})),
			{},
		);
		job.lastRun = new Date().toISOString();
		job.updatedAt = new Date().toISOString();
		await saveJob(job, schedulesDir);
		return { ok: true, outputDir: schedulesDir };
	} catch (err) {
		return { ok: false, error: `Scheduler execution failed: ${err.message}` };
	}
}

/// -- Core cron tool --

/**
 * Manage cron jobs with CRUD actions.
 * @param {object} input - Tool input with action and parameters
 * @param {object} [options] - Runtime options
 * @param {string} [options.schedulesDir] - Directory for job persistence (default "memory/schedules/")
 * @param {object} [options.scheduler] - Scheduler module for testing
 * @param {object} [options.cron] - Cron module for testing
 * @returns {Promise<string>} JSON result string
 */
export async function cronJobImpl(input, options) {
	const { action } = input;
	const schedulesDir = options?.schedulesDir || "memory/schedules/";
	const cronModule = options?.cron || Cron;

	const actions = ["create", "list", "update", "pause", "resume", "run", "remove"];
	if (!actions.includes(action)) {
		return JSON.stringify({
			ok: false,
			error: `Unknown action: "${action}". Valid actions: ${actions.join(", ")}`,
		});
	}

	try {
		switch (action) {
			case "list": {
				const result = await listJobs(schedulesDir);
				return JSON.stringify({ ok: true, ...result });
			}

			case "create": {
				const { name, cron, skill, command, input: jobInput = {} } = input;
				if (!name || !cron || (!skill && !command)) {
					return JSON.stringify({
						ok: false,
						error: "create requires: name, cron, and either skill or command",
					});
				}
				if (!isValidCron(cron)) {
					return JSON.stringify({
						ok: false,
						error: `Invalid cron expression: "${cron}". Must be 5-6 fields (minute hour day month weekday)`,
					});
				}
				const existing = await loadJob(name, schedulesDir);
				if (existing) {
					return JSON.stringify({
						ok: false,
						error: `Job "${name}" already exists. Use "update" to modify it.`,
					});
				}
				const now = new Date().toISOString();
				const job = {
					name,
					cron,
					skill,
					command,
					input: jobInput,
					enabled: true,
					createdAt: now,
					updatedAt: now,
				};
				await saveJob(job, schedulesDir);
				const cronResult = cronModule.add({ name: job.name, cron: job.cron, command: job.command });
				if (cronResult.error) {
					logger.warn(`[cronJob] Failed to register "${job.name}" in crontab: ${cronResult.error}`);
				}
				return JSON.stringify({ ok: true, message: `Job "${name}" created`, job });
			}

			case "update": {
				const {
					name: updateName,
					cron: updateCron,
					skill: updateSkill,
					command: updateCommand,
					input: updateInput,
				} = input;
				if (!updateName) {
					return JSON.stringify({ ok: false, error: "update requires: name" });
				}
				const existing = await loadJob(updateName, schedulesDir);
				if (!existing) {
					return JSON.stringify({
						ok: false,
						error: `Job "${updateName}" not found. Use "create" to add it.`,
					});
				}
				if (updateCron) {
					if (!isValidCron(updateCron)) {
						return JSON.stringify({
							ok: false,
							error: `Invalid cron expression: "${updateCron}".`,
						});
					}
					existing.cron = updateCron;
				}
				if (updateSkill) existing.skill = updateSkill;
				if (updateCommand !== undefined) existing.command = updateCommand;
				if (updateInput && typeof updateInput === "object") {
					existing.input = { ...existing.input, ...updateInput };
				}
				existing.updatedAt = new Date().toISOString();
				await saveJob(existing, schedulesDir);
				// Sync crontab if cron or command changed
				if (updateCron || updateCommand) {
					cronModule.add({ name: existing.name, cron: existing.cron, command: existing.command });
				}
				return JSON.stringify({ ok: true, message: `Job "${updateName}" updated`, job: existing });
			}

			case "pause": {
				const { name: pauseName } = input;
				if (!pauseName) {
					return JSON.stringify({ ok: false, error: "pause requires: name" });
				}
				const existing = await loadJob(pauseName, schedulesDir);
				if (!existing) {
					return JSON.stringify({ ok: false, error: `Job "${pauseName}" not found` });
				}
				existing.enabled = false;
				existing.updatedAt = new Date().toISOString();
				await saveJob(existing, schedulesDir);
				return JSON.stringify({
					ok: true,
					message: `Job "${pauseName}" paused`,
					job: existing,
				});
			}

			case "resume": {
				const { name: resumeName } = input;
				if (!resumeName) {
					return JSON.stringify({ ok: false, error: "resume requires: name" });
				}
				const existing = await loadJob(resumeName, schedulesDir);
				if (!existing) {
					return JSON.stringify({ ok: false, error: `Job "${resumeName}" not found` });
				}
				existing.enabled = true;
				existing.updatedAt = new Date().toISOString();
				await saveJob(existing, schedulesDir);
				return JSON.stringify({
					ok: true,
					message: `Job "${resumeName}" resumed`,
					job: existing,
				});
			}

			case "run": {
				const { name: runName } = input;
				if (!runName) {
					return JSON.stringify({ ok: false, error: "run requires: name" });
				}
				const existing = await loadJob(runName, schedulesDir);
				if (!existing) {
					return JSON.stringify({ ok: false, error: `Job "${runName}" not found` });
				}
				const result = await runJob(existing, options?.scheduler, schedulesDir);
				return JSON.stringify(result);
			}

			case "remove": {
				const { name: removeName } = input;
				if (!removeName) {
					return JSON.stringify({ ok: false, error: "remove requires: name" });
				}
				const existing = await loadJob(removeName, schedulesDir);
				if (!existing) {
					return JSON.stringify({ ok: false, error: `Job "${removeName}" not found` });
				}
				const filePath = join(schedulesDir, `${removeName}.json`);
				await unlink(filePath);
				cronModule.remove(removeName);
				return JSON.stringify({
					ok: true,
					message: `Job "${removeName}" removed`,
				});
			}
		}
	} catch (err) {
		return JSON.stringify({ ok: false, error: `Cron job error: ${err.message}` });
	}
}

/**
 * @param {z.infer<typeof CronSchema>} input - Tool input with action and parameters
 * @param {object} _options - Runtime options
 * @returns {string} JSON result string
 */
export const cronJob = tool(cronJobImpl, {
	name: "cronJob",
	description:
		"Manage scheduled cron jobs persisted to memory/schedules/. Actions: create, list, update, pause, resume, run, remove. Job metadata stored as JSON files. Requires network:outbound permission for run action.",
	schema: z.object({
		action: z
			.enum(["create", "list", "update", "pause", "resume", "run", "remove"])
			.describe("Action to perform"),
		name: z
			.string()
			.optional()
			.describe("Job name (required for create, update, pause, resume, run, remove)"),
		cron: z
			.string()
			.optional()
			.describe("Cron expression (5-6 fields, required for create, optional for update)"),
		skill: z
			.string()
			.optional()
			.describe("Skill name to trigger (required for create if command not provided)"),
		command: z
			.string()
			.optional()
			.describe("Shell command to execute (required for create if skill not provided)"),
		input: z.record(z.unknown()).optional().describe("Job input parameters"),
	}),
});

// --- Factory functions for creating tools with runtime options ---

/**
 * Create a cronJob tool with runtime options
 * @param {object} options - Runtime options
 * @returns {object} LangChain Tool instance
 */
export function createCronTool(options) {
	return tool((input) => cronJobImpl(input, options), {
		name: "cronJob",
		description:
			"Manage scheduled cron jobs persisted to memory/schedules/. Actions: create, list, update, pause, resume, run, remove.",
		schema: z.object({
			action: z
				.enum(["create", "list", "update", "pause", "resume", "run", "remove"])
				.describe("Action to perform"),
			name: z
				.string()
				.optional()
				.describe("Job name (required for create, update, pause, resume, run, remove)"),
			cron: z
				.string()
				.optional()
				.describe("Cron expression (5-6 fields, required for create, optional for update)"),
			skill: z
				.string()
				.optional()
				.describe("Skill name to trigger (required for create if command not provided)"),
			command: z
				.string()
				.optional()
				.describe("Shell command to execute (required for create if skill not provided)"),
			input: z.record(z.unknown()).optional().describe("Job input parameters"),
		}),
	});
}
