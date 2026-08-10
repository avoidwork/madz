import { z } from "zod";

export const AgentSchema = z.object({
	recursionLimit: z.number().int().positive().default(1000),
	autoContinueLimit: z.number().int().positive().default(1000),
	nodeTimeout: z.number().int().positive().default(600000),
});
