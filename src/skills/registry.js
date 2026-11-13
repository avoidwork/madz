import { readFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { discoverSkills, defaultScope } from "./discoverer.js";
import { validateSkillSchema } from "./validator.js";
import { loadConfig } from "../config/loader.js";
import { logger } from "../shared/logger.js";

const config = loadConfig();
const cwd = config.cwd || process.cwd();

/**
 * Ensure the skills directory exists by creating it if necessary.
 * @param {string} [skillsDir="skills/"] - Path to the skills directory
 * @param {string} [cwdParam] - Directory the skills directory is resolved against (defaults to the configured cwd)
 * @returns {Promise<void>}
 */
export async function ensureSkillsDir(skillsDir = "skills/", cwdParam = cwd) {
	const dir = join(cwdParam, skillsDir);
	await mkdir(dir, { recursive: true });
}

/**
 * Skill registry store that maintains a map of registered skills with metadata.
 *
 * Bundled (`.skills/`) skills always take precedence over a user skill with the same name,
 * regardless of scan order; the user skill is ignored with a warning. Disabled skills stay
 * visible to list()/has()/get() but are excluded from the catalog and skill paths.
 */
export class SkillRegistry {
	#skills = new Map();
	#errors = [];
	#catalog = [];
	#bodyPaths = new Map();
	// Names registered by discover(), so a re-discover can drop ones no longer on disk
	#discovered = new Set();

	/**
	 * Discover and register all skills from configured scopes.
	 * Bundled skills (`.skills/`) always win a name clash with a user skill (`skills/`),
	 * regardless of scan order. Re-running discover() drops previously discovered skills
	 * that are no longer found, but keeps skills added through register().
	 * Skills whose schema validation says skip are not registered; they are reported in the
	 * results with their errors.
	 * @param {string[]} [scope] - Array of directories to scan (defaults to sandbox.skillScanPaths from config)
	 * @param {object} [options] - Discovery options
	 * @param {boolean} [options.bundledSkills=true] - When `false`, only the `reflection` skill is loaded from `.skills/`
	 * @returns {Promise<Array<{ name: string, errors: string[], warnings: string[] }>>} Registration results
	 */
	async discover(scope = defaultScope, options = {}) {
		// Default bundledSkills from config when not explicitly passed.
		const bundledSkills = options.bundledSkills ?? config.agent?.bundledSkills ?? true;
		const discovered = await discoverSkills(scope, { ...options, bundledSkills });
		const results = [];
		const found = new Set();

		for (const skill of discovered) {
			const dirName = skill.name;
			// validateSkillName already warns when the frontmatter name differs from the directory
			const { skip, errors, warnings } = validateSkillSchema(skill.metadata, dirName);
			if (skip) {
				logger.warn(`[registry] Skipping skill "${dirName}": ${errors.join("; ")}`);
				results.push({ name: dirName, errors, warnings });
				continue;
			}

			this.#skills.set(dirName, {
				path: skill.path,
				name: dirName,
				metadata: skill.metadata,
				bundled: skill.bundled,
				validated: true,
				errors: [],
				warnings,
				disabled: skill.metadata.disabled || false,
			});

			// Store the SKILL.md body path for progressive disclosure
			if (skill.metadata._path) {
				this.#bodyPaths.set(dirName, skill.metadata._path);
			}
			found.add(dirName);
			results.push({ name: dirName, errors: [], warnings });
		}

		// Drop skills from a previous discover() that are no longer on disk
		for (const name of this.#discovered) {
			if (!found.has(name)) {
				this.#skills.delete(name);
				this.#bodyPaths.delete(name);
			}
		}
		this.#discovered = found;

		this.#rebuildCatalog();
		return results;
	}

	/**
	 * Rebuild the catalog from enabled, validated skills.
	 * Sorted by location (bundled skills last), then by name within each location.
	 */
	#rebuildCatalog() {
		const entries = [];
		for (const entry of this.#skills.values()) {
			if (!entry.disabled) entries.push(entry);
		}

		entries.sort((a, b) => {
			// Bundled skills always come last, preserving their order
			if (a.bundled && !b.bundled) return 1;
			if (!a.bundled && b.bundled) return -1;
			if (a.bundled && b.bundled) return 0;

			const aLocation = a.metadata?._path || a.path;
			const bLocation = b.metadata?._path || b.path;
			if (aLocation === bLocation) {
				return a.name.localeCompare(b.name);
			}
			return aLocation.localeCompare(bLocation);
		});

		this.#catalog = entries.map((entry) => ({
			name: entry.name,
			description: entry.metadata?.description || "",
			location: entry.metadata?._path || entry.path,
		}));
	}

	/**
	 * Get a registered skill by name. Disabled skills are still returned (check `disabled`).
	 * @param {string} name - The skill name
	 * @returns {Object | null} The skill or null if not found
	 */
	get(name) {
		return this.#skills.get(name) || null;
	}

	/**
	 * List all registered skill names, including disabled skills.
	 * @returns {string[]} Array of skill names
	 */
	list() {
		return Array.from(this.#skills.keys());
	}

	/**
	 * Check if a skill is registered (disabled skills count as registered).
	 * @param {string} name - The skill name
	 * @returns {boolean}
	 */
	has(name) {
		return this.#skills.has(name);
	}

	/**
	 * Return the skill catalog (tier 1 progressive disclosure).
	 * Contains name, description, and location for each enabled skill (disabled ones are excluded).
	 * @returns {Array<{ name: string, description: string, location: string }>} A copy of the catalog
	 */
	getCatalog() {
		return [...this.#catalog];
	}

	/**
	 * Read and return the full SKILL.md body for a skill (tier 2 progressive disclosure).
	 * @param {string} name - The skill name
	 * @returns {Promise<string | null>} The full SKILL.md content, or null if not found
	 */
	async getSkillBody(name) {
		const bodyPath = this.#bodyPaths.get(name);
		if (!bodyPath) {
			return null;
		}
		try {
			return await readFile(bodyPath, "utf-8");
		} catch (err) {
			logger.warn(`[registry] Failed to read skill body "${bodyPath}": ${err.message}`);
			return null;
		}
	}

	/**
	 * Register a single skill with metadata. Refuses to replace a bundled skill.
	 * @param {string} name - The skill name
	 * @param {Object} metadata - The skill metadata
	 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
	 */
	register(name, metadata) {
		if (this.#skills.get(name)?.bundled) {
			const errors = [`Skill "${name}" is a bundled skill and cannot be replaced`];
			logger.warn(`[registry] ${errors[0]}`);
			return { valid: false, errors, warnings: [] };
		}

		const { skip, errors, warnings } = validateSkillSchema({ name, ...metadata });
		if (skip) {
			this.#errors.push({ name, errors });
			return { valid: false, errors, warnings };
		}

		this.#skills.set(name, {
			path: metadata._path || "",
			name,
			metadata,
			bundled: false,
			validated: true,
			errors: [],
			warnings,
			disabled: metadata.disabled || false,
		});

		if (metadata._path) {
			this.#bodyPaths.set(name, metadata._path);
		}

		// A manual registration is no longer owned by discover()
		this.#discovered.delete(name);
		this.#rebuildCatalog();
		return { valid: true, errors: [], warnings };
	}

	/**
	 * Remove a skill from the registry.
	 * @param {string} name - The skill name
	 * @returns {boolean} Whether the skill was removed
	 */
	unregister(name) {
		const removed = this.#skills.delete(name);
		if (removed) {
			this.#bodyPaths.delete(name);
			this.#discovered.delete(name);
			this.#rebuildCatalog();
		}
		return removed;
	}

	/**
	 * Disable a skill without removing it. It is excluded from the catalog and skill paths.
	 * @param {string} name - The skill name
	 * @returns {boolean} Success
	 */
	disable(name) {
		const skill = this.#skills.get(name);
		if (!skill) return false;
		skill.disabled = true;
		this.#rebuildCatalog();
		return true;
	}

	/**
	 * Enable a previously disabled skill.
	 * @param {string} name - The skill name
	 * @returns {boolean} Success
	 */
	enable(name) {
		const skill = this.#skills.get(name);
		if (!skill) return false;
		skill.disabled = false;
		this.#rebuildCatalog();
		return true;
	}

	/**
	 * Count of registered skills (including disabled ones).
	 * @returns {number} The number of registered skills
	 */
	get size() {
		return this.#skills.size;
	}

	/**
	 * Get all enabled skill directory paths relative to the project root.
	 * @returns {string[]} Array of relative skill directory paths
	 */
	getSkillPaths() {
		const paths = [];
		for (const [_name, entry] of this.#skills) {
			if (entry.path && !entry.disabled) {
				paths.push(this.#relativePath(entry.path));
			}
		}
		return paths;
	}

	/**
	 * Get skill directory paths filtered by agent name, as relative paths.
	 * Enabled skills whose frontmatter `metadata.agent` (or config-mapped agent) matches are included.
	 * @param {string} agentName - Agent name to filter by
	 * @returns {string[]} Array of matching relative skill directory paths
	 */
	getSkillPathsForAgent(agentName) {
		const paths = [];
		for (const [_name, entry] of this.#skills) {
			if (entry.path && !entry.disabled && entry.metadata?.metadata?.agent === agentName) {
				paths.push(this.#relativePath(entry.path));
			}
		}
		return paths;
	}

	/**
	 * Convert an absolute path to a relative path from the project root.
	 * @param {string} absolutePath - Absolute path to convert
	 * @returns {string} Relative path
	 */
	#relativePath(absolutePath) {
		return relative(cwd, absolutePath);
	}
}
