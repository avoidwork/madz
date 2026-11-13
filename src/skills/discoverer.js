import { readdir, stat, readFile, access, realpath, constants } from "node:fs/promises";
import { join, basename, resolve, relative, isAbsolute } from "node:path";
import { load } from "js-yaml";
import { loadConfig } from "../config/loader.js";
import { logger } from "../shared/logger.js";
import { getAgentForSkill } from "./agentMapper.js";

export const defaultScope = loadConfig().sandbox.skillScanPaths;
export let cwd = loadConfig().cwd;

/**
 * Set the working directory for skill discovery.
 * @param {string} newCwd - The new working directory
 */
export function setCwd(newCwd) {
	cwd = newCwd;
}

const SKILL_DIR = "SKILL.md";
// A scope is the bundled scope only when its directory's own basename is exactly this.
const BUNDLED_SCOPE_DIR = ".skills";

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Extracts content between `---` delimiters at the top of the file.
 * A leading UTF-8 BOM is ignored.
 * @param {string} content - The full SKILL.md file content
 * @returns {{ frontmatter: Object | null, body: string }}
 */
export function extractFrontmatter(content) {
	if (typeof content !== "string") {
		return { frontmatter: null, body: "" };
	}

	const text = content.replace(/^\uFEFF/, "");
	const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
	if (!match || !match[1].trim()) {
		return { frontmatter: null, body: text.trim() };
	}

	const yamlStr = match[1].trim();
	const body = text.slice(match[0].length).trim();

	let frontmatter;
	try {
		frontmatter = load(yamlStr);
	} catch (_err) {
		// Fallback to lenient parsing
		frontmatter = lenientYamlParse(yamlStr);
	}

	if (!frontmatter || typeof frontmatter !== "object") {
		return { frontmatter: null, body: text.trim() };
	}

	return { frontmatter, body };
}

/**
 * Parse YAML, retrying with lenient handling of unquoted colons.
 * Wraps values containing colons in double quotes to fix common YAML issues.
 * @param {string} yamlStr - The YAML string to parse
 * @returns {Object | null} The parsed value, or null when it cannot be parsed
 */
export function lenientYamlParse(yamlStr) {
	try {
		return load(yamlStr);
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
		} catch (err) {
			logger.debug(`[discoverer] Lenient YAML parse failed: ${err.message}`);
			return null;
		}
	}
}

/**
 * Check if a directory entry should be skipped (dot-entries and node_modules).
 * @param {string} name - The entry name
 * @returns {boolean} True if should be skipped
 */
function shouldSkip(name) {
	return name.startsWith(".") || name === "node_modules";
}

/**
 * Check whether a real path is strictly inside a real directory path.
 * @param {string} root - Real path of the containing directory
 * @param {string} target - Real path to test
 * @returns {boolean} True if target is inside root
 */
