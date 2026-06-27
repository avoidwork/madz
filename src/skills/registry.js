import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { discoverSkills, defaultScope } from "./discoverer.js";
import { validateSkillSchema } from "./validator.js";

/**
 * Ensure the skills directory exists by creating it if necessary.
 * @param {string} [skillsDir="skills/"] - Path to the skills directory
 * @returns {Promise<void>}
 */
export async function ensureSkillsDir(skillsDir = "skills/") {
	const dir = join(cwd, skillsDir);
	await mkdir(dir, { recursive: true });
}

/**
 * Skill registry store that maintains a map of registered skills with metadata.
 */
export class SkillRegistry {
	#skills = new Map();
	#errors = [];
	#catalog = [];
	#bodyPaths = new Map();

	/**
	 * Discover and register all skills from configured scopes.
	 * System skills (system-skills/) are scanned first and shadow user skills (skills/).
	 * @param {string[]} [scope] - Array of directories to scan (defaults to sandbox.skillScanPaths from config)
	 * @param {object} [options] - Discovery options
	 * @param {boolean} [options.trustProjectSkills=true] - Trust project-level skills
	 * @returns {Array<{ name: string, errors: string[], warnings: string[] }>} Registration results
	 */
	discover(scope = defaultScope, options = {}) {
		const discovered = discoverSkills(scope, options);
		const results = [];

		for (const skill of discovered) {
			const dirName = skill.name;
			const { valid, skip, errors, warnings } = validateSkillSchema(skill.metadata, dirName);

			if (skip) {
				this.#errors.push({ name: skill.metadata.name || "unknown", errors });
				results.push({ name: skill.metadata.name || "unknown", errors, warnings });
				continue;
			}

			if (!valid) {
				errors.push(`Skill "${skill.metadata.name}" rejected: ${warnings.join("; ")}`);
				continue;
			}

			const entry = {
				path: skill.path,
				name: skill.metadata.name,
				metadata: skill.metadata,
				validated: true,
				errors: [],
				warnings,
				disabled: skill.metadata.disabled || false,
			};

			// Store the SKILL.md body path for progressive disclosure
			if (skill.metadata._path) {
				this.#bodyPaths.set(skill.metadata.name, skill.metadata._path);
			}

			this.#skills.set(skill.metadata.name, entry);
			results.push({ name: skill.metadata.name, errors: [], warnings });
		}

		// Build catalog from validated skills
		this.#rebuildCatalog();
		return results;
	}

	/**
	 * Rebuild the catalog from validated skills.
	 */
	#rebuildCatalog() {
		this.#catalog = [];
		for (const [_name, entry] of this.#skills) {
			this.#catalog.push({
				name: entry.name,
				description: entry.metadata?.description || "",
				location: entry.metadata?._path || entry.path,
			});
		}
	}

	/**
	 * Get a registered skill by name.
	 * @param {string} name - The skill name
	 * @returns {Object | null} The skill or null if not found
	 */
	get(name) {
		return this.#skills.get(name) || null;
	}

	/**
	 * List all registered skill names.
	 * @returns {string[]} Array of skill names
	 */
	list() {
		return Array.from(this.#skills.keys());
	}

	/**
	 * Check if a skill is registered.
	 * @param {string} name - The skill name
	 * @returns {boolean}
	 */
	has(name) {
		return this.#skills.has(name);
	}

	/**
	 * Return the skill catalog (tier 1 progressive disclosure).
	 * Contains name, description, and location for each skill.
	 * @returns {Array<{ name: string, description: string, location: string }>}
	 */
	getCatalog() {
		return this.#catalog;
	}

	/**
	 * Read and return the full SKILL.md body for a skill (tier 2 progressive disclosure).
	 * @param {string} name - The skill name
	 * @returns {string | null} The full SKILL.md content, or null if not found
	 */
	getSkillBody(name) {
		const bodyPath = this.#bodyPaths.get(name);
		if (!bodyPath) {
			return null;
		}
		try {
			return readFileSync(bodyPath, "utf-8");
		} catch {
			return null;
		}
	}

	/**
	 * Register a single skill with metadata.
	 * @param {string} name - The skill name
	 * @param {Object} metadata - The skill metadata
	 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
	 */
	register(name, metadata) {
		const { valid, skip, errors, warnings } = validateSkillSchema({ name, ...metadata });
		if (skip) {
			this.#errors.push({ name, errors });
			return { valid: false, errors, warnings };
		}

		if (!valid) {
			this.#errors.push({ name, errors });
			return { valid: false, errors, warnings };
		}

		this.#skills.set(name, {
			path: metadata._path || "",
			name,
			metadata,
			validated: true,
			errors: [],
			warnings,
			disabled: metadata.disabled || false,
		});

		if (metadata._path) {
			this.#bodyPaths.set(name, metadata._path);
		}

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
			this.#rebuildCatalog();
		}
		return removed;
	}

	/**
	 * Disable a skill without removing it.
	 * @param {string} name - The skill name
	 * @returns {boolean} Success
	 */
	disable(name) {
		const skill = this.#skills.get(name);
		if (!skill) return false;
		skill.disabled = true;
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
		return true;
	}

	/**
	 * Get registration errors from the last discover run.
	 * @returns {Array<{ name: string, errors: string[] }>}
	 */
	getErrors() {
		return this.#errors;
	}

	/**
	 * Count of registered skills.
	 */
	get size() {
		return this.#skills.size;
	}
}
