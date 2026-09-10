import { z } from "zod";

/**
 * Schema for a single vector search project configuration.
 */
const VectorProjectSchema = z.object({
	/** Root directory to scan for source files */
	rootDir: z.string().default("."),
	/** Path to the SQLite vector database file for this project */
	dbPath: z.string(),
	/** Glob patterns for files to include in indexing */
	include: z.array(z.string()).default(["src/**/*.js", "src/**/*.mjs", "src/**/*.cjs"]),
	/** Glob patterns for files to exclude from indexing */
	exclude: z.array(z.string()).default(["node_modules/**", ".git/**", ".worktrees/**"]),
	/** Number of lines per chunk when splitting source files */
	chunkSize: z.number().int().positive().default(96),
	/** Number of overlapping lines between consecutive chunks */
	chunkOverlap: z.number().int().min(0).default(16),
	/** Maximum file size in bytes to index (default 500KB) */
	maxFileSize: z.number().int().positive().default(524288),
});

/**
 * Schema for vector search configuration.
 * Top-level embedding model selection, with named project configs
 * each defining their own root directory, database path, and indexing rules.
 */
export const VectorConfigSchema = z.object({
	/** Embedding model provider: "local" (transformers.js) or "openai" */
	model: z.enum(["local", "openai"]).default("local"),
	/** Default search mode: "vector", "fulltext", or "hybrid" */
	searchMode: z.enum(["vector", "fulltext", "hybrid"]).default("hybrid"),
	/** Named project configurations */
	projects: z.record(VectorProjectSchema).default({}),
});
