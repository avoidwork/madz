import { z } from "zod";

export const TuiSchema = z.object({
	name: z.string().default("madz"),
	showToolResults: z.boolean().default(false),
	statusBar: z
		.object({
			model: z.boolean().default(true),
			skills: z.boolean().default(true),
			messages: z.boolean().default(true),
			context: z.boolean().default(true),
			tokens: z.boolean().default(true),
			quote: z.boolean().default(true),
			version: z.boolean().default(true),
		})
		.default({}),
});