function isInside(root, target) {
	const rel = relative(root, target);
	return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Load a single candidate skill directory.
 * Returns null (after logging) when the entry is not a usable skill.
 * @param {string} fullPath - Path to the candidate skill directory
 * @param {string} realScope - Real path of the scope directory being scanned
 * @param {boolean} bundled - Whether the scope is the bundled `.skills/` scope
 * @returns {Promise<{ path: string, name: string, bundled: boolean, metadata: Object } | null>}
 */
async function loadSkillDir(fullPath, realScope, bundled) {
	const st = await stat(fullPath);
	if (!st.isDirectory()) return null;

	const realDir = await realpath(fullPath);
	if (!isInside(realScope, realDir)) {
		logger.warn(`[discoverer] Skipping "${fullPath}": resolves outside scope (${realDir})`);
		return null;
	}

	const skillMdPath = join(fullPath, SKILL_DIR);
	try {
		await access(skillMdPath, constants.F_OK);
	} catch (err) {
		logger.debug(`[discoverer] No ${SKILL_DIR} in "${fullPath}": ${err.message}`);
		return null;
	}

	const { frontmatter } = extractFrontmatter(await readFile(skillMdPath, "utf-8"));
	if (!frontmatter) {
		logger.warn(`[discoverer] Skipping "${skillMdPath}": missing or invalid frontmatter`);
		return null;
	}

	const metadata = { ...frontmatter };

	if (metadata.name === null || metadata.name === undefined) {
		logger.warn(`[discoverer] Skipping "${skillMdPath}": frontmatter has no name`);
		return null;
	}
	// Cast name to string — YAML may parse numeric names as numbers
	metadata.name = String(metadata.name);

	if (typeof metadata.description !== "string" || metadata.description.trim().length === 0) {
		logger.warn(`[discoverer] Skipping "${skillMdPath}": missing or empty description`);
		return null;
	}

	// Inject agent from config if not present in frontmatter metadata
	if (!metadata.metadata?.agent) {
		const agent = getAgentForSkill(basename(fullPath), loadConfig());
		if (agent) {
			metadata.metadata = { ...metadata.metadata, agent };
		}
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
		logger.debug(`[discoverer] No scripts directory in "${fullPath}": ${err.message}`);
	}

	return { path: fullPath, name: basename(fullPath), bundled, metadata };
}

/**
 * Scan one directory level for skill subdirectories containing a SKILL.md.
 * A failing entry is logged and skipped; it never aborts the rest of the scan.
 * @param {string} dir - The scope directory to scan
 * @param {boolean} bundled - Whether the scope is the bundled `.skills/` scope
 * @returns {Promise<Array<{ path: string, name: string, bundled: boolean, metadata: Object }>>}
 */
async function findSkillFiles(dir, bundled) {
	const skills = [];

	let entries;
	let realScope;
	try {
		entries = await readdir(dir);
		realScope = await realpath(dir);
	} catch (err) {
		logger.warn(`[discoverer] Cannot scan "${dir}": ${err.message}`);
		return skills;
	}

	for (const entry of entries) {
		if (shouldSkip(entry)) continue;
		const fullPath = join(dir, entry);
		try {
			const skill = await loadSkillDir(fullPath, realScope, bundled);
			if (skill) skills.push(skill);
		} catch (err) {
			logger.warn(`[discoverer] Skipping "${fullPath}": ${err.message}`);
		}
	}

	return skills;
}

/**
 * Discover skills from multiple directory scopes.
 *
 * On a name clash (keyed by directory name) priority is independent of scan order: a bundled
 * skill (scope directory named exactly `.skills`) always wins over a non-bundled one, and the
 * non-bundled skill is ignored with a warning. Between two skills of the same kind the first
 * scanned wins, with a warning. Skill directories whose real path is outside their scope
 * directory (e.g. escaping symlinks) are skipped with a warning.
 * @param {string[]} [scope] - Array of directories to scan (defaults to sandbox.skillScanPaths from config)
 * @param {object} [options] - Discovery options
 * @param {string} [options.cwd] - Directory that relative scope paths resolve against
 * @param {boolean} [options.bundledSkills=true] - Whether to load bundled `.skills/` skills. When `false`,
 *   only the `reflection` skill is loaded from the `.skills/` scope; user skills in `skills/` are unaffected.
 * @returns {Promise<Array<{ path: string, name: string, bundled: boolean, metadata: Object }>>}
 */
export async function discoverSkills(scope = defaultScope, options = {}) {
	const cwdParam = options.cwd || cwd;
	const { bundledSkills = true } = options;
	const allSkills = [];
	const indexByName = new Map();

	for (const scopePath of scope) {
		const fullScope = resolve(cwdParam, scopePath);
		try {
			await access(fullScope, constants.F_OK);
		} catch (_err) {
			continue;
		}

		const bundled = basename(fullScope) === BUNDLED_SCOPE_DIR;
		let skills = await findSkillFiles(fullScope, bundled);

		// When bundled skills are disabled, only the `reflection` skill is loaded
		// from the bundled scope. User skills are unaffected.
		if (!bundledSkills && bundled) {
			skills = skills.filter((skill) => skill.name === "reflection");
		}

		for (const skill of skills) {
			const index = indexByName.get(skill.name);
			if (index === undefined) {
				indexByName.set(skill.name, allSkills.length);
				allSkills.push(skill);
				continue;
			}

			const existing = allSkills[index];
			if (existing.bundled === skill.bundled) {
				logger.warn(
					`[discoverer] Duplicate skill "${skill.name}": ignoring "${skill.path}", keeping "${existing.path}"`,
				);
				continue;
			}

			const winner = skill.bundled ? skill : existing;
			const loser = skill.bundled ? existing : skill;
			logger.warn(
				`[discoverer] Ignoring user skill "${loser.path}": clashes with bundled skill "${winner.path}"`,
			);
			allSkills[index] = winner;
		}
	}

	return allSkills;
}
