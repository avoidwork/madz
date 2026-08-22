import { z } from "zod";

export const SubAgentsTemperatureSchema = z
	.record(z.string(), z.number().min(0).max(2))
	.default({});
