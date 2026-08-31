import { z } from "zod";

export const PersistenceSchema = z.object({
	mode: z.enum(["memory", "sqlite"]).default("sqlite"),
	sqlite_path: z.string().default("memory/checkpoints.db"),
});
