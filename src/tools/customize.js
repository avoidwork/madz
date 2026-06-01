import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
	readFileSync,
	writeFileSync,
	renameSync,
	mkdirSync,
	readdirSync,
	existsSync,
} from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { createInterface } from "node:readline";

// --- YAML frontmatter utilities ---

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns the parsed frontmatter object and the body text.
 * @param {string} content - Markddown content with optional YAML frontmatter
 * @returns {{ frontmatter: Record<string, unknown>, body: string }} Parsed frontmatter and body
 */
export function parseFrontmatter(content) {
	const fmDelimiter = "---";
	const firstIndex = content.indexOf(fmDelimiter);
	if (firstIndex === -1) {
		return { frontmatter: {}, body: content.trim() };
	}
	const secondIndex = content.indexOf(fmDelimiter, firstIndex + 3);
	if (secondIndex === -1) {
		return { frontmatter: {}, body: content.trim() };
	}
	const fmContent = content.slice(firstIndex + 3, secondIndex).trim();
	const body = content.slice(secondIndex + 3).trim();
	const frontmatter = simpleYamlParse(fmContent);
	return { frontmatter, body };
}

/**
 * Minimal YAML parser supporting scalar values and simple arrays.
 * @param {string} yaml - YAML string to parse
 * @returns {Record<string, unknown>} Parsed key-value pairs
 */
function simpleYamlParse(yaml) {
	const result = {};
	const lines = yaml.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const colonIndex = trimmed.indexOf(":");
		if (colonIndex === -1) continue;
		const key = trimmed.slice(0, colonIndex).trim();
		let value = trimmed.slice(colonIndex + 1).trim();
		if (value === "") continue;
		if (value.startsWith("[") && value.endsWith("]")) {
			const items = value
				.slice(1, -1)
				.split(",")
				.map((i) => i.trim().replace(/^"|"$/g, ""));
			result[key] = items;
		} else {
			result[key] = value.replace(/^"|"$/g, "");
		}
	}
	return result;
}

/**
 * Convert an object to a YAML frontmatter string.
 * @param {Record<string, unknown>} data - Data object
 * @returns {string} YAML frontmatter string
 */
function toYamlFrontmatter(data) {
	const lines = [];
	for (const [key, value] of Object.entries(data)) {
		if (Array.isArray(value)) {
			const items = value.map((v) => String(v)).join(", ");
			lines.push(`${key}: [${items}]`);
		} else {
			const v = value !== undefined && value !== null ? String(value) : "";
			lines.push(`${key}: ${v}`);
		}
	}
	return lines.join("\n");
}

/**
 * Combine frontmatter and body into a complete markdown file string.
 * @param {Record<string, unknown>} frontmatter - YAML frontmatter data
 * @param {string} body - Markdown body text
 * @returns {string} Complete markdown with frontmatter
 */
function buildMarkdownFile(frontmatter, body) {
	return `---\n${toYamlFrontmatter(frontmatter)}\n---\n\n${body}`;
}

// --- Questionnaire data structure ---

/**
 * Question definition for a single field in the questionnaire.
 * @typedef {object} QuestionDef
 * @property {string} key - The data key stored in frontmatter
 * @property {string} prompt - The question to display to the user
 * @property {boolean} required - Whether the answer is mandatory
 */

/**
 * Questionnaire definition for an entire category group.
 * @typedef {object} CategoryDef
 * @property {string} id - Unique category identifier
 * @property {string} label - Display label for the group
 * @property {string} filePath - Output file path (relative to contextDir)
 * @property {string} title - Title for the markdown heading
 * @property {QuestionDef[]} questions - Questions in this group
 */

/**
 * Identity category: name, handle, DOB, location, relationship status.
 */
export const IDENTITY_GROUP = Object.freeze({
	id: "identity",
	label: "Identity",
	filePath: "user-profile.md",
	title: "User Profile",
	questions: Object.freeze([
		{ key: "name", prompt: "What is your name?", required: true },
		{
			key: "handle",
			prompt: "What is your handle or nickname? (press Enter to skip)",
			required: false,
		},
		{
			key: "dob",
			prompt: "What is your date of birth? (press Enter to skip)",
			required: false,
		},
		{
			key: "location",
			prompt: "Where are you located? (city, country) (press Enter to skip)",
			required: false,
		},
		{
			key: "relationshipStatus",
			prompt: "What is your relationship status? (press Enter to skip)",
			required: false,
		},
	]),
});

