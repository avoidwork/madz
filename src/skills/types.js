import { z } from "zod";

/**
 * Zod schema for skill permissions (scopes).
 * @type {z.ZodType}
 */
export const PermissionSchema = z.enum([
	"filesystem:read",
	"filesystem:write",
	"filesystem:exec",
	"network:outbound",
	"process:spawn",
	"env:read",
]);

/**
 * Zod schema for skill execution context.
 * @type {z.ZodType}
 */
export const ExecutionContextSchema = z.object({
	cwd: z.string().default(""),
	timeout: z.number().int().positive().default(30),
	memoryLimit: z.string().default("512m"),
});

/**
 * Full skill metadata schema matching Agent Skills spec.
 * @type {z.ZodType}
 */
export const SkillMetadataSchema = z.object({
	name: z.string().min(1),
	version: z.string().default("1.0.0"),
	description: z.string().default(""),
	license: z.string().optional(),
	compatibility: z.string().max(500).optional(),
	metadata: z.record(z.string()).optional(),
	"allowed-tools": z.string().optional(),
	permissions: z.array(PermissionSchema).default([]),
	executionContext: ExecutionContextSchema.default({}),
	disabled: z.boolean().default(false),
});

/**
 * Default permission scopes applied to all skills.
 * @type {string[]}
 */
export const DEFAULT_PERMS = ["filesystem:read", "env:read"];
