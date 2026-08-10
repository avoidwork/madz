import { z } from "zod";

export const MemoryGcSchema = z.object({
	enabled: z.boolean().default(true),
	idleTimeoutMs: z.number().int().positive().default(300000),
	maxGcPerHour: z.number().int().positive().default(4),
});

export const MemorySchema = z.object({
	directory: z.string().default("memory/"),
	contextDir: z.string().default("memory/context/"),
	subAgentsDir: z.string().default("memory/sub-agents/"),
	errorsDir: z.string().default("memory/errors/"),
	schedulesDir: z.string().default("memory/schedules/"),
	sessionsDir: z.string().default("memory/sessions/"),
	ephemeralLimit: z.number().int().positive().default(5),
	ephemeral: z
		.object({
			ttlDays: z.number().int().positive().default(7),
			maxEntries: z.number().int().positive().default(10),
		})
		.default({ ttlDays: 7, maxEntries: 10 }),
	gc: MemoryGcSchema.default({ enabled: true, idleTimeoutMs: 300000, maxGcPerHour: 4 }),
});
