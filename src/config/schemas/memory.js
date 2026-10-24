import { z } from "zod";

const MemoryGcSchema = z.object({
	enabled: z.boolean().default(true),
	idleTimeoutMs: z.number().int().positive().default(300000),
	maxGcPerHour: z.number().int().positive().default(4),
});

export const MemorySchema = z.object({
	directory: z.string().default("memory/"),
	contextDir: z.string().default("memory/context/"),
	schedulesDir: z.string().default("memory/schedules/"),
	sessionsDir: z.string().default("memory/sessions/"),
	screenshotsDir: z.string().default("memory/screenshots/"),
	toolsDir: z.string().default("memory/tools/"),
	ephemeralLimit: z.number().int().positive().default(5),
	maxEntries: z.number().int().positive().default(100),
	maxTodos: z.number().int().positive().default(100),
	gc: MemoryGcSchema.default({ enabled: true, idleTimeoutMs: 300000, maxGcPerHour: 4 }),
});
