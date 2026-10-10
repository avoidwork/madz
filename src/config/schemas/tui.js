import { z } from "zod";

export const TuiSchema = z.object({
	name: z.string().default("madz"),
	overscan: z.number().int().min(0).default(10),
	mouseScrollLines: z.number().int().min(1).default(1),
	showToolResults: z.boolean().default(false),
	reasoningCollapsed: z.boolean().default(true),
	toolCallCollapsed: z.boolean().default(true),
	statusBar: z
		.object({
			model: z.boolean().default(true),
			skills: z.boolean().default(true),
			messages: z.boolean().default(true),
			context: z.boolean().default(true),
			tokens: z.boolean().default(true),
			quote: z.boolean().default(true),
			version: z.boolean().default(true),
			project: z.boolean().default(true),
		})
		.default({}),
});
