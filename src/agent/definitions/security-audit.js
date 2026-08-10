import { createAgentDefinition } from "./factory.js";

/**
 * Security audit agent definition for security scanning.
 */
export const securityAuditAgent = createAgentDefinition(
	"security-audit",
	"SECURITY_AUDIT.md",
	"Specialized agent for security scanning, dependency auditing, and vulnerability detection.",
);
