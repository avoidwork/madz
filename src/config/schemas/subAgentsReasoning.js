import { z } from "zod";

export const SubAgentsReasoningSchema = z
	.record(z.string(), z.enum(["low", "medium", "high"]))
	.default({});
