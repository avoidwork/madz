import { z } from "zod";
import { createHash } from "node:crypto";
import { fetchJson } from "./common.js";
import { validateUrl } from "./discovery.js";

/** Poppy protocol version sent as the `Poppy-Version` header. */
const POPPY_VERSION = "1.0";

/** Maximum length for a feedback description. */
const MAX_FEEDBACK_LENGTH = 2000;

/** Valid skill types in the Poppy `skill_index` (Agent Skills format). */
const VALID_SKILL_TYPES = new Set(["agent-skill", "skill"]);

/**
 * Zod schema for a Poppy `excluded_tasks` entry. Required fields: `task`,
 * `description`. Optional fields: `alternative`.
 */
const ExcludedTaskSchema = z.object({
	task: z.string().min(1),
	description: z.string().min(1),
	alternative: z.string().optional(),
});

/**
 * Zod schema for a Poppy `skill_index` entry. Required fields: `name`,
 * `type`, `url`, `digest`. Optional fields: `description`.
 */
const SkillIndexEntrySchema = z.object({
	name: z.string().min(1),
	type: z.string().min(1),
	url: z.string().min(1),
	digest: z.string().min(1),
	description: z.string().optional(),
});

/**
 * Zod schema for a Poppy `feedback` entry. Required fields: `endpoint`.
 * Optional fields: `description`.
 */
const FeedbackSchema = z.object({
	endpoint: z.string().min(1),
	description: z.string().optional(),
});

/**
 * Zod schema for the tasks response from `GET {tasks.endpoint}`. Required
 * fields: `excluded_tasks`, `skill_index`, `feedback`.
 */
export const TasksResponseSchema = z.object({
	excluded_tasks: z.array(ExcludedTaskSchema).default([]),
	skill_index: z.array(SkillIndexEntrySchema).default([]),
	feedback: FeedbackSchema.optional(),
});

/**
 * Zod schema for the `tasks` action input. Required fields: `op` and
 * `endpoint` (the company's `tasks.endpoint`). Optional fields: `session`,
 * `task`, `description`, `feedback`, `poppyJson`, `version`.
 */
export const TasksInputSchema = z.object({
	op: z.string().min(1),
	endpoint: z.string().optional(),
	session: z.string().optional(),
	task: z.string().optional(),
	description: z.string().optional(),
	feedback: z.unknown().optional(),
	poppyJson: z.unknown().optional(),
	version: z.string().optional(),
});

/**
 * Build the request headers for a tasks fetch, including the Poppy-Session
 * and Poppy-Version headers. No access token is sent.
 * @param {object} input - Tool input
 * @param {string} [input.session] - The Poppy-Session JWT
 * @param {string} [input.version] - The Poppy protocol version
 * @returns {object} The request headers
 */
export function buildTasksHeaders(input) {
	const headers = { "Poppy-Version": input.version ?? POPPY_VERSION };
	if (input.session) {
		headers["Poppy-Session"] = input.session;
	}
	return headers;
}

/**
 * Validate that an endpoint is present and HTTPS/non-private.
 * @param {string} endpoint - The endpoint URL
 * @returns {{ok: boolean, error?: string}} Validation result
 */
function validateEndpoint(endpoint) {
	if (!endpoint) {
		return { ok: false, error: "endpoint is required" };
	}
	return validateUrl(endpoint);
}

