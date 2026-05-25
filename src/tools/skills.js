import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readFile, access } from "node:fs/promises";
import { join } from "node:path";

/**
 * Check if a file path is accessible.
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
async function pathExists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Core logic for listing all discovered skills.
 * @param {z.infer<typeof SkillsListSchema>} input - The tool input (empty)
 * @param {object} options - Runtime options
 * @param {object} options.registry - The skill registry instance
 * @returns {object} List of skills with summaries
 */
export async function skillsListImpl(input, options) {
	const registry = options?.registry;
	const skillNames = registry && typeof registry.list === "function" ? registry.list() : [];

	if (skillNames.length === 0) {
		return {
			skills: [],
			count: 0,
			message: "No skills discovered. Run discovery to find available skills.",
		};
	}

	const skills = [];
	for (const name of skillNames) {
		const skill = registry && typeof registry.get === "function" ? registry.get(name) : null;
		if (skill) {
			skills.push({
				name: skill.name || name,
				version: skill.metadata?.version || "1.0.0",
				description: skill.metadata?.description || "",
				permissions: skill.metadata?.permissions || [],
			});
		} else {
			skills.push({ name, version: "unknown", description: "", permissions: [] });
		}
	}

	return { skills, count: skills.length };
}

/**
 * Skills list tool that wraps skill core logic.
 * @param {z.infer<typeof SkillsListSchema>} input - The tool input (empty)
 * @param {object} options - Runtime options
 * @param {object} options.registry - The skill registry instance
 * @returns {object} List of skills with summaries
 */
export const skills_list = tool(skillsListImpl, {
	name: "skills_list",
	description:
		"List all discovered skills with their name, version, description, and permissions. Returns { skills: [...], count: N }.",
	schema: z.object({}).default({}),
});

/**
 * Core logic for viewing a single skill's details and SKILL.md content.
 * @param {z.infer<typeof SkillViewSchema>} input - The tool input
 * @param {object} options - Runtime options
 * @param {object} options.registry - The skill registry instance
 * @returns {object} Skill details and full SKILL.md content
 */
export async function skillViewImpl(input, options) {
	const registry = options?.registry;
	const name = input.name;
	const skill = registry && typeof registry.get === "function" ? registry.get(name) : null;

	if (!skill) {
		return {
			error: `Skill '${name}' was not found in the registry. Run discovery to find available skills.`,
		};
	}

	const result = {
		name: skill.name || name,
		version: skill.metadata?.version || "1.0.0",
		description: skill.metadata?.description || "",
		inputSchema: skill.metadata?.inputSchema || {},
		outputSchema: skill.metadata?.outputSchema || {},
		permissions: skill.metadata?.permissions || [],
		scripts: skill.metadata?.scripts || [],
	};

	// Try to read SKILL.md if available
	try {
		const skillPath = skill.metadata?._path || "";
		const skillMdPath = join(process.cwd(), skillPath, "SKILL.md");

		if (await pathExists(skillMdPath)) {
			const skillMd = await readFile(skillMdPath, "utf-8");
			result.skill_md = skillMd;
		}
	} catch {
		result.skill_md = "SKILL.md not found or unreadable";
	}

	return result;
}

/**
 * Skill view tool that wraps skill core logic.
 * @param {z.infer<typeof SkillViewSchema>} input - The tool input
 * @param {object} options - Runtime options
 * @param {object} options.registry - The skill registry instance
 * @returns {object} Skill details and full SKILL.md content
 */
export const skill_view = tool(skillViewImpl, {
	name: "skill_view",
	description:
		"View full details for a skill by name. Returns name, version, description, schemas, permissions, scripts, and full SKILL.md content.",
	schema: z.object({
		name: z.string().describe("Name of the skill to view"),
	}),
});