/**
 * Preferences category: timezone, language, dietary restrictions, tone, response length.
 */
export const PREFERENCES_GROUP = Object.freeze({
	id: "preferences",
	label: "Preferences",
	filePath: "preferences.md",
	title: "Preferences",
	questions: Object.freeze([
		{
			key: "timezone",
			prompt: "What is your timezone? (press Enter to skip)",
			required: false,
		},
		{
			key: "language",
			prompt: "What is your preferred language? (press Enter to skip)",
			required: false,
		},
		{
			key: "dietaryRestrictions",
			prompt: "Do you have any dietary restrictions? (press Enter to skip)",
			required: false,
		},
		{
			key: "tone",
			prompt:
				"Preferred communication tone? (e.g., formal, casual, humorous) (press Enter to skip)",
			required: false,
		},
		{
			key: "responseLength",
			prompt: "Preferred response length? (e.g., concise, detailed) (press Enter to skip)",
			required: false,
		},
	]),
});

/**
 * Personal category: pets, hobbies, milestones, free-form insights.
 */
export const PERSONAL_GROUP = Object.freeze({
	id: "personal",
	label: "Personal",
	filePath: "personal.md",
	title: "Personal Life",
	questions: Object.freeze([
		{
			key: "pets",
			prompt: "Do you have any pets? (press Enter to skip)",
			required: false,
		},
		{
			key: "hobbies",
			prompt: "What are your hobbies or interests? (press Enter to skip)",
			required: false,
		},
		{
			key: "milestones",
			prompt: "Any notable life events or milestones? (press Enter to skip)",
			required: false,
		},
		{
			key: "insights",
			prompt: "Any other insights you'd like to share? (press Enter to skip)",
			required: false,
		},
	]),
});

export const QUESTIONNAIRES = Object.freeze([IDENTITY_GROUP, PREFERENCES_GROUP, PERSONAL_GROUP]);

// --- Context detection ---

/**
 * Check if a directory contains zero .md files.
 * @param {string} dirPath - Path to the context directory
 * @returns {boolean} True if the directory exists and has no .md files
 */
export function isEmptyContextDir(dirPath) {
	if (!existsSync(dirPath)) {
		return true;
	}
	const files = readdirSync(dirPath);
	return !files.some((f) => f.endsWith(".md"));
}

/**
 * Ensure a directory exists, creating it if necessary.
 * @param {string} dirPath - Path to the directory
 * @returns {void}
 */
export function ensureDir(dirPath) {
	if (!existsSync(dirname(dirPath))) {
		mkdirSync(dirname(dirPath), { recursive: true });
	}
	if (!existsSync(dirPath)) {
		mkdirSync(dirPath, { recursive: true });
	}
}

/**
 * Load existing YAML frontmatter from a file, or return empty object if
 * the file does not exist or has no frontmatter.
 * @param {string} filePath - Path to the markdown file
 * @returns {Record<string, unknown>} Existing frontmatter data
 */
export function loadExistingFrontmatter(filePath) {
	if (!existsSync(filePath)) {
		return {};
	}
	try {
		const content = readFileSync(filePath, "utf-8");
		return parseFrontmatter(content).frontmatter;
	} catch {
		return {};
	}
}

// --- Interactive Q&A ---

/**
 * Run an interactive questionnaire session using readline.
 * Prompts for each question in order, collecting answers into a result object.
 * Skips optional questions when the user provides empty input.
 * Rejects empty input for required fields and re-prompts.
 * @param {QuestionDef[]} questions - Questions to ask
 * @param {Record<string, unknown>} existingData - Previously collected data (skips filled fields)
 * @param {object} [opts] - Optional configuration
 * @param {import("node:readline").Interface} [opts.readline] - Readline interface (for testing)
 * @returns {Promise<Record<string, string>>} Collected answers
 */
