import { z } from "zod";

export const TuiSchema = z.object({
	name: z.string().default("madz"),
	cursorChar: z.string().default("\u2588"),
	fileCacheTtl: z.number().int().positive().default(30000),
	maxAutocompleteEntries: z.number().int().positive().default(500),
	autocompleteMaxViewport: z.number().int().positive().default(15),
	autocompleteBlacklist: z.array(z.string()).default(["node_modules", ".git", "dist", "build"]),
});
