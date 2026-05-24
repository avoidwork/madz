import { z } from "zod";

/**
 * Zod schema for skill input/output schema definitions.
 * @type {z.ZodType}
 */
export const SkillInputSchema = z.object({
  type: z.string().default("object"),
  required: z.array(z.string()).default([]),
  properties: z.record(z.unknown()).default({}),
});

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
 * Full skill metadata schema.
 * @type {z.ZodType}
 */
export const SkillMetadataSchema = z.object({
  name: z.string().min(1),
  version: z.string().default("1.0.0"),
  description: z.string().default(""),
  inputSchema: SkillInputSchema.default({}),
  outputSchema: SkillInputSchema.default({}),
  permissions: z.array(PermissionSchema).default([]),
  executionContext: ExecutionContextSchema.default({}),
  disabled: z.boolean().default(false),
});

/**
 * Default permission scopes applied to all skills.
 * @type {string[]}
 */
export const DEFAULT_PERMS = ["filesystem:read", "env:read"];