export async function runQuestionnaire(questions, existingData, opts) {
	const rl = opts?.readline || createInterface({ input: process.stdin, output: process.stdout });
	const answers = { ...existingData };

	for (const question of questions) {
		const existingKey = question.key;
		if (
			existingKey in answers &&
			answers[existingKey] !== undefined &&
			answers[existingKey] !== "not provided"
		) {
			continue;
		}

		// eslint-disable-next-line no-async-promise-executor
		await new Promise((resolve, reject) => {
			const onLine = (line) => {
				const trimmed = line.trimEnd();
				if (trimmed === "" && question.required) {
					rl.question(`${question.prompt} (required) `, onLine);
					return;
				}
				answers[existingKey] = trimmed === "" ? "not provided" : trimmed;
				rl.removeListener("line", onLine);
				rl.removeListener("close", onAbort);
				rl.close();
				resolve(undefined);
			};

			const onAbort = () => {
				rl.removeListener("line", onLine);
				rl.removeListener("close", onAbort);
				reject(new Error("Q&A interrupted"));
			};

			rl.on("line", onLine);
			rl.on("close", onAbort);
			rl.question(`${question.prompt} `, (initial) => {
				const trimmed = initial.trimEnd();
				if (trimmed === "" && question.required) {
					rl.question(`${question.prompt} (required) `, onLine);
					return;
				}
				answers[existingKey] = trimmed === "" ? "not provided" : trimmed;
				rl.removeListener("line", onLine);
				rl.removeListener("close", onAbort);
				rl.close();
				resolve(undefined);
			});
		});
	}

	return answers;
}

// --- File writing ---

/**
 * Generate a human-readable markdown body from collected profile data.
 * @param {Record<string, string>} data - Collected field data
 * @returns {string} Markdown body text
 */
export function generateBody(data) {
	const lines = [];
	for (const [key, value] of Object.entries(data)) {
		if (value === "not provided") continue;
		const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
		lines.push(`- **${label}:** ${value}`);
	}
	if (lines.length === 0) {
		return "No information provided.";
	}
	return lines.join("\n");
}

/**
 * Write a canonical profile file with frontmatter and body.
 * Merges with existing frontmatter if file exists — never overwrites filled values.
 * @param {Record<string, string>} newAnswers - Answers from Q&A for this category
 * @param {Record<string, string>} existingAnswers - Previously filled answers
 * @param {Record<string, string>} allAnswers - Complete answers from Q&A
 * @param {object} fileConfig - File configuration
 * @param {string} fileConfig.filePath - Output file path within contextDir
 * @param {string} fileConfig.title - Title for the file heading
 * @param {string} fileConfig.categoryId - Category identifier for index
 * @param {string} fileConfig.contextDir - Base context directory
 * @returns {{ frontmatter: Record<string, unknown>, body: string }} Written file content
 */
export function buildCanonicalFile(newAnswers, existingAnswers, allAnswers, fileConfig) {
	const merged = { ...existingAnswers, ...newAnswers };
	const body = generateBody(newAnswers);
	return {
		frontmatter: merged,
		body,
		filePath: join(fileConfig.contextDir, fileConfig.filePath),
	};
}

// --- Memory index ---

/**
 * Read memory index file and return existing entries.
 * @param {string} indexPath - Path to memory/_index.md
 * @returns {Array<{ path: string; title: string; timestamp: string }>} Existing entries
 */
export function readMemoryIndex(indexPath) {
	if (!existsSync(indexPath)) {
		return [];
	}
	try {
		const content = readFileSync(indexPath, "utf-8");
		const { frontmatter } = parseFrontmatter(content);
		const entries = frontmatter.entries;
		return Array.isArray(entries) ? entries : [];
	} catch {
		return [];
	}
}

/**
 * Write index file atomically using temp file + rename.
 * @param {string} indexPath - Path to memory/_index.md
 * @param {Array<{ path: string; title: string; timestamp: string }>} entries - Full entry list
 * @returns {void}
 */
export function writeMemoryIndex(indexPath, entries) {
	const indexFile = {
		title: "Memory Index",
		entries,
	};
	const tempPath = indexPath + ".tmp";
	const content = buildMarkdownFile({ ...indexFile }, "");
	writeFileSync(tempPath, content, "utf-8");
	renameSync(tempPath, indexPath);
}

