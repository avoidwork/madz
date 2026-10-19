import { z } from "zod";

/** Default cap on image width/height in pixels for `readImage`. */
export const DEFAULT_IMAGE_MAX_DIMENSION = 5000;

export const ImageSchema = z.object({
	maxWidth: z.number().int().positive().default(1920),
	maxDimension: z.number().int().positive().default(DEFAULT_IMAGE_MAX_DIMENSION),
});
