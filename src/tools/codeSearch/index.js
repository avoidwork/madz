import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { loadConfig } from "../../config/loader.js";
import { createVectorStore } from "../../vector/store.js";
import { createEmbedder } from "../../vector/embedder.js";

const config = loadConfig();
const vectorConfig = config.vector || {};

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
 * @returns {Promise<string>} Formatted search results
 */
export async function codeSearchImpl(input, options = {}) {
	const cfg = options.vector || vectorConfig;
	const projects = cfg.projects || {};

	// Resolve which project to search — default to the first configured project
	const projectName = input.project || Object.keys(projects)[0];
	if (!projectName || !projects[projectName]) {
		const available = Object.keys(projects).join(", ") || "none configured";
		return `Unknown project "${projectName}". Available projects: ${available}`;
	}

	const proj = projects[projectName];
	const dbPath = proj.dbPath;
	const mode = input.mode || cfg.searchMode || "hybrid";

	let store;
	try {
		store = await createVectorStore(dbPath, {
			fulltext: proj.fulltext !== false,
			ftsTokenize: proj.ftsTokenize || "porter unicode61",
		});
		store.init();
	} catch (err) {
		return `Failed to open vector store at ${dbPath}: ${err.message}`;
	}

	try {
		const topK = input.topK || 5;

		// Full-text mode — no embedding needed
		if (mode === "fulltext") {
			let results;
			try {
				results = store.searchFts(input.query, topK);
			} catch (err) {
				store.close();
				return `FTS search failed: ${err.message}`;
			}

			store.close();

			if (results.length === 0) {
				return "No matching code found. Try running the codeIndex tool first to index your source code.";
			}

			// Apply file filter if specified
			if (input.fileFilter) {
				const filterPattern = input.fileFilter.replace(/\*/g, ".*");
				const filterRe = new RegExp(filterPattern);
				results = results.filter((r) => filterRe.test(r.filePath));
			}

			if (results.length === 0) {
				return `No results matching filter "${input.fileFilter}".`;
			}

			// Format results
			const lines = results.map(
				(r, i) =>
					`${i + 1}. ${r.filePath}:${r.lineStart}-${r.lineEnd} (rank: ${r.rank.toFixed(4)})\n` +
					"```\n" +
					r.content +
					"\n```",
			);

			return lines.join("\n\n");
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
				store.close();
				return `Failed to embed query: ${err.message}`;
			}

			if (embeddings.length === 0) {
				store.close();
				return "No embedding generated for the query.";
			}

			let results;
			try {
				results = store.hybridSearch(embeddings[0], input.query, topK);
			} catch (err) {
				store.close();
				return `Hybrid search failed: ${err.message}`;
			}

			store.close();

			if (results.length === 0) {
				return "No matching code found. Try running the codeIndex tool first to index your source code.";
			}

			// Apply file filter if specified
			if (input.fileFilter) {
				const filterPattern = input.fileFilter.replace(/\*/g, ".*");
				const filterRe = new RegExp(filterPattern);
				results = results.filter((r) => filterRe.test(r.filePath));
			}

			if (results.length === 0) {
				return `No results matching filter "${input.fileFilter}".`;
			}

			// Format results
			const lines = results.map((r, i) => {
				let scoreStr;
				if (r.source === "vector") scoreStr = `distance: ${r.distance.toFixed(4)}`;
				else if (r.source === "fulltext") scoreStr = `rank: ${r.rank.toFixed(4)}`;
				else scoreStr = `distance: ${r.distance.toFixed(4)}, rank: ${r.rank.toFixed(4)}`;

				return (
					`${i + 1}. ${r.filePath}:${r.lineStart}-${r.lineEnd} (${scoreStr}, source: ${r.source})\n` +
					"```\n" +
					r.content +
					"\n```"
				);
			});

			return lines.join("\n\n");
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
			store.close();
			return `Failed to embed query: ${err.message}`;
		}

		if (embeddings.length === 0) {
			store.close();
			return "No embedding generated for the query.";
		}

		// Search
		let results;
		try {
			results = store.search(embeddings[0], topK);
		} catch (err) {
			store.close();
			return `Search failed: ${err.message}`;
		}

		store.close();

		if (results.length === 0) {
			return "No matching code found. Try running the codeIndex tool first to index your source code.";
		}

		// Apply file filter if specified
		if (input.fileFilter) {
			const filterPattern = input.fileFilter.replace(/\*/g, ".*");
			const filterRe = new RegExp(filterPattern);
			results = results.filter((r) => filterRe.test(r.filePath));
		}

		if (results.length === 0) {
			return `No results matching filter "${input.fileFilter}".`;
		}

		// Format results
		const lines = results.map(
			(r, i) =>
				`${i + 1}. ${r.filePath}:${r.lineStart}-${r.lineEnd} (distance: ${r.distance.toFixed(4)})\n` +
				"```\n" +
				r.content +
				"\n```",
		);

		return lines.join("\n\n");
	} finally {
		if (store) {
			try {
				store.close();
			} catch {
				// Ignore close errors
			}
		}
	}
}

export const codeSearch = tool(codeSearchImpl, {
	name: "codeSearch",
	description:
		"Search source code using hybrid (vector + keyword), full-text, or vector similarity search. " +
		"By default, uses hybrid mode combining semantic similarity with FTS5 keyword matching " +
		"via Reciprocal Rank Fusion. " +
		"Use 'mode: vector' for pure semantic search, or 'mode: fulltext' for exact keyword matches. " +
		"Returns code chunks with file paths, line numbers, and similarity scores.",
	schema: z.object({
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
	}),
});
