import { z } from "zod";

export const ImageSchema = z.object({
	maxSize: z.string().default("100kb"),
	maxWidth: z.number().int().positive().default(1024),
});
