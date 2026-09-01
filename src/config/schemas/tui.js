import { z } from "zod";

export const TuiSchema = z.object({
	name: z.string().default("madz"),
});
