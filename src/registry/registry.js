import { discoverSkills } from "./discoverer.js";
import { validateSkillSchema } from "./validator.js";

/**
 * Skill registry store that maintains a map of registered skills with metadata.
 */
export class SkillRegistry {
	#skills = new Map();
	#errors = [];

	/**
	 * Discover and register all skills from the skills/ directory.
	 * @param {string} [skillsDir="skills/"] - Path to the skills directory
	 * @returns {Array<{ name: string, errors: string[] }>} Registration results
	 */
	discover(skillsDir = "skills/") {
		const discovered = discoverSkills(skillsDir);
		const results = [];

		for (const skill of discovered) {
			const { valid, errors } = validateSkillSchema(skill.metadata);
			if (valid) {
				this.#skills.set(skill.name, {
					...skill,
					validated: true,
					errors: [],
					disabled: skill.metadata.disabled || false,
				});
			} else {
				this.#errors.push({ name: skill.name, errors });
			}
			results.push({ name: skill.name, errors });
		}

		return results;
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
	 * List all registered skills.
	 * @returns {Array<string>} Array of skill names
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
	 * Register a single skill with metadata.
	 * @param {string} name - The skill name
	 * @param {Object} metadata - The skill metadata
	 * @returns {{ valid: boolean, errors: string[] }}
	 */
	register(name, metadata) {
		const { valid, errors } = validateSkillSchema({ name, ...metadata });
		if (valid) {
			this.#skills.set(name, {
				path: metadata._path || "",
				name,
				metadata,
				validated: true,
				errors: [],
				disabled: metadata.disabled || false,
			});
		} else {
			this.#errors.push({ name, errors });
		}
		return { valid, errors };
	}

	/**
	 * Remove a skill from the registry.
	 * @param {string} name - The skill name
	 * @returns {boolean} Whether the skill was removed
	 */
	unregister(name) {
		return this.#skills.delete(name);
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
