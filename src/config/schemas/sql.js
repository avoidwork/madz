import { z } from "zod";

/** Base connection fields shared across SQL drivers. */
const BaseConnectionSchema = z.object({
	host: z.string().optional().default(""),
	port: z.number().int().positive().optional(),
	user: z.string().optional().default(""),
	password: z.string().optional().default(""),
	database: z.string().optional().default(""),
});

/** Postgres connection config. */
const PostgresConnectionSchema = BaseConnectionSchema.extend({
	port: z.number().int().positive().default(5432),
});

/** MySQL connection config. */
const MysqlConnectionSchema = BaseConnectionSchema.extend({
	port: z.number().int().positive().default(3306),
});

/** SQLite connection config. */
const SqliteConnectionSchema = z.object({
	file: z.string().optional().default(""),
});

/** SQL tool config section. */
export const SqlConfigSchema = z.object({
	postgres: PostgresConnectionSchema.default({}),
	sqlite: SqliteConnectionSchema.default({}),
	mysql: MysqlConnectionSchema.default({}),
});
