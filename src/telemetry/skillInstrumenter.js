/**
 * Create a child span for skill execution with exit status.
 * @param {Object} options - Required: parentSpan, skillName, durationMs, exitStatus
 * @param {number} options.durationMs - Execution duration in milliseconds
 * @param {string} options.skillName - The skill name
 * @param {number} options.exitStatus - Process exit code
 * @returns {Object} Span data
 */
export function instrumentSkillExecution({ skillName, durationMs, exitStatus }) {
	const status = exitStatus === 0 ? "ok" : "error";

	return {
		spanKind: "internal",
		name: `skill:${skillName}`,
		attributes: {
			"mz.skill.name": skillName,
			"mz.skill.duration_ms": durationMs,
			"mz.skill.status": status,
			"mz.skill.exit_code": exitStatus,
		},
	};
}
