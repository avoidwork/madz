import { z } from "zod";

export const ImageSchema = z.object({
	maxWidth: z.number().int().positive().default(1920),
	/** Cap on image width/height in pixels for the `image` tool's `read` action. */
	maxDimension: z.number().int().positive().default(3000),
	/**
	 * Base64 character budget for the tool-result eviction ceiling. The `image`
	 * tool's `read` action enforces no size limit, so the ceiling must sit above
	 * any realistic image or deepagents' default would evict it and replace it
	 * with prose.
	 */
	evictionBudgetChars: z.number().int().positive().default(2000000),
});
