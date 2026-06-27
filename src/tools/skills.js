import { tool } from "@langchain/core/tools";
import { z } from "zod";
import yaml from "js-yaml";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	validateSkillName,
	validateSkillDescription,
	validateOptionalFields,
	validateSkillSchema,
} from "../skills/validator.js";
import { ensureSkillsDir } from "../skills/registry.js";
import { PermissionSchema } from "../skills/types.js";
import { loadConfig } from "../config/loader.js";

export let cwd = loadConfig().cwd;

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
export const skillView = tool(skillViewImpl, {
	name: "skillView",
	description:
		"View full details for a skill by name (legacy access path). Returns name, version, description, license, compatibility, metadata, permissions, scripts, and full SKILL.md body. Prefer progressive disclosure via getCatalog for normal usage.",
	schema: z.object({
		name: z.string().describe("Name of the skill to view"),
	}),
});

/**
 * Core logic for creating a spec-compliant skill directory with SKILL.md.
 * Validates metadata against Agent Skills spec, creates directory structure,
 * writes SKILL.md with YAML frontmatter, optionally scaffolds scripts/.
 * @param {z.infer<typeof CreateSkillSchema>} input - The tool input
 * @param {object} options - Runtime options
 * @param {string} options.skillsDir - Path to the skills directory
 * @param {object} [options.registry] - The skill registry instance
 * @returns {Promise<{ success: boolean, name: string, paths: string[], registered: boolean, errors?: string[], warnings?: string[] }>}
 */
export async function createSkillImpl(input, options) {
	const { name, description, permissions, license, compatibility, metadata, scaffoldScripts } =
		input;
	const { skillsDir = "skills/", registry } = options || {};

	// Validate name against spec constraints
	const nameResult = validateSkillName(name);
	if (!nameResult.valid) {
		return { success: false, name, paths: [], registered: false, errors: nameResult.warnings };
	}

	// Skip if skill already registered
	if (registry && typeof registry.has === "function" && registry.has(name)) {
		return {
			success: false,
			name,
			paths: [],
			registered: false,
			errors: [`Skill "${name}" already exists in the registry`],
		};
	}

	// Validate description (fatal if missing/empty/too long)
	const descResult = validateSkillDescription(description);
	if (descResult.skip) {
		return { success: false, name, paths: [], registered: false, errors: descResult.warnings };
	}
	if (!descResult.valid) {
		return { success: false, name, paths: [], registered: false, errors: descResult.warnings };
	}

	// Validate permissions if provided
	const warnings = [...nameResult.warnings, ...descResult.warnings];
	if (permissions && permissions.length > 0) {
		for (const perm of permissions) {
			const parseResult = PermissionSchema.safeParse(perm);
			if (!parseResult.success) {
				return {
					success: false,
					name,
					paths: [],
					registered: false,
					errors: [
						`Invalid permission "${perm}": must be one of filesystem:read, filesystem:write, filesystem:exec, network:outbound, process:spawn, env:read`,
					],
				};
			}
		}
	}

	// Validate optional fields against spec constraints
	const optionalWarnings = validateOptionalFields({
		compatibility,
		metadata: metadata || undefined,
	});
	if (optionalWarnings.length > 0) {
		warnings.push(...optionalWarnings);
	}

	// Build metadata object following Agent Skills spec
	const skillMetadata = {
		name,
		description,
	};

	if (license !== undefined) {
		skillMetadata.license = license;
	}

	if (compatibility !== undefined) {
		skillMetadata.compatibility = compatibility;
	}

	if (metadata && Object.keys(metadata).length > 0) {
		skillMetadata.metadata = metadata;
	}

	if (permissions && permissions.length > 0) {
		skillMetadata.permission = permissions;
	}

	// Run full spec validation before writing
	const fullResult = validateSkillSchema(skillMetadata, name);
	if (!fullResult.valid) {
		return {
			success: false,
			name,
			paths: [],
			registered: false,
			errors: fullResult.errors,
			warnings: fullResult.warnings,
		};
	}

	// Create the skill directory
	const skillPath = join(cwd, skillsDir, name);
	const skillMdPath = join(skillPath, "SKILL.md");
	let createdPaths = [skillPath, skillMdPath];

	try {
		await ensureSkillsDir(skillsDir);
		await mkdir(skillPath, { recursive: true });
	} catch (err) {
		return {
			success: false,
			name,
			paths: [],
			registered: false,
			errors: [`Failed to create skill directory: ${err.message}`],
		};
	}

	// Generate YAML frontmatter
	const frontmatter = { name: skillMetadata.name, description: skillMetadata.description };
	if (skillMetadata.license) frontmatter.license = skillMetadata.license;
	if (skillMetadata.compatibility) frontmatter.compatibility = skillMetadata.compatibility;
	if (skillMetadata.metadata) frontmatter.metadata = skillMetadata.metadata;

	const frontmatterYaml = yaml.dump(frontmatter, {
		indentRows: 2,
		stringType: "double",
		forceQuotes: false,
		noRefs: true,
	});

	const skillMdContent = `---\n${frontmatterYaml}---\n`;

	try {
		await writeFile(skillMdPath, skillMdContent, "utf-8");
	} catch (err) {
		return {
			success: false,
			name,
			paths: createdPaths,
			registered: false,
			errors: [`Failed to write SKILL.md: ${err.message}`],
		};
	}

	// Scaffolding
	if (scaffoldScripts) {
		const scriptsDir = join(skillPath, "scripts");
		createdPaths.push(scriptsDir);

		try {
			await mkdir(scriptsDir, { recursive: true });
			const readmePath = join(scriptsDir, "README.md");
			await writeFile(
				readmePath,
				"# Scripts\n\nPlace executable scripts here. Supported languages depend on the agent implementation.\n\nThe harness detects interpreters via file extension:\n- `.py` — Python 3\n- `.sh`, `.bash` — Bash\n- `.js`, `.mjs` — Node.js\n- `.rb` — Ruby\n- `.ts` — Node.js with tsx\n\nScripts can reference other files in the skill using relative paths from the skill root.\n",
				"utf-8",
			);
		} catch (err) {
			// Non-fatal — skill still created
			warnings.push(`Failed to scaffold scripts: ${err.message}`);
		}
	}

	// Register with registry if available
	let registered = false;
	if (registry && typeof registry.register === "function") {
		const regResult = registry.register(name, {
			...skillMetadata,
			_path: skillMdPath,
			_directory: skillPath,
		});
		registered = regResult.valid;
		if (registered) {
			warnings.push("Skill registered with the registry");
		} else {
			warnings.push(...(regResult.warnings || []));
		}
	}

	return {
		success: true,
		name,
		paths: createdPaths,
		registered,
		warnings: warnings.length > 0 ? warnings : undefined,
	};
}

