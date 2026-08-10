import { z } from "zod";

export const LruSchema = z.object({
	size: z.number().int().positive().default(100),
	ttl: z.number().int().positive().default(600000),
});
