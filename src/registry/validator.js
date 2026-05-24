import { SkillMetadataSchema } from "./types.js";

/**
 * Validate a skill's input and output schema definitions.
 * @param {Object} skill - The skill metadata object with at least a name
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSkillSchema(skill) {
  const errors = [];

  if (!skill.name) {
    errors.push("Skill must have a name");
    return { valid: false, errors };
  }

  // Validate input schema structure if present
  if (skill.inputSchema) {
    const inputResult = SkillMetadataSchema.pick({ inputSchema: true }).safeParse({
      inputSchema: skill.inputSchema,
    });
    if (!inputResult.success) {
      errors.push(
        `Skill "${skill.name}" input schema invalid: ${inputResult.error.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`
      );
    }
  }

  // Validate output schema structure if present
  if (skill.outputSchema) {
    const outputResult = SkillMetadataSchema.pick({ outputSchema: true }).safeParse({
      outputSchema: skill.outputSchema,
    });
    if (!outputResult.success) {
      errors.push(
        `Skill "${skill.name}" output schema invalid: ${outputResult.error.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`
      );
    }
  }

  // Validate entire metadata
  const fullResult = SkillMetadataSchema.safeParse(skill);
  if (!fullResult.success) {
    errors.push(
      `Skill "${skill.name}" metadata invalid: ${fullResult.error.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`
    );
  }

  return { valid: errors.length === 0, errors };
}
