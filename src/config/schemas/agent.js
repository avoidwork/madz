import { z } from "zod";

export const DecisionSchema = z.object({
	baseUrl: z.string().default(""),
	model: z.string().default("tev1:4b"),
	temperature: z.number().default(0),
});

export const AgentSchema = z.object({
	recursionLimit: z.number().int().positive().default(1000),
	autoContinueLimit: z.number().int().positive().default(1000),
	nodeTimeout: z.number().int().positive().default(600000),
	decision: DecisionSchema.default({}),
});
