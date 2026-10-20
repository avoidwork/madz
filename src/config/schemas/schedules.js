import { z } from "zod";

export const SchedulesSchema = z.object({
	syncOnInit: z.boolean().default(true),
	logPath: z.string().optional(),
});
