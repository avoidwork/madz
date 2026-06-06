import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Core logic for listing all discovered skills via catalog (tier 1 progressive disclosure).
 * @param {z.infer<typeof SkillsListSchema>} input - The tool input (empty)
 * @param {object} options - Runtime options
 * @param {object} options.registry - The skill registry instance
 * @returns {object} List of skills with name, description, and location
 */
export async function skillsListImpl(input, options) {
	const registry = options?.registry;
	const catalog =
		registry && typeof registry.getCatalog === "function" ? registry.getCatalog() : [];

	if (catalog.length === 0) {
		return {
			skills: [],
			count: 0,
			message: "No skills discovered. Run discovery to find available skills.",
		};
	}

	return {
		skills: catalog.map((s) => ({
			name: s.name,
			description: s.description,
			location: s.location,
		})),
		count: catalog.length,
	};
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
 * Legacy access path for manual TUI inspection.
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
		license: skill.metadata?.license || undefined,
		compatibility: skill.metadata?.compatibility || undefined,
		metadata: skill.metadata?.metadata || undefined,
		permissions: skill.metadata?.permissions || [],
		scripts: skill.metadata?.scripts || undefined,
	};

	// Try to read SKILL.md body if available
	const body =
		registry && typeof registry.getSkillBody === "function" ? registry.getSkillBody(name) : null;
	if (body) {
		result.skill_md = body;
	} else {
		// node:coverage ignore next
		result.skill_md = "SKILL.md body not accessible";
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
		"View full details for a skill by name (legacy access path). Returns name, version, description, license, compatibility, metadata, permissions, scripts, and full SKILL.md body. Prefer progressive disclosure via getCatalog for normal usage.",
	schema: z.object({
		name: z.string().describe("Name of the skill to view"),
	}),
});

// --- Progressive disclosure: system prompt catalog ---

/**
 * Format the skill catalog as a system prompt section.
 * Lists all discovered skills with name and description for model-driven relevance matching.
 * @param {Array<{ name: string, description: string, location: string }>} catalog - The skill catalog
 * @returns {string} Formatted prompt section
 */
export function generateSkillCatalogPrompt(catalog) {
	if (!catalog || catalog.length === 0) {
		return "";
	}

	const lines = ["# Available Skills\n"];
	for (const skill of catalog) {
		lines.push(`## ${skill.name}`);
		if (skill.description) {
			lines.push(skill.description);
		}
		lines.push(`Location: ${skill.location}`);
		lines.push("");
	}

	return lines.join("\n");
}

// --- Factory functions for creating tools with runtime options ---

/**
 * Create a skills_list tool with runtime options
 * @param {object} options - Runtime options
 * @returns {object} LangChain Tool instance
 */
export function createSkillsListTool(options) {
	return tool((input) => skillsListImpl(input, options), {
		name: "skills_list",
		description:
			"List all discovered skills via catalog with name, description, and location. Returns { skills: [...], count: N }. Prefer using the system prompt skill catalog for normal operation.",
		schema: z.object({}).default({}),
	});
}

/**
 * Create a skill_view tool with runtime options
 * @param {object} options - Runtime options
 * @returns {object} LangChain Tool instance
 */
export function createSkillViewTool(options) {
	return tool((input) => skillViewImpl(input, options), {
		name: "skill_view",
		description:
			"View full details for a skill by name (legacy path). Returns name, version, description, license, compatibility, metadata, permissions, scripts, and SKILL.md body.",
		schema: z.object({
			name: z.string().describe("Name of the skill to view"),
		}),
	});
}
