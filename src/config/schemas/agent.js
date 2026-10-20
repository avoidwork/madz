import { z } from "zod";

export const DecisionSchema = z.object({
	baseUrl: z.string().default(""),
	model: z.string().default("tev1:4b"),
});

export const AgentSchema = z.object({
	recursionLimit: z.number().int().positive().default(1000),
	decision: DecisionSchema.default({}),
});
