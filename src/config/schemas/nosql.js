import { z } from "zod";

/** MongoDB connection config. */
const MongodbConnectionSchema = z.object({
	connectionString: z.string().optional().default(""),
	host: z.string().optional().default(""),
	port: z.number().int().positive().default(27017),
	credentials: z
		.object({
			username: z.string().optional().default(""),
			password: z.string().optional().default(""),
			database: z.string().optional().default(""),
		})
		.default({}),
});

/** Redis connection config. */
const RedisConnectionSchema = z.object({
	host: z.string().optional().default(""),
	port: z.number().int().positive().default(6379),
	credentials: z
		.object({
			username: z.string().optional().default(""),
			password: z.string().optional().default(""),
		})
		.default({}),
	db: z.number().int().nonnegative().default(0),
});

/** NoSQL tool config section. */
export const NosqlConfigSchema = z.object({
	mongodb: MongodbConnectionSchema.default({}),
	redis: RedisConnectionSchema.default({}),
});
