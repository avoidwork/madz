import { z } from "zod";

/**
 * Bounds for `image.maxSize`, which budgets the base64 payload `readImage`
 * returns and, via `src/agent/evictionCeiling.js`, the tool-result eviction
 * ceiling.
 *
 * The floor keeps eviction meaningful: a near-zero value would evict every
 * tool result. The ceiling is a context-window DoS guard — `image.maxSize` is
 * measured in base64 characters, so 500000 is ~125k tokens for a single tool
 * result, which stays under a typical 200k-token context window.
 */
export const MIN_IMAGE_MAX_SIZE = 1024;
export const MAX_IMAGE_MAX_SIZE = 500000;

/** Default base64 budget for `readImage` results. */
export const DEFAULT_IMAGE_MAX_SIZE = 100000;

export const ImageSchema = z.object({
	maxSize: z
		.number()
		.int()
		.min(MIN_IMAGE_MAX_SIZE)
		.max(MAX_IMAGE_MAX_SIZE)
		.default(DEFAULT_IMAGE_MAX_SIZE),
	maxWidth: z.number().int().positive().default(1024),
});
