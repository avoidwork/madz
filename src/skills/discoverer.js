import { readdir, stat, readFile, access, constants } from "node:fs/promises";
import { join, basename, resolve } from "node:path";
import { load } from "js-yaml";
import { loadConfig } from "../config/loader.js";
import { logger } from "../shared/logger.js";

export const defaultScope = loadConfig().sandbox.skillScanPaths;
export let cwd = loadConfig().cwd;

/**
 * Set the working directory for skill discovery.
 * @param {string} newCwd - The new working directory
 */
export function setCwd(newCwd) {
	cwd = newCwd;
}

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
		frontmatter = load(yamlStr);
	} catch (_err) {
		// Fallback to lenient parsing
		frontmatter = lenientYamlParse(yamlStr);
	}

	if (!frontmatter || typeof frontmatter !== "object") {
		return { frontmatter: null, body: content.trim() };
	}

	// Merge metadata block if present (second YAML block between 2nd and 3rd ---)
	if (parts.length >= 3 && parts[2].trim()) {
		const metadataStr = parts[2].trim();
		let metadata;
		try {
			metadata = yaml.load(metadataStr);
		} catch (_err) {
			metadata = lenientYamlParse(metadataStr);
		}
		if (metadata && typeof metadata === "object") {
			// Flatten the metadata: wrapper if present — the agent field should be
			// at the top level of the merged frontmatter, not nested under metadata.
			const payload =
				metadata.metadata && typeof metadata.metadata === "object" ? metadata.metadata : metadata;
			frontmatter = { ...frontmatter, ...payload };
		}
	}

	return { frontmatter, body };
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
	} catch (_err) {
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
			return load(fixed);
		} catch (_err) {
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
 * @returns {Promise<string[]>} Array of paths to SKILL.md files
 */
async function findSkillFiles(dir) {
	const skills = [];

	try {
		const entries = await readdir(dir);
		for (const entry of entries) {
			if (shouldSkip(entry)) continue;
			const fullPath = join(dir, entry);
			const st = await stat(fullPath);
			if (st.isDirectory()) {
				const skillMdPath = join(fullPath, SKILL_DIR);
				try {
					await access(skillMdPath, constants.F_OK);
					const frontmatter = extractFrontmatter(await readFile(skillMdPath, "utf-8"));

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
					try {
						const scriptsStat = await stat(skillScripts);
						if (scriptsStat.isDirectory()) {
							metadata.scripts = skillScripts;
						}
					} catch (err) {
						logger.debug(`[discoverer] Error: ${err.message}`);
					}

					skills.push({
						path: fullPath,
						name: basename(fullPath),
						metadata,
					});
				} catch (err) {
					logger.debug(`[discoverer] Error: ${err.message}`);
				}
			}
		}
	} catch (err) {
		logger.debug(`[discoverer] Error: ${err.message}`);
	}

	return skills;
}

/**
 * Discover skills from multiple directory scopes.
 * @param {string[]} [scope] - Array of directories to scan (defaults to sandbox.skillScanPaths from config)
 * @param {object} [options] - Discovery options
 * @param {boolean} [options.trustProjectSkills=true] - Whether to trust project-level skills
 * @returns {Promise<Array<{ path: string, name: string, metadata: Object }>>}
 */
export async function discoverSkills(scope = defaultScope, options = {}) {
	const cwdParam = options.cwd || cwd;
	const { trustProjectSkills: _trustProjectSkills = true } = options;
	const allSkills = [];
	const seenNames = new Map();

	for (const scopePath of scope) {
		const fullScope = resolve(cwdParam, scopePath);
		try {
			await access(fullScope, constants.F_OK);
		} catch (_err) {
			continue;
		}

		const skills = await findSkillFiles(fullScope);

		for (const skill of skills) {
			const name = skill.metadata.name || skill.name;
			if (!name) continue;

			if (seenNames.has(name)) {
				const isNewHigherPriority = skill.path.includes(".skills/");
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
