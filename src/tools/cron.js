import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { mkdir, writeFile, readFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

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
 * Trigger a job immediately via the scheduler.
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
		schedulerModule = await import("../scheduler/index.js");
	}
	const scheduleEntry = {
		name: job.name,
		cron: job.cron,
		skill: job.skill,
		input: job.input,
		contextFile: "",
	};

	try {
		await schedulerModule.runScheduledSkill(scheduleEntry, {}, {});
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
 * @returns {Promise<string>} JSON result string
 */
export async function cronjobImpl(input, options) {
	const { action } = input;
	const schedulesDir = options?.schedulesDir || "memory/schedules/";

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
				const { name, cron, skill, input: jobInput = {} } = input;
				if (!name || !cron || !skill) {
					return JSON.stringify({
						ok: false,
						error: "create requires: name, cron, and skill",
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
					input: jobInput,
					enabled: true,
					createdAt: now,
					updatedAt: now,
				};
				await saveJob(job, schedulesDir);
				return JSON.stringify({ ok: true, message: `Job "${name}" created`, job });
			}

			case "update": {
				const {
					name: updateName,
					cron: updateCron,
					skill: updateSkill,
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
				if (updateInput && typeof updateInput === "object") {
					existing.input = { ...existing.input, ...updateInput };
				}
				existing.updatedAt = new Date().toISOString();
				await saveJob(existing, schedulesDir);
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
export const cronjob = tool(cronjobImpl, {
	name: "cronjob",
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
		skill: z.string().optional().describe("Skill name to trigger (required for create, update)"),
		input: z.record(z.unknown()).optional().describe("Job input parameters"),
	}),
});

// --- Factory functions for creating tools with runtime options ---

/**
 * Create a cronjob tool with runtime options
 * @param {object} options - Runtime options
 * @returns {object} LangChain Tool instance
 */
export function createCronTool(options) {
	return tool((input) => cronjobImpl(input, options), {
		name: "cronjob",
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
			skill: z.string().optional().describe("Skill name to trigger (required for create, update)"),
			input: z.record(z.unknown()).optional().describe("Job input parameters"),
		}),
	});
}