/**
 * Fetch a company's task coverage from `GET {tasks.endpoint}` with the
 * session header and no access token, parsing `excluded_tasks`,
 * `skill_index`, and `feedback`.
 * @param {object} input - Tool input
 * @param {string} input.endpoint - The tasks endpoint URL
 * @param {string} [input.session] - The Poppy-Session JWT
 * @param {string} [input.version] - The Poppy protocol version
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function fetchTasks(input, options = {}) {
	const validation = validateEndpoint(input.endpoint);
	if (!validation.ok) {
		return validation;
	}
	const result = await fetchJson(input.endpoint, {
		method: "GET",
		headers: buildTasksHeaders(input),
		...options,
	});
	if (!result.ok) {
		return result;
	}
	const parsed = TasksResponseSchema.safeParse(result.data);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid tasks response: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	return { ok: true, data: parsed.data };
}

/**
 * Match a user's task against the company's excluded tasks and alternatives.
 * @param {object} tasks - The parsed tasks response
 * @param {object} [tasks.excluded_tasks] - The excluded tasks list
 * @param {string} task - The user's task description
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
export function matchTask(tasks, task) {
	const excluded = tasks?.excluded_tasks ?? [];
	if (!Array.isArray(excluded) || excluded.length === 0) {
		return { ok: true, data: { excluded: false } };
	}
	const taskLower = (task ?? "").toLowerCase();
	for (const entry of excluded) {
		if (
			entry.task.toLowerCase() === taskLower ||
			entry.description.toLowerCase().includes(taskLower)
		) {
			return {
				ok: true,
				data: { excluded: true, task: entry.task, alternative: entry.alternative },
			};
		}
	}
	return { ok: true, data: { excluded: false } };
}

/**
 * Fetch and verify a skill artifact from `skill_index` (Agent Skills format,
 * digest verification).
 * @param {object} entry - The skill index entry
 * @param {string} entry.name - The skill name
 * @param {string} entry.type - The skill type
 * @param {string} entry.url - The skill artifact URL
 * @param {string} entry.digest - The expected digest
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function fetchSkill(entry, options = {}) {
	if (!entry || !entry.name || !entry.type || !entry.url || !entry.digest) {
		return { ok: false, error: "Invalid skill index entry" };
	}
	if (!VALID_SKILL_TYPES.has(entry.type)) {
		return { ok: false, error: `Unknown skill type: ${entry.type}` };
	}
	const validation = validateUrl(entry.url);
	if (!validation.ok) {
		return validation;
	}
	const result = await fetchJson(entry.url, { ...options });
	if (!result.ok) {
		return result;
	}
	const content = JSON.stringify(result.data);
	const digest = createHash("sha256").update(content).digest("hex");
	if (digest !== entry.digest) {
		return { ok: false, error: `Digest mismatch for skill '${entry.name}'` };
	}
	return { ok: true, data: { name: entry.name, type: entry.type, content: result.data } };
}

/**
 * Fetch and verify all skill artifacts from `skill_index`.
 * @param {object[]} skillIndex - The skill index entries
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object[], error?: string}>} Result
 */
export async function fetchSkills(skillIndex, options = {}) {
	if (!Array.isArray(skillIndex) || skillIndex.length === 0) {
		return { ok: true, data: [] };
	}
	const results = [];
	for (const entry of skillIndex) {
		const result = await fetchSkill(entry, options);
		if (!result.ok) {
			return result;
		}
		results.push(result.data);
	}
	return { ok: true, data: results };
}

/**
 * Send feedback with `POST {feedback.endpoint}` (task and description, no
 * personal data or secrets), handling 202 (accepted) and 200 (with an
 * alternative) responses per section 9.
 * @param {object} input - Tool input
 * @param {string} input.endpoint - The feedback endpoint URL
 * @param {string} [input.task] - The task description
 * @param {string} [input.description] - The feedback description
 * @param {string} [input.session] - The Poppy-Session JWT
 * @param {string} [input.version] - The Poppy protocol version
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function sendFeedback(input, options = {}) {
	const validation = validateEndpoint(input.endpoint);
	if (!validation.ok) {
		return validation;
	}
	const description = input.description ?? "";
	if (description.length > MAX_FEEDBACK_LENGTH) {
		return { ok: false, error: `Feedback exceeds ${MAX_FEEDBACK_LENGTH} characters` };
	}
	const result = await fetchJson(input.endpoint, {
		method: "POST",
		headers: buildTasksHeaders(input),
		body: JSON.stringify({ task: input.task, description }),
		...options,
	});
	if (!result.ok) {
		return result;
	}
	if (result.data?.alternative) {
		return { ok: true, data: { accepted: false, alternative: result.data.alternative } };
	}
	return { ok: true, data: { accepted: true } };
}

/**
 * Dispatch the `tasks` action on its `op` field.
 * @param {object} input - Tool input
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function execute(input, options = {}) {
	const parsed = TasksInputSchema.safeParse(input);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid tasks input: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	const data = parsed.data;
	switch (data.op) {
		case "fetch":
			return fetchTasks(data, options);
		case "match":
			return matchTask(data.poppyJson, data.task);
		case "skills":
			return fetchSkills(data.poppyJson?.skill_index ?? [], options);
		case "feedback":
			return sendFeedback(data, options);
		default:
			return { ok: false, error: `Unknown tasks operation: ${data.op}` };
	}
}
