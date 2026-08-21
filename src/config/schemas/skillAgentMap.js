import { z } from "zod";

/**
 * Schema for a single skill-to-agent mapping entry.
 * @returns {z.ZodObject} Zod schema for skillAgentMap entries
 */
export const SkillAgentMapEntrySchema = z.object({
	pattern: z.string().describe("Regex pattern to match against skill names"),
	agent: z.string().describe("Agent name to assign when pattern matches"),
});

/**
 * Schema for the skillAgentMap configuration section.
 * Array of pattern-to-agent mappings. First match wins.
 * @returns {z.ZodArray} Zod schema for skillAgentMap array
 */
export const SkillAgentMapSchema = z
	.array(SkillAgentMapEntrySchema)
	.default([]);