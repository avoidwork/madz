import { z } from "zod";

export const SandboxScopeSchema = z.object({
	paths: z.array(z.string()).default(["./", "!node_modules/", "/tmp"]),
	permissions: z.array(z.string()).default([]),
	// Skill discovery settings
	skillScanPaths: z.array(z.string()).default([".skills/", "skills/"]),
});
