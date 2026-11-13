import { createVectorStore } from "./store.js";
import { createEmbedder } from "./embedder.js";
import { reindex, DEFAULT_EXCLUDE, DEFAULT_INCLUDE } from "./indexer.js";
import { getDefaultMaxFileSize } from "./fileFilters.js";

/** @type {Map<string, Promise<unknown>>} per-dbPath serialization queue */
const queues = new Map();
/** @type {Map<string, {embed: Function}>} embedder cache keyed by model/key */
const embedders = new Map();

/**
 * Run `fn` after all previously queued work for `key` has settled.
 * @template T
 * @param {string} key - Queue key
 * @param {() => Promise<T>} fn - Work
 * @returns {Promise<T>}
 */
function enqueue(key, fn) {
	const prev = queues.get(key) ?? Promise.resolve();
	const run = prev.catch(() => {}).then(fn);
	const tail = run.catch(() => {});
	queues.set(key, tail);
	tail.then(() => {
		if (queues.get(key) === tail) queues.delete(key);
	});
	return run;
}

/**
 * @param {string} model - Model name
 * @param {string|undefined} apiKey - OpenAI key
 * @param {string|undefined} fallback - Fallback provider
 */
function getEmbedder(model, apiKey, fallback) {
	const cacheKey = `${model}\0${fallback ?? ""}\0${apiKey ?? ""}`;
	let e = embedders.get(cacheKey);
	if (!e) {
		e = createEmbedder({ model, openaiApiKey: apiKey, fallback });
		embedders.set(cacheKey, e);
	}
	return e;
}

/**
 * Piscina worker entry point for the `code` tool's `index` action.
 *
 * Runs the indexing work (scan, chunk, embed, store) off the main event loop.
 * Jobs for the same dbPath are serialized within the process.
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
 * @param {string} [config.openaiApiKey] - OpenAI API key (process.env.OPENAI_API_KEY preferred)
 * @param {string} [config.embeddingFallback] - Set to "openai" to opt in to remote fallback
 * @param {boolean} [config.fulltext] - Enable FTS5 full-text search
 * @param {string} [config.ftsTokenize] - FTS5 tokenizer configuration
 * @param {AbortSignal} [config.signal] - Optional abort signal (only usable in-process)
 * @returns {Promise<{indexed: number, skipped: number, errors: number, removed: number, errorDetails: Array<{file: string, message: string}>}>}
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
		embeddingFallback,
		fulltext,
		ftsTokenize,
		signal,
	} = config;

	return enqueue(dbPath, async () => {
		const store = await createVectorStore(dbPath, {
			fulltext: fulltext !== false,
			ftsTokenize: ftsTokenize ?? "porter unicode61",
		});
		try {
			store.init();
			const embedModel = model ?? "local";
			const embedder = getEmbedder(
				embedModel,
				process.env.OPENAI_API_KEY ?? openaiApiKey,
				embeddingFallback,
			);

			const result = await reindex(store, embedder, {
				rootDir: rootDir ?? ".",
				include: include ?? DEFAULT_INCLUDE,
				exclude: exclude ?? DEFAULT_EXCLUDE,
				chunkSize: chunkSize ?? 96,
				chunkOverlap: chunkOverlap ?? 16,
				maxFileSize: maxFileSize ?? getDefaultMaxFileSize(),
				model: embedModel,
				force: force ?? false,
				signal,
			});

			if (result.errors > 0 && result.indexed === 0 && result.skipped === 0) {
				const first = result.errorDetails[0];
				throw new Error(
					`Indexing failed: all ${result.errors} file(s) errored (first: ${first?.file}: ${first?.message})`,
				);
			}
			return result;
		} finally {
			store.close();
		}
	});
}