/**
 * Create skill tool that wraps skill core logic.
 * Creates a spec-compliant skill directory, writes SKILL.md with YAML frontmatter,
 * and optionally scaffolds a scripts/ directory.
 * @param {z.infer<typeof CreateSkillSchema>} input - The tool input
 * @param {object} options - Runtime options
 * @param {string} options.skillsDir - Path to the skills directory
 * @param {object} [options.registry] - The skill registry instance
 * @returns {Promise<{ success: boolean, name: string, paths: string[], registered: boolean, errors?: string[], warnings?: string[] }>}
 */
export const createSkill = tool(createSkillImpl, {
	name: "createSkill",
	description:
		"Create a new Agent Skills spec-compliant skill. Creates the skill directory under skills/, writes SKILL.md with YAML frontmatter, and optionally scaffolds a scripts/ directory. Validates name (lowercase alphanumeric + hyphens, 1-64 chars), description (1-1024 chars), and other spec constraints before writing. Returns { success, name, paths, registered, errors?, warnings? }. Errors prevent creation.",
	schema: z.object({
		name: z
			.string()
			.min(1)
			.max(64)
			.describe("Skill name (lowercase alphanumeric + hyphens, 1-64 characters)"),
		description: z
			.string()
			.min(1)
			.max(1024)
			.describe("What the skill does and when to use it (1-1024 characters)"),
		permissions: z
			.array(PermissionSchema)
			.optional()
			.describe(
				"Permission scopes for sandbox execution: filesystem:read, filesystem:write, filesystem:exec, network:outbound, process:spawn, env:read",
			),
		license: z.string().optional().describe("Open-source license for the skill (e.g., Apache-2.0)"),
		compatibility: z
			.string()
			.max(500)
			.optional()
			.describe(
				"Environment requirements (intended product, system packages, network access). Max 500 characters.",
			),
		metadata: z
			.record(z.string())
			.optional()
			.describe("Arbitrary key-value metadata (string to string map)"),
		scaffoldScripts: z
			.boolean()
			.optional()
			.default(false)
			.describe("Create a scripts/ directory with a README.md placeholder"),
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
		name: "skillsList",
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
		name: "skillView",
		description:
			"View full details for a skill by name (legacy path). Returns name, version, description, license, compatibility, metadata, permissions, scripts, and SKILL.md body.",
		schema: z.object({
			name: z.string().describe("Name of the skill to view"),
		}),
	});
}

/**
 * Create a create_skill tool with runtime options
 * @param {object} options - Runtime options
 * @returns {object} LangChain Tool instance
 */
export function createCreateSkillTool(options) {
	return tool((input) => createSkillImpl(input, options), {
		name: "createSkill",
		description:
			"Create a new Agent Skills spec-compliant skill. Creates the skill directory, writes SKILL.md with YAML frontmatter, and optionally scaffolds a scripts/ directory. Returns { success, name, paths, registered, errors?, warnings? }. Errors prevent creation.",
		schema: z.object({
			name: z
				.string()
				.min(1)
				.max(64)
				.describe("Skill name (lowercase alphanumeric + hyphens, 1-64 characters)"),
			description: z
				.string()
				.min(1)
				.max(1024)
				.describe("What the skill does and when to use it (1-1024 characters)"),
			permissions: z
				.array(PermissionSchema)
				.optional()
				.describe(
					"Permission scopes for sandbox execution: filesystem:read, filesystem:write, filesystem:exec, network:outbound, process:spawn, env:read",
				),
			license: z
				.string()
				.optional()
				.describe("Open-source license for the skill (e.g., Apache-2.0)"),
			compatibility: z
				.string()
				.max(500)
				.optional()
				.describe(
					"Environment requirements (intended product, system packages, network access). Max 500 characters.",
				),
			metadata: z
				.record(z.string())
				.optional()
				.describe("Arbitrary key-value metadata (string to string map)"),
			scaffoldScripts: z
				.boolean()
				.optional()
				.default(false)
				.describe("Create a scripts/ directory with a README.md placeholder"),
		}),
	});
}
