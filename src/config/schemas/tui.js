import { z } from "zod";

export const TuiSchema = z.object({
	name: z.string().default("madz"),
	showToolResults: z.boolean().default(false),
	segmentBlockTimeout: z.number().int().positive().default(250),
});
