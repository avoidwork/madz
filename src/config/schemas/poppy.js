import { z } from "zod";

/**
 * Policy for the `poppy` tool. Lives in server-side config so the model cannot
 * raise the rate limit or change the timeout.
 */
export const PoppySchema = z.object({
	/** Register the `poppy` tool. Set `POPPY_ENABLED=false` to disable. */
	enabled: z.boolean().default(true),
	/** Max requests per second, per host. `0` disables limiting. */
	rateLimit: z.number().int().min(0).default(10),
	/** Per-attempt timeout in milliseconds. */
	timeout: z.number().int().positive().default(30000),
});
