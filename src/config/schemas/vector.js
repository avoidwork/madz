import { z } from "zod";

/**
 * Schema for vector search configuration.
 * Controls embedding model selection, chunking parameters, and vector database path.
 */
export const VectorConfigSchema = z.object({
	/** Embedding model provider: "local" (transformers.js) or "openai" */
	model: z.enum(["local", "openai"]).default("local"),
	/** Number of lines per chunk when splitting source files */
	chunkSize: z.number().int().positive().default(96),
	/** Number of overlapping lines between consecutive chunks */
	chunkOverlap: z.number().int().min(0).default(16),
	/** Path to the SQLite vector database file */
	dbPath: z.string().default("memory/vectorSearch/vector.db"),
	/** Maximum file size in bytes to index (default 500KB) */
	maxFileSize: z.number().int().positive().default(524288),
	/** Glob patterns for files to include in indexing */
	include: z.array(z.string()).default(["src/**/*.js", "src/**/*.mjs", "src/**/*.cjs"]),
	/** Glob patterns for files to exclude from indexing */
	exclude: z.array(z.string()).default(["node_modules/**", ".git/**", ".worktrees/**"]),
});
