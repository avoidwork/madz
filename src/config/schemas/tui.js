import { z } from "zod";

export const TuiSchema = z.object({
	name: z.string().default("madz"),
	cursorChar: z.string().default("\u2588"),
	renderWindow: z.number().int().min(1).default(100),
});
