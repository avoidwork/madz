import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { mkdir, writeFile, readFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const SCHEDULES_DIR = "memory/schedules/";

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
 * Get list of schedule job files.
 * @returns {Promise<string[]>}
 */
async function getScheduleFiles() {
	try {
		const entries = await readdir(SCHEDULES_DIR);
		return entries.filter((f) => f.endsWith(".json") && f !== "meta.json");
	} catch {
		return [];
	}
}

/**
 * Load a job from disk.
 * @param {string} name - Job name
 * @returns {Promise<object|null>}
 */
async function loadJob(name) {
	const filePath = join(SCHEDULES_DIR, `${name}.json`);
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
 * @returns {Promise<void>}
 */
async function saveJob(job) {
	await mkdir(SCHEDULES_DIR, { recursive: true });
	const filePath = join(SCHEDULES_DIR, `${job.name}.json`);
	await writeFile(filePath, JSON.stringify(job, null, 2), "utf-8");
}

/**
 * List all jobs from disk.
 * @returns {Promise<{ jobs: object[] }>}
 */
async function listJobs() {
	const files = await getScheduleFiles();
	const jobs = [];
	for (const file of files) {
		const job = await loadJob(file.replace(".json", ""));
		if (job) {
			jobs.push(job);
		}
	}
	return { jobs };
}

/**
 * Trigger a job immediately via the scheduler.
 * @param {object} job - Job to run
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function runJob(job) {
	if (!job.enabled) {
		return { ok: false, error: `Job "${job.name}" is paused` };
	}

	const schedulerModule = await import("../scheduler/index.js");
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
		await saveJob(job);
		return { ok: true, outputDir: SCHEDULES_DIR };
	} catch (err) {
		return { ok: false, error: `Scheduler execution failed: ${err.message}` };
	}
}

/// -- Core cron tool --

/**
 * Manage cron jobs with CRUD actions.
 * @param {object} input - Tool input with action and parameters
 * @param {object} _options - Runtime options (unused)
 * @returns {Promise<string>} JSON result string
 */
export async function cronjobImpl(input, _options) {
	const { action } = input;

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
				const result = await listJobs();
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
				const existing = await loadJob(name);
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
				await saveJob(job);
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
				const existing = await loadJob(updateName);
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
				await saveJob(existing);
				return JSON.stringify({ ok: true, message: `Job "${updateName}" updated`, job: existing });
			}

			case "pause": {
				const { name: pauseName } = input;
				if (!pauseName) {
					return JSON.stringify({ ok: false, error: "pause requires: name" });
				}
				const existing = await loadJob(pauseName);
				if (!existing) {
					return JSON.stringify({ ok: false, error: `Job "${pauseName}" not found` });
				}
				existing.enabled = false;
				existing.updatedAt = new Date().toISOString();
				await saveJob(existing);
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
				const existing = await loadJob(resumeName);
				if (!existing) {
					return JSON.stringify({ ok: false, error: `Job "${resumeName}" not found` });
				}
				existing.enabled = true;
				existing.updatedAt = new Date().toISOString();
				await saveJob(existing);
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
				const existing = await loadJob(runName);
				if (!existing) {
					return JSON.stringify({ ok: false, error: `Job "${runName}" not found` });
				}
				const result = await runJob(existing);
				return JSON.stringify(result);
			}

			case "remove": {
				const { name: removeName } = input;
				if (!removeName) {
					return JSON.stringify({ ok: false, error: "remove requires: name" });
				}
				const existing = await loadJob(removeName);
				if (!existing) {
					return JSON.stringify({ ok: false, error: `Job "${removeName}" not found` });
				}
				const filePath = join(SCHEDULES_DIR, `${removeName}.json`);
				await unlink(filePath);
				return JSON.stringify({
					ok: true,
					message: `Job "${removeName}" removed`,
				});
			}

			default:
				return JSON.stringify({ ok: false, error: `Unknown action: ${action}` });
		}
	} catch (err) {
		return JSON.stringify({ ok: false, error: `Cron job error: ${err.message}` });
	}
}

/**
 * @param {z.infer<typeof CronSchema>} input
 * @param {object} _options - Runtime options
 * @returns {string}
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
