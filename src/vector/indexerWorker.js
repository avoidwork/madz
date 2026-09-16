import { createVectorStore } from "./store.js";
import { createEmbedder } from "./embedder.js";
import { reindex } from "./indexer.js";

/**
 * Piscina worker entry point for the indexCode tool.
 *
 * Runs the indexing work (scan, chunk, embed, store) off the main event loop.
 * Accepts plain project config (structured-cloneable) and creates the vector
 * store and embedder internally, since those instances wrap native handles
 * (better-sqlite3 Database, @xenova/transformers pipeline) that are not
 * structured-cloneable across worker threads.
 *
 * @param {object} config - Plain project configuration
 * @param {string} config.dbPath - Path to the SQLite vector database
 * @param {string} config.rootDir - Project root directory to scan
 * @param {string[]} [config.include] - Glob patterns for files to include
 * @param {string[]} [config.exclude] - Glob patterns for files to exclude
 * @param {number} [config.chunkSize] - Lines per chunk
 * @param {number} [config.chunkOverlap] - Overlap between chunks
 * @param {number} [config.maxFileSize] - Max file size in bytes
 * @param {boolean} [config.force] - Force re-index all files
 * @param {string} [config.model] - Embedding provider model
 * @param {string} [config.openaiApiKey] - OpenAI API key for fallback embedding
 * @param {boolean} [config.fulltext] - Enable FTS5 full-text search
 * @param {string} [config.ftsTokenize] - FTS5 tokenizer configuration
 * @returns {Promise<{indexed: number, skipped: number, errors: number}>}
 */
export default async function indexWorker(config) {
	const {
		dbPath,
		rootDir,
		include,
		exclude,
		chunkSize,
		chunkOverlap,
		maxFileSize,
		force,
		model,
		openaiApiKey,
		fulltext,
		ftsTokenize,
	} = config;

	const store = await createVectorStore(dbPath, {
		fulltext: fulltext !== false,
		ftsTokenize: ftsTokenize || "porter unicode61",
	});
	await store.init();

	const embedder = createEmbedder({ model: model || "local", openaiApiKey });

	try {
		return await reindex(store, embedder, {
			rootDir: rootDir || ".",
			include: include || ["src/**/*.js", "src/**/*.mjs", "src/**/*.cjs"],
			exclude: exclude || ["node_modules/**", ".git/**", ".worktrees/**"],
			chunkSize: chunkSize || 96,
			chunkOverlap: chunkOverlap || 16,
			maxFileSize: maxFileSize || 524288,
			force: force || false,
		});
	} finally {
		store.close();
	}
}
