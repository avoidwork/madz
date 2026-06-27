import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import yaml from "js-yaml";
import { loadConfig } from "../config/loader.js";

export const defaultScope = loadConfig().sandbox.skillScanPaths;

// Cross-client directory scope constants
const SKILL_DIR = "SKILL.md";

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Extracts content between `---` delimiters at the top of the file.
 * @param {string} content - The full SKILL.md file content
 * @returns {{ frontmatter: Object | null, body: string }}
 */
export function extractFrontmatter(content) {
	if (typeof content !== "string") {
		return { frontmatter: null, body: "" };
	}

	const parts = content.split("---");
	if (parts.length < 2 || !parts[1].trim()) {
		return { frontmatter: null, body: content.trim() };
	}

	const yamlStr = parts[1].trim();
	const body = parts.slice(2).join("---").trim();

	let frontmatter;
	try {
		frontmatter = yaml.load(yamlStr);
	} catch {
		// Fallback to lenient parsing
		frontmatter = lenientYamlParse(yamlStr);
	}

	if (frontmatter && typeof frontmatter === "object") {
		return { frontmatter, body };
	}

	return { frontmatter: null, body: content.trim() };
}

/**
 * Retry YAML parsing with lenient handling of unquoted colons.
 * Wraps values containing colons in double quotes to fix common YAML issues.
 * @param {string} yamlStr - The YAML string to parse
 * @returns {Object | null}
 */
export function lenientYamlParse(yamlStr) {
	try {
		return yaml.load(yamlStr);
	} catch {
		// Try quoting line values that contain unquoted colons (e.g., "description: Use when: the user asks")
		const fixed = yamlStr.replace(
			/^(\s*[\w-]+:\s*)(?!["'])(.*:.*)(\s*)$/gm,
			(_, prefix, value, suffix) => {
				// Skip if value already quoted or is empty
				if (/^["'].*["']$/.test(value.trim()) || value.trim() === "")
					return prefix + value + suffix;
				return prefix + '"' + value.trim().replace(/"/g, '\\"') + '"' + suffix;
			},
		);
		try {
			return yaml.load(fixed);
		} catch {
			return null;
		}
	}
}

/**
 * Check if a directory name should be skipped (dotfile, excluded dir).
 * @param {string} name - The directory name
 * @returns {boolean} True if should be skipped
 */
function shouldSkip(name) {
	if (name.startsWith(".")) return true;
	if (name === "node_modules") return true;
	if (name === ".git") return true;
	if (name === ".agents") return false; // .agents/skills is valid
	return false;
}

/**
 * Recursively scan a directory for SKILL.md files.
 * @param {string} dir - The directory to scan
 * @returns {string[]} Array of paths to SKILL.md files
 */
function findSkillFiles(dir) {
	const skills = [];

	try {
		const entries = readdirSync(dir);
		for (const entry of entries) {
			if (shouldSkip(entry)) continue;
			const fullPath = join(dir, entry);
			const st = statSync(fullPath);
			if (st.isDirectory()) {
				const skillMdPath = join(fullPath, SKILL_DIR);
				if (existsSync(skillMdPath)) {
					const frontmatter = extractFrontmatter(readFileSync(skillMdPath, "utf-8"));

					// Skip skills that lack valid frontmatter or required metadata
					if (!frontmatter.frontmatter) {
						continue;
					}

					const metadata = { ...frontmatter.frontmatter };

					// Cast name to string — YAML may parse numeric names as numbers
					if (metadata.name !== null && metadata.name !== undefined) {
						metadata.name = String(metadata.name);
					} else {
						continue;
					}

					// Required: non-empty description
					if (
						!metadata.description ||
						typeof metadata.description !== "string" ||
						metadata.description.trim().length === 0
					) {
						continue;
					}

					metadata._path = skillMdPath;
					metadata._directory = fullPath;

					// Check for skill-specific scripts directory
					const skillScripts = join(fullPath, "scripts");
					if (existsSync(skillScripts) && statSync(skillScripts).isDirectory()) {
						metadata.scripts = skillScripts;
					}

					skills.push({
						path: fullPath,
						name: basename(fullPath),
						metadata,
					});
				}
			}
		}
	} catch {
		// Directory doesn't exist or can't be read
	}

	return skills;
}

/**
 * Discover skills from multiple directory scopes.
 * @param {string[]} [scope] - Array of directories to scan (defaults to sandbox.skillScanPaths from config)
 * @param {object} [options] - Discovery options
 * @param {boolean} [options.trustProjectSkills=true] - Whether to trust project-level skills
 * @returns {Array<{ path: string, name: string, metadata: Object }>}
 */
export function discoverSkills(scope = defaultScope, options = {}) {
	const { trustProjectSkills: _trustProjectSkills = true } = options;
	const allSkills = [];
	const seenNames = new Map();

	for (const scopePath of scope) {
		const fullScope = resolve(scopePath);
		if (!existsSync(fullScope)) {
			continue;
		}

		const skills = findSkillFiles(fullScope);

		for (const skill of skills) {
			const name = skill.metadata.name || skill.name;
			if (!name) continue;

			if (seenNames.has(name)) {
				const isNewHigherPriority = skill.path.includes("system-skills/");
				if (isNewHigherPriority) {
					// System skills override user skills (shadow)
					seenNames.set(name, skill.path);
				}
				continue;
			}

			seenNames.set(name, skill.path);
			allSkills.push(skill);
		}
	}

	return allSkills;
}
