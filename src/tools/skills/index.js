import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { dump } from "js-yaml";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import {
	validateSkillName,
	validateSkillDescription,
	validateOptionalFields,
	validateSkillSchema,
} from "../../skills/validator.js";
import { ensureSkillsDir } from "../../skills/registry.js";
import { PermissionSchema } from "../../skills/types.js";
import { loadConfig } from "../../config/loader.js";

export let cwd = process.cwd();

/**
 * Set the working directory. Used by tests to override cwd.
 * Returns the previous cwd value.
 * @param {string} newCwd - The new working directory
 * @returns {string} The previous cwd value
 */
export function setCwd(newCwd) {
	const prev = cwd;
	cwd = newCwd;
	return prev;
}

/**
 * Core logic for creating a spec-compliant skill directory with SKILL.md.
 * Validates metadata against Agent Skills spec, creates directory structure,
 * writes SKILL.md with YAML frontmatter, optionally scaffolds scripts/.
 * @param {z.infer<typeof CreateSkillSchema>} input - The tool input
 * @returns {Promise<{ success: boolean, name: string, paths: string[], registered: boolean, errors?: string[], warnings?: string[] }>}
 */
export async function createSkillImpl(input, options = {}) {
	const config = loadConfig();
	const { name, description, permissions, license, compatibility, metadata, scaffoldScripts } =
		input;
	const skillsDir = options.skillsDir || config.skillsDir || "skills/";
	const registry = options.registry || config.registry;
	const cwdParam = options.cwd || cwd;

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

	// Create the skill directory
	const skillPath = join(cwdParam, skillsDir, name);
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

	const frontmatterYaml = dump(frontmatter, {
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

/**
 * Enumerate the supporting files (scripts/, references/, assets/) for a skill
 * directory, excluding SKILL.md, capped at a fixed number of entries.
 * @param {string} skillDir - The skill directory path
 * @param {number} [limit=10] - Maximum number of files to return
 * @returns {Promise<string[]>} Array of relative file paths
 */
async function enumerateSkillFiles(skillDir, limit = 10) {
	const files = [];
	const subdirs = ["scripts", "references", "assets"];

	for (const subdir of subdirs) {
		if (files.length >= limit) break;
		const dir = join(skillDir, subdir);
		try {
			const entries = await readdir(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (files.length >= limit) break;
				if (entry.isDirectory()) continue;
				files.push(relative(skillDir, join(dir, entry.name)));
			}
		} catch (_err) {
			// Directory does not exist — skip.
		}
	}

	return files;
}

/**
 * Core logic for the `skill` tool. Loads a skill's SKILL.md body and a sampled
 * inventory of its supporting files (scripts/, references/, assets/) on demand,
 * so the agent can deterministically execute a skill's instructions.
 * @param {z.infer<typeof SkillToolSchema>} input - The tool input
 * @param {object} [options] - Runtime options
 * @param {object} [options.registry] - SkillRegistry instance
 * @returns {Promise<{ name: string, body: string, directory: string, files: string[] }>}
 */
export async function skillImpl(input, options = {}) {
	const { name } = input;
	const registry = options.registry;

	if (!registry || typeof registry.get !== "function") {
		return {
			name,
			body: "",
			directory: "",
			files: [],
			error: "Skill registry is unavailable.",
		};
	}

	const skill = registry.get(name);
	if (!skill) {
		return {
			name,
			body: "",
			directory: "",
			files: [],
			error: `Skill "${name}" not found.`,
		};
	}

	const body = await registry.getSkillBody(name);
	if (!body) {
		return {
			name,
			body: "",
			directory: skill.metadata?._directory || "",
			files: [],
			error: `Skill "${name}" body could not be loaded.`,
		};
	}

	const directory = skill.metadata?._directory || "";
	const files = directory ? await enumerateSkillFiles(directory) : [];

	return { name, body, directory, files };
}

/**
 * Skill tool that loads a skill's SKILL.md body and supporting-file inventory.
 * Takes a skill name and returns the full body plus a sampled list of the
 * skill's supporting files (scripts/, references/, assets/), excluding SKILL.md.
 * @param {z.infer<typeof SkillToolSchema>} input - The tool input
 * @returns {Promise<{ name: string, body: string, directory: string, files: string[] }>}
 */
export const skill = tool(skillImpl, {
	name: "skill",
	description:
		"Load a specialized skill when the task at hand matches one of the skills listed in the system prompt. Returns the full SKILL.md body plus a sampled inventory of the skill's supporting files (scripts/, references/, assets/). The skill name must match one of the registered skills.",
	schema: z.object({
		name: z.string().min(1).describe("The name of the skill to load"),
	}),
});
