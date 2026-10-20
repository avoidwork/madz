import { z } from "zod";

export const PersistenceSchema = z.object({
	mode: z.enum(["memory", "sqlite"]).default("sqlite"),
});
