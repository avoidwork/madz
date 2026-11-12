import { z } from "zod";
import { loadConfig } from "../../config/loader.js";
import { createVectorStore } from "../../vector/store.js";
import { createEmbedder } from "../../vector/embedder.js";

const config = loadConfig();
const vectorConfig = config.vector || {};

/**
 * Escape a glob pattern into a safe regular expression source.
 * Only `*` is treated as a wildcard; all other regex metacharacters are
 * escaped so a user-supplied fileFilter cannot throw or match unexpectedly.
 * @param {string} pattern - Glob pattern (e.g. "src/tools/*.js")
 * @returns {string} Regular expression source
 */
function globToRegex(pattern) {
	return pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
}

/**
 * Apply an optional file filter to a set of results.
 * @param {Array<object>} results - Search results
 * @param {string} [fileFilter] - Glob pattern to filter by file path
 * @returns {Array<object>} Filtered results
 */
function applyFileFilter(results, fileFilter) {
	if (!fileFilter) return results;
	const filterRe = new RegExp(globToRegex(fileFilter));
	return results.filter((r) => filterRe.test(r.filePath));
}

/**
 * Format raw store results into the tool's public shape.
 * @param {Array<object>} results - Raw search results from the store
 * @param {string} source - Result source label ("vector", "fulltext", or "hybrid")
 * @returns {Array<object>} Formatted results
 */
function formatResults(results, source) {
	return results.map((r) => {
		let score;
		if (source === "fulltext") score = r.rank;
		else if (source === "vector") score = r.distance;
		else score = r.source === "fulltext" ? r.rank : r.distance;

		return {
			filePath: r.filePath,
			lineStart: r.lineStart,
			lineEnd: r.lineEnd,
			score,
			content: r.content,
			source: source === "hybrid" ? r.source : source,
		};
	});
}

/**
 * Search source code using vector similarity search.
 *
 * Embeds the query using the configured embedding provider, then performs
 * a KNN search against the sqlite-vec vector store to find semantically
 * similar code chunks.
 *
 * @param {z.infer<typeof CodeSearchSchema>} input - The tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {object} [options.vector] - Vector config override (for testing)
 * @returns {Promise<{ok: boolean, results?: Array<object>, count?: number, error?: string}>} Structured search results
 */
export async function searchCodeImpl(input, options = {}) {
	const cfg = options.vector || vectorConfig;
	const projects = cfg.projects || {};

	// Resolve which project to search — default to the first configured project
	const projectName = input.project || Object.keys(projects)[0];
	if (!projectName || !projects[projectName]) {
		const available = Object.keys(projects).join(", ") || "none configured";
		return {
			ok: false,
			error: `Unknown project "${projectName}". Available projects: ${available}`,
		};
	}

	const proj = projects[projectName];
	const dbPath = proj.dbPath;
	const mode = input.mode || cfg.searchMode || "hybrid";

	let store;
	try {
		store = await createVectorStore(dbPath, {
			fulltext: cfg.fulltext !== false,
			ftsTokenize: cfg.ftsTokenize || "porter unicode61",
		});
		await store.init();
	} catch (err) {
		if (store) {
			try {
				store.close();
			} catch (_err) {
				// Ignore close errors
			}
		}
		return { ok: false, error: `Failed to open vector store at ${dbPath}: ${err.message}` };
	}

	try {
		const topK = input.topK || 5;

		// Full-text mode — no embedding needed
		if (mode === "fulltext") {
			let results;
			try {
				results = store.searchFts(input.query, topK);
			} catch (err) {
				return { ok: false, error: `FTS search failed: ${err.message}` };
			}

			if (results.length === 0) {
				return {
					ok: false,
					error:
						"No matching code found. Try running the indexCode tool first to index your source code.",
				};
			}

			results = applyFileFilter(results, input.fileFilter);
			if (results.length === 0) {
				return { ok: false, error: `No results matching filter "${input.fileFilter}".` };
			}

			return { ok: true, results: formatResults(results, "fulltext"), count: results.length };
		}

		// Hybrid mode — run both vector and FTS, merge via RRF
		if (mode === "hybrid") {
			// Create embedder
			const embedder = createEmbedder({
				model: cfg.model || "local",
				openaiApiKey: cfg.openaiApiKey || options.openaiApiKey,
			});

			// Embed the query
			let embeddings;
			try {
				embeddings = await embedder.embed([input.query]);
			} catch (err) {
				return { ok: false, error: `Failed to embed query: ${err.message}` };
			}

			if (embeddings.length === 0) {
				return { ok: false, error: "No embedding generated for the query." };
			}

			let results;
			try {
				results = store.hybridSearch(embeddings[0], input.query, topK);
			} catch (err) {
				return { ok: false, error: `Hybrid search failed: ${err.message}` };
			}

			if (results.length === 0) {
				return {
					ok: false,
					error:
						"No matching code found. Try running the indexCode tool first to index your source code.",
				};
			}

			results = applyFileFilter(results, input.fileFilter);
			if (results.length === 0) {
				return { ok: false, error: `No results matching filter "${input.fileFilter}".` };
			}

			return { ok: true, results: formatResults(results, "hybrid"), count: results.length };
		}

		// Default: vector mode (existing behavior)
		// Create embedder
		const embedder = createEmbedder({
			model: cfg.model || "local",
			openaiApiKey: cfg.openaiApiKey || options.openaiApiKey,
		});

		// Embed the query
		let embeddings;
		try {
			embeddings = await embedder.embed([input.query]);
		} catch (err) {
			return { ok: false, error: `Failed to embed query: ${err.message}` };
		}

		if (embeddings.length === 0) {
			return { ok: false, error: "No embedding generated for the query." };
		}

		// Search
		let results;
		try {
			results = store.search(embeddings[0], topK);
		} catch (err) {
			return { ok: false, error: `Search failed: ${err.message}` };
		}

		if (results.length === 0) {
			return {
				ok: false,
				error:
					"No matching code found. Try running the indexCode tool first to index your source code.",
			};
		}

		results = applyFileFilter(results, input.fileFilter);
		if (results.length === 0) {
			return { ok: false, error: `No results matching filter "${input.fileFilter}".` };
		}

		return { ok: true, results: formatResults(results, "vector"), count: results.length };
	} finally {
		if (store) {
			try {
				store.close();
			} catch (_err) {
				// Ignore close errors
			}
		}
	}
}

/**
 * Zod schema for the `code` tool's `search` action.
 *
 * @type {z.ZodObject}
 */
export const CodeSearchSchema = z.object({
	action: z.literal("search").describe("Search the vector index for code matching a query"),
	query: z.string().min(1).describe("Natural language query describing the code to find"),
	project: z
		.string()
		.optional()
		.describe(
			"Project name to search (as configured in vector.projects). Defaults to the first project.",
		),
	topK: z.number().int().positive().max(50).default(5).describe("Number of results to return"),
	fileFilter: z
		.string()
		.optional()
		.describe("Optional glob pattern to filter results by file path (e.g., 'src/tools/*.js')"),
	mode: z
		.enum(["vector", "fulltext", "hybrid"])
		.default("hybrid")
		.describe(
			"Search mode: 'vector' (semantic similarity), 'fulltext' (keyword FTS5), or 'hybrid' (both with RRF fusion)",
		),
});
