import { z } from "zod";

export const ImageSchema = z.object({
	maxSize: z.number().int().positive().default(100000),
	maxWidth: z.number().int().positive().default(1024),
});
