import { z } from "zod";

export const ScheduleEntrySchema = z.object({
	name: z.string().min(1),
	cron: z.string().min(1),
	skill: z.string().min(1),
	input: z.record(z.unknown()).default({}),
	contextFile: z.string().default(""),
});

export const SchedulesSchema = z.object({
	maxConcurrent: z.number().int().positive().default(1),
	mode: z.enum(["inprocess", "system"]).default("inprocess"),
	syncOnInit: z.boolean().default(true),
	logPath: z.string().optional(),
	entries: z.array(ScheduleEntrySchema).default([]),
});