// --- Core tool implementation ---

/**
 * Schema for the customize tool input (always empty as it is interactive).
 */
export const CustomizeSchema = z.object({
	force: z.boolean().optional().describe("Force re-run even if context files exist"),
});

/**
 * @param {z.infer<typeof CustomizeSchema>} input - Tool input
 * @param {object} options - Runtime options
 * @param {string} [options.contextDir] - Context directory path
 * @returns {Promise<string>} Result message
 */
export async function customizeImpl(input, options) {
	const ctxDir = options?.contextDir || "memory/context/";
	const contextDir = ctxDir && isAbsolute(ctxDir) ? ctxDir : join("./", ctxDir);
	const idxPath = options?.indexPath;
	const indexPath = idxPath && isAbsolute(idxPath) ? idxPath : join("./", "memory/_index.md");

	ensureDir(contextDir);

	if (!isEmptyContextDir(contextDir) && !input.force) {
		return "Profile already exists. Context directory is not empty. Skip customization.";
	}

	const results = [];

	const existingFiles = [];
	if (!isEmptyContextDir(contextDir)) {
		const files = readdirSync(contextDir);
		existingFiles.length = files.filter((f) => f.endsWith(".md")).length;
	}

	for (const category of QUESTIONNAIRES) {
		const fileRelative = join(contextDir, category.filePath);
		const existingAnswers = loadExistingFrontmatter(fileRelative);
		const fillableKeys = category.questions
			.filter((q) => !(q.key in existingAnswers) || existingAnswers[q.key] === "not provided")
			.map((q) => q.key);

		let answers;
		if (fillableKeys.length === 0) {
			answers = existingAnswers;
		} else {
			const existingSubset = {};
			for (const [k, v] of Object.entries(existingAnswers)) {
				if (fillableKeys.includes(k)) {
					existingSubset[k] = v;
				}
			}
			const questionsToAsk = category.questions.filter((q) => fillableKeys.includes(q.key));
			try {
				answers = await runQuestionnaire(questionsToAsk, existingSubset, {});
			} catch {
				answers = {};
				for (const q of questionsToAsk) {
					answers[q.key] = "not provided";
				}
			}
		}

		const fileConfig = {
			filePath: category.filePath,
			title: category.title,
			categoryId: category.id,
			contextDir,
		};

		const { frontmatter, body, filePath } = buildCanonicalFile(
			answers,
			existingAnswers,
			answers,
			fileConfig,
		);

		const markdown = buildMarkdownFile(frontmatter, body);
		writeFileSync(filePath, markdown, "utf-8");
		results.push(filePath.replace("./", ""));
	}

	// Update memory index
	const timestamp = new Date().toISOString();
	const existingEntries = readMemoryIndex(indexPath);
	const newEntries = results.map((path) => ({
		path,
		title: path
			.replace(".md", "")
			.replace("-", " ")
			.replace(/^\w/, (s) => s.toUpperCase()),
		timestamp,
	}));
	writeMemoryIndex(indexPath, [...existingEntries, ...newEntries]);

	return `Customization complete. Created ${results.length} file(s): ${results.join(", ")}.\nIndex updated with ${newEntries.length} new entry/entries.`;
}

/**
 * @param {z.infer<typeof CustomizeSchema>} input
 * @param {object} _options - Runtime options
 * @returns {string}
 */
export const customize = tool(customizeImpl, {
	name: "customize",
	description:
		"Run an interactive questionnaire to build a canonical user profile. Stores identity, preferences, and personal data as memory/context files with YAML frontmatter. Updates memory/_index.md. Use when memory/context/ is empty or with force=true to re-run.",
	schema: CustomizeSchema,
});

// --- Factory function ---

/**
 * Create a customize tool with runtime options.
 * @param {object} options - Runtime options
 * @returns {object} LangChain Tool instance
 */
export function createCustomizeTool(options) {
	return tool((input) => customizeImpl(input, options), {
		name: "customize",
		description:
			"Run an interactive questionnaire to build a canonical user profile. Stores identity, preferences, and personal data as memory/context files with YAML frontmatter. Updates memory/_index.md.",
		schema: CustomizeSchema,
	});
}
