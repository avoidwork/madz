import { z } from "zod";

export const SandboxScopeSchema = z.object({
	paths: z.array(z.string()).default(["./", "!node_modules/", "/tmp"]),
	timeout: z.object({
		seconds: z.number().int().min(0).default(30),
		gracePeriod: z.number().int().positive().default(5),
	}),
	memoryLimit: z.string().default("512m"),
	safety: z.object({
		urlFilter: z.boolean().default(true),
		pythonImportHook: z.boolean().default(true),
	}),
	env: z.object({
		allowlist: z.array(z.string()).default(["PATH", "HOME", "NODE_ENV"]),
	}),
	permissions: z.array(z.string()).default([]),
	maxReadSize: z.string().default("1mb"),
	// Skill discovery settings
	skillScanPaths: z.array(z.string()).default(["system-skills/", "skills/"]),
	trustProjectSkills: z.boolean().default(true),
});
