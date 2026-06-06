import { SkillMetadataSchema } from "./types.js";

/**
 * Validate a skill name against Agent Skills spec constraints.
 * Rules: 1-64 chars, lowercase ASCII alphanumeric + hyphens only,
 * no consecutive hyphens, must not start/end with hyphen.
 * @param {string} name - The skill name to validate
 * @param {string} [dirName] - Parent directory name for match check
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateSkillName(name, dirName) {
	const warnings = [];

	if (!name || typeof name !== "string") {
		return { valid: false, warnings: ["Skill must have a name"] };
	}

	if (name.length < 1 || name.length > 64) {
		warnings.push(`Skill name length must be 1-64 chars, got ${name.length}`);
	}

	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
		warnings.push("Skill name must contain only lowercase alphanumeric characters and hyphens");
	}

	if (name.startsWith("-") || name.endsWith("-")) {
		warnings.push("Skill name must not start or end with a hyphen");
	}

	if (/--/.test(name)) {
		warnings.push("Skill name must not contain consecutive hyphens");
	}

	if (dirName && name !== dirName) {
		warnings.push(`Skill name "${name}" does not match parent directory "${dirName}"`);
	}

	return { valid: warnings.length === 0, warnings };
}

/**
 * Validate a skill description against spec constraints.
 * Must be 1-1024 characters and non-empty.
 * @param {string} description - The skill description to validate
 * @returns {{ valid: boolean, skip: boolean, warnings: string[] }}
 */
export function validateSkillDescription(description) {
	// Empty or missing description is fatal — skip the skill entirely
	if (!description || typeof description !== "string" || description.trim().length === 0) {
		return { valid: false, skip: true, warnings: ["Skill description is empty or missing"] };
	}

	if (description.length > 1024) {
		return {
			valid: false,
			skip: true,
			warnings: [`Skill description exceeds 1024 chars (${description.length})`],
		};
	}

	return { valid: true, skip: false, warnings: [] };
}

/**
 * Validate optional fields for spec compliance.
 * - compatibility: max 500 chars
 * - metadata: string-to-string map
 * @param {Object} metadata - The skill metadata object
 * @returns {string[]} Array of warning messages
 */
export function validateOptionalFields(metadata) {
	const warnings = [];

	if (metadata.compatibility !== undefined && metadata.compatibility !== null) {
		if (typeof metadata.compatibility !== "string") {
			warnings.push("Compatibility field must be a string");
		} else if (metadata.compatibility.length === 0) {
			warnings.push("Compatibility field must be 1-500 characters if provided");
		} else if (metadata.compatibility.length > 500) {
			warnings.push("Compatibility field must be 1-500 characters if provided");
		}
	}

	if (metadata.metadata !== undefined && metadata.metadata !== null) {
		if (typeof metadata.metadata !== "object" || Array.isArray(metadata.metadata)) {
			warnings.push("Metadata field must be a string-to-string map");
		} else {
			for (const [k, v] of Object.entries(metadata.metadata)) {
				if (typeof k !== "string" || typeof v !== "string") {
					warnings.push(`Metadata entries must have string keys and string values`);
					break;
				}
			}
		}
	}

	return warnings;
}

/**
 * Validate a skill's metadata against Agent Skills spec constraints.
 * Returns { valid, skip } — skip is true when the skill should be outright rejected (empty desc, bad YAML).
 * Warnings are non-fatal (lenient validation) but still returned.
 * @param {Object} skill - The skill metadata object with at least a name
 * @param {string} [dirName] - Parent directory name for name validation
 * @returns {{ valid: boolean, skip: boolean, errors: string[], warnings: string[] }}
 */
export function validateSkillSchema(skill, dirName) {
	const errors = [];
	const warnings = [];

	if (!skill.name) {
		errors.push("Skill must have a name");
		return { valid: false, skip: true, errors, warnings };
	}

	// Cast name to string — YAML may parse numeric names as numbers
	skill.name = String(skill.name);

	// Validate name constraints
	const nameCheck = validateSkillName(skill.name, dirName);
	warnings.push(...nameCheck.warnings);

	// Validate description (fatal if missing)
	const descCheck = validateSkillDescription(skill.description);
	if (descCheck.skip) {
		errors.push(...descCheck.warnings);
		return { valid: false, skip: true, errors, warnings };
	}
	warnings.push(...descCheck.warnings);

	// Validate optional fields
	warnings.push(...validateOptionalFields(skill));

	// Validate entire metadata shape against zod schema
	const fullResult = SkillMetadataSchema.safeParse(skill);
	if (!fullResult.success) {
		warnings.push(
			`Skill "${skill.name}" metadata validation: ${fullResult.error.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
		);
	}

	return { valid: true, skip: false, errors, warnings };
}
